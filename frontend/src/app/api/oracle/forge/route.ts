import { convertToModelMessages, streamText, embed, generateText, generateObject } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";

const RAG_MATCH_THRESHOLD = 0.50;
const RAG_MATCH_COUNT = 5;

const QUERY_EXPANSION_SYSTEM = `You are an absolute objective Epistemic Search Architect. The user provided a raw chat message in a local language (Hebrew etc). Extract its CORE THEME and PHILOSOPHICAL ESSENCE. Return a flat comma-separated list of highly dense English keywords and alternative synonyms for this theme. Do not add any conversational text. For example: if user inputs 'הארץ שטוחה', return: 'Flat earth, non-spherical earth, geocentric planar cosmology, earth shape hoax, motionless earth plane'. Keep it under 25 words.`;

const FORGE_SYSTEM = `You are The Epistemic Forge. A Socratic, Pure Logician guiding a human. Converse in the user's language (Hebrew or English). Never leave the user with a blank message.

TOOL TRIGGER CONDITIONS (The Structural Gate):
- **Naked assertions**: If the user types a simple claim, greeting, or short phrase (e.g. "The earth is flat", "Apples are good", "שלום", "השמש קרה") with no supporting reasoning or mechanism—DO NOT call \`epistemic_triage\`. You are Socrates. Ask them for the physical mechanism, formal logic, or observation behind the claim. Keep the conversation going.
- **Structured arguments**: ONLY when the user provides a fleshed-out argument with reasoning, evidence, or mechanism, you MUST call \`epistemic_triage\` EXACTLY ONCE. Use \`existingNodesToDisplay\` for any RAG-matched nodes; use \`newDrafts\` for every new structured claim you evaluate. Score 0–100. Populate assertionEn, assertionHe, reasoning, hiddenAssumptions, challengePrompt.

RULES: Neutrality—treat the user as a peer. First Principles—analyze physics/logic by formulas and constraints, not by appeals to institutions.`;

const DraftEpistemicNodeSchema = z.object({
  assertionEn: z.string().min(1).describe("The sharp logical premise in English"),
  assertionHe: z.string().optional().default("").describe("Hebrew equivalent for UI"),
  logicalCoherenceScore: z.number().min(0).max(100).describe("Structural coherence 0-100"),
  reasoningEn: z.string().optional().default("").describe("Brief rationale in English"),
  reasoningHe: z.string().optional().default("").describe("Brief rationale in Hebrew"),
  hiddenAssumptionsEn: z.array(z.string()).optional().default([]),
  hiddenAssumptionsHe: z.array(z.string()).optional().default([]),
  challengePromptEn: z.string().optional().default(""),
  challengePromptHe: z.string().optional().default(""),
  matchedExistingNodeId: z
    .string()
    .nullable()
    .optional()
    .describe("If this claim strongly matches one of the existing nodes in the injected Weave overlap context, put that node's exact UUID here; otherwise null."),
  relationshipToContext: z.enum(["supports", "challenges"]).optional().default("supports"),
  thematicTags: z.array(z.string()).max(10).optional().default([]),
});

