import { convertToModelMessages, streamText, embed, generateText, stepCountIs } from "ai";
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
- **Naked assertions**: If the user types a simple claim, greeting, or short phrase (e.g. "The earth is flat", "Apples are good", "שלום", "השמש קרה") with no supporting reasoning or mechanism—DO NOT call \`draft_epistemic_nodes\`. You are Socrates. Ask them for the physical mechanism, formal logic, or observation behind the claim. Keep the conversation going.
- **Structured arguments**: ONLY when the user provides a fleshed-out argument with reasoning, evidence, or mechanism, you MUST call \`draft_epistemic_nodes\` ONCE with an array of ALL distinct claims you identify. Do not evaluate conversational banter or simple statements with the tool.

When you do call \`draft_epistemic_nodes\`: Pass a single \`drafts\` array containing EVERY new structured claim. For each draft, set \`matchedExistingNodeId\` to the matching node's UUID if the injected RAG context lists one; otherwise null. Score 0–100 (naked assertions 20–30). Populate assertionEn, assertionHe, reasoning, hiddenAssumptions, challengePrompt. Do not leave any distinct argument behind—batch them all in one call.

RULES: Neutrality—treat the user as a peer. First Principles—analyze physics/logic by formulas and constraints, not by appeals to institutions.`;

const ShowExistingNodesSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      assertionEn: z.string(),
      assertionHe: z.string().optional(),
    })
  ),
});

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
  thematicTags: z.array(z.string()).max(3).optional().default([]),
});

const DraftEpistemicNodesSchema = z.object({
  drafts: z
    .array(DraftEpistemicNodeSchema)
    .describe("An array of all new, unmatched claims that need drafting. You MUST include every distinct new structured argument the user provided."),
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

        if (matchList.length > 0) {
          const nodesForTool = matchList.map((m: { id: string; content?: string }) => ({
            id: m.id,
            assertionEn: getDisplayAssertion(m.content || "", "en"),
            assertionHe: getDisplayAssertion(m.content || "", "he"),
          }));

          injectedKnowledge = `
=========================================
SYSTEM AWARENESS: PARTIAL WEAVE OVERLAP DETECTED
=========================================
The database contains nodes that semantically match SOME of the user's intent.
Payload for show_existing_nodes: ${JSON.stringify({ nodes: nodesForTool })}

MULTI-STAGE EPISTEMIC TRIAGE PROTOCOL:
You are processing a multi-argument input. You MUST execute both of these stages in your current response:
STAGE 1 (The Known): Call \`show_existing_nodes\` with the payload above. In your text, warmly acknowledge that these specific points are already in the Weave.
STAGE 2 (The Unknown): You MUST deeply scan the rest of the user's input for ANY OTHER structured arguments (e.g., if they also mentioned gyroscopes or water). You MUST evaluate these NEW arguments according to the Scoring Rubric, and call the \`draft_epistemic_nodes\` tool EXACTLY ONCE, passing an array containing EVERY new valid draft.

Example of a correct multi-tool response structure:
[Text: "Welcome. I see your point about X is already in the Weave... However, your points about Y and Z are fascinating new horizons. Let us draft them."]
[Tool Call: show_existing_nodes (for X)]
[Tool Call: draft_epistemic_nodes (Array containing drafts for Y and Z)]

DO NOT HALT after Stage 1. Complete the full triage.`;
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

  const showExistingNodesTool = {
    description:
      "When the system alerts you that existing nodes match the user's query, call this tool with the provided nodes payload to display portal links. The UI will render them.",
    inputSchema: ShowExistingNodesSchema,
    execute: async (args: z.infer<typeof ShowExistingNodesSchema>) => ({ ok: true, nodes: args.nodes }),
  };

  const draftEpistemicNodesTool = {
    description:
      "Call ONLY when the user has provided a structured argument (reasoning, mechanism, or evidence). Break it into distinct logical claims and pass ALL of them in a single \`drafts\` array. For each draft set matchedExistingNodeId if it matches an existing node from RAG context, or null. Score 0–100. Do not call for simple statements or naked assertions—ask Socratic questions instead. You MUST call this tool exactly once per response with every new claim the user made.",
    inputSchema: DraftEpistemicNodesSchema,
    execute: async (args: z.infer<typeof DraftEpistemicNodesSchema>) => ({ ok: true, drafts: args.drafts }),
  };

  const forgeTools = {
    draft_epistemic_nodes: draftEpistemicNodesTool,
    ...(injectedKnowledge.length > 0 && {
      show_existing_nodes: showExistingNodesTool,
    }),
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