const EpistemicTriageSchema = z.object({
  existingNodesToDisplay: z
    .array(
      z.object({
        id: z.string(),
        assertionEn: z.string(),
        assertionHe: z.string().optional(),
      })
    )
    .optional()
    .describe("Pass the existing nodes here to show them as portals to the user."),
  newDrafts: z
    .array(DraftEpistemicNodeSchema)
    .optional()
    .describe("Pass the newly evaluated claims here to generate draft cards."),
});

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const architectMode = body.architectMode === true;
  const messages = Array.isArray(body.messages) ? body.messages :[];
  const targetNodeContext = typeof body.targetNodeContext === "string" ? body.targetNodeContext.trim() : null;

  const contextBlock = targetNodeContext
    ? `\n\nThe user is challenging or supporting the following existing claim (use this to frame your Socratic dialogue):\n---\n${targetNodeContext.slice(0, 8000)}\n---`
    : "";

  const supabase = createServerSupabase();

  let injectedKnowledge = "";
  const userMessages = messages.filter((m: UIMessage) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const firstUserMessage = userMessages.length > 1 ? userMessages[0] : null;

  const getMessageText = (msg: any): string => {
    const parts = (msg?.parts ??[]).filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ").trim();
    return (parts || msg?.content || "").trim().slice(0, 8000);
  };

  const lastUserText = lastUserMessage ? getMessageText(lastUserMessage) : "";
  const firstUserText = firstUserMessage ? getMessageText(firstUserMessage) : "";
  const hasMultipleTurns = firstUserText.length > 0 && lastUserText.length > 0 && firstUserText !== lastUserText;
  const locale = body.locale === "he" ? "he" : "en";

  let ragTelemetry: any = null;
  let textToEmbed = hasMultipleTurns ? `${firstUserText}\n\n${lastUserText}`.slice(0, 8000) : lastUserText;
  let expandedQueryEn = "";

  if (lastUserText) {
    try {
      let expansionError = "";
      try {
        const expansionResult = await generateText({
          model: google("gemini-2.5-flash"),
          system: QUERY_EXPANSION_SYSTEM,
          prompt: lastUserText,
          maxTokens: 120,
        });
        expandedQueryEn = (expansionResult.text ?? "").trim();
        if (expandedQueryEn.length > 0) textToEmbed = expandedQueryEn;
      } catch (err: any) {
        expansionError = err.message;
        textToEmbed = lastUserText;
      }

      const embeddingResult = await embed({
        model: google.textEmbeddingModel("gemini-embedding-001"),
        value: textToEmbed,
        providerOptions: { google: { outputDimensionality: 768 } },
      });

      if (embeddingResult.embedding.length > 0) {
        const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
          query_embedding: Array.from(embeddingResult.embedding),
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        } as never);

        const matchList = (matches ?? []) as any[];

        let newClaimsToDraft: string[] = [];
        let splitterRun = false;
        let splitterError = "";

        if (matchList.length > 0) {
          const nodesForTool = matchList.map((m: { id: string; content?: string }) => ({
            id: m.id,
            assertionEn: getDisplayAssertion(m.content || "", "en"),
            assertionHe: getDisplayAssertion(m.content || "", "he"),
          }));

          if (lastUserText.length > 100) {
            splitterRun = true;
            try {
              const splitResult = await generateObject({
                model: google("gemini-2.5-flash"),
                schema: z.object({
                  newClaims: z
                    .array(z.string())
                    .describe("Extract ONLY the distinct arguments from the user's text that are completely NEW and NOT addressed by the existing DB matches."),
                }),
                prompt: `USER TEXT:\n${lastUserText}\n\nEXISTING DB MATCHES:\n${JSON.stringify(matchList.map((m: { id?: string; content?: string }) => ({ id: m.id, contentPreview: (m.content ?? "").slice(0, 200) })))}\n\nTASK: Analyze the user text. Ignore anything that overlaps with the existing DB matches. Return an array of ONLY the new, unaddressed arguments/claims that require drafting.`,
              });
              newClaimsToDraft = splitResult.object.newClaims ?? [];
            } catch (e: any) {
              console.error("Splitter Agent failed:", e);
              splitterError = e?.message ?? String(e);
              newClaimsToDraft = [lastUserText];
            }
          } else {
            newClaimsToDraft = [lastUserText];
          }

          injectedKnowledge = `
=========================================
CRITICAL SYSTEM OVERRIDE: PRE-PROCESSED COGNITIVE ROUTING
=========================================
The backend has already analyzed the user's input and split the cognitive load for you.

MANDATORY EXECUTION: You possess a single tool: \`epistemic_triage\`. You MUST call it EXACTLY ONCE in this response.

1. Place the existing matched nodes into \`existingNodesToDisplay\`: ${JSON.stringify(nodesForTool)}

2. The backend identified these NEW, unmatched claims: ${JSON.stringify(newClaimsToDraft)}
   Evaluate them. To prevent cognitive overload, select the 2 or 3 most foundational new claims, score them strictly, and place them into the \`newDrafts\` array. Do NOT leave \`newDrafts\` empty if new claims were provided.

YOUR RESPONSE FORMAT:
- Warmly acknowledge the existing nodes; they will appear as portals.
- Provide brief Socratic insight on the NEW claims you drafted.
- State that you have prepared drafts below for anchoring.
`;
        } else {
          newClaimsToDraft = [lastUserText];
        }

        if (architectMode) {
          ragTelemetry = {
            source: "rag",
            rawQuery: lastUserText,
            expandedQueryDisplay: expandedQueryEn || "FAILED_TO_EXPAND_USED_RAW",
            matchThreshold: RAG_MATCH_THRESHOLD,
            matchCount: matchList.length,
            matchBreakdown: matchList.map((m: any, i: number) => `Match ${i + 1}: Sim: ${(m.similarity * 100).toFixed(2)}% | ${m.content.substring(0, 40)}...`).join("\n"),
            errorMessage:[expansionError, rpcError?.message].filter(Boolean).join(" | "),
            systemPromptOverride: matchList.length > 0,
            splitterRun,
            splitterClaims: newClaimsToDraft,
            splitterError: splitterError || undefined,
          };
        }
      }
    } catch (err: any) {
      if (architectMode) {
        ragTelemetry = { source: "rag", errorMessage: err.message, matchCount: 0 };
      }
    }
  }

  // RAG override MUST be last so the model obeys it (avoids recency bias from FORGE_SYSTEM rules).
  const systemPrompt =
    injectedKnowledge.length > 0
      ? `${FORGE_SYSTEM}${contextBlock}\n\n---\n\n${injectedKnowledge}`
      : `${FORGE_SYSTEM}${contextBlock}`;

  const model = google("gemini-2.5-pro");

  const epistemicTriageTool = {
    description:
      "MANDATORY TOOL: You MUST call this tool to render the UI. Use \`existingNodesToDisplay\` to show RAG-matched nodes as portals. Use \`newDrafts\` to generate draft cards for NEW arguments. Call exactly once per response when the user provides structured arguments.",
    inputSchema: EpistemicTriageSchema,
    execute: async (args: z.infer<typeof EpistemicTriageSchema>) => ({ ok: true, triage: args }),
  };

  const forgeTools = {
    epistemic_triage: epistemicTriageTool,
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: forgeTools }),
      tools: forgeTools,
      toolChoice: "auto",
      temperature: 0.45,
      maxSteps: 5,
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => console.error("[Oracle Forge stream]", err),
    });

    if (!architectMode || !ragTelemetry) {
      return response;
    }

    const telemetryPrefix = `[SWARM_TELEMETRY]:${JSON.stringify(ragTelemetry)}\n\n`;
    let prepended = false;
    let buffer = "";

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += new TextDecoder().decode(chunk, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          if (!prepended && line.startsWith("data: ")) {
            try {
              const payload = line.slice(6).trim();
              if (payload !== "[DONE]") {
                const json = JSON.parse(payload);
                if (json.type === "text-delta" && "delta" in json) {
                  json.delta = telemetryPrefix + json.delta;
                  line = "data: " + JSON.stringify(json);
                  prepended = true;
                }
              }
            } catch {}
          }
          controller.enqueue(new TextEncoder().encode(line + "\n"));
        }
      },
      flush(controller) {
        if (buffer.length > 0) controller.enqueue(new TextEncoder().encode(buffer + "\n"));
      }
    });

    return new Response(response.body?.pipeThrough(transform) ?? null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err: any) {
    console.error("[Oracle Forge API]", err);
    return NextResponse.json({ error: "Epistemic Forge failed", detail: err.message }, { status: 500 });
  }
}