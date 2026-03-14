import { convertToModelMessages, streamText, embed, generateText, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";

/** RAG: force wide net for dev/debug; calibrate up later to reduce noise. */
const RAG_MATCH_THRESHOLD = 0.5;
const RAG_MATCH_COUNT = 5;

const QUERY_EXPANSION_SYSTEM = `You are an absolute objective Epistemic Search Architect. The user provided a raw chat message in a local language (Hebrew etc). Extract its CORE THEME and PHILOSOPHICAL ESSENCE. Return a flat comma-separated list of highly dense English keywords and alternative synonyms for this theme. Do not add any conversational text. For example: if user inputs 'הארץ שטוחה', return: 'Flat earth, non-spherical earth, geocentric planar cosmology, earth shape hoax, motionless earth plane'. Keep it under 25 words.`;

const FORGE_SYSTEM = `You are The Epistemic Forge. A Socratic, Pure Logician guiding a human. The user wants to propose a thesis OR refine an insight in the context of an existing claim (when context is provided).

THE ROSETTA PROTOCOL: Your \`draft_epistemic_node\` tool call MUST always include assertionEn (the sharp premise in English—required for vector embedding). You MAY also fill assertionHe, reasoningHe, hiddenAssumptionsHe, challengePromptHe for Hebrew UI; if the user wrote in English or you prefer to draft only in English first, set the _He fields to empty string or omit them—they will fall back to the English text. Never omit assertionEn, reasoningEn, challengePromptEn (use empty string for optional parts if none).

CRITICAL — ALWAYS REPLY WITH VISIBLE TEXT: You MUST always respond with visible text in the user's language (Hebrew or English). Never leave the user with a blank message. Never output only tool calls without accompanying text.

TOOL TRIGGER CONDITIONS (The Structural Gate): You MUST distinguish between a **Naked Assertion** and a **Structured Argument**.
- **Naked Assertion**: A bare conclusion with no supporting observation, mechanism, formula, or logic (e.g. "The earth is flat", "Taxes are theft", "העולם שטוח"). IF the user offers only a naked assertion: Do NOT execute \`draft_epistemic_node\`. Play Socrates. Ask them strictly, in their language: "On what specific observation, physical mechanism, or formal premise is this claim based?" and await their reply. Do not draft until they provide structure.
- **Structured Argument**: A claim backed by an observation, mechanism, formula, or chain of logic—even if flawed or incomplete. IF the user offers a structured argument: You MAY and SHOULD execute \`draft_epistemic_node\` in the same turn without stalling, so the community can resolve blind spots. Put the refined premise in \`assertionEn\` (and \`assertionHe\` when applicable), set \`logicalCoherenceScore\` using the SCORING RUBRIC below, and populate \`reasoningEn\`/\`reasoningHe\`, \`hiddenAssumptionsEn\`/\`hiddenAssumptionsHe\`, \`challengePromptEn\`/\`challengePromptHe\` (Rosetta Protocol: en required; he optional, fallback to en).

EPISTEMIC AWARENESS: The backend may inject a "CRITICAL KNOWLEDGE ALERT" block below with existing nodes in The Weave that match the user's focus. When that block is present, the drafting tool is withheld for this turn. You MUST in your reply present the existing nodes, invite the user to use "Ask the Semantic Weave" search or to augment/challenge via linking, and do NOT create a new draft until the user explicitly confirms an isolated premise or requests novelty. When no such block is present, treat the user as the first Pioneer in this domain and apply the Structural Gate (naked vs structured) as above.

RULES:
- NEVER accept lazy, fallacious, or "appeal to authority" inputs initially. Use Socratic questioning so the user constructs a rigid, objective observation or syllogism.
- Neutrality: Do NOT act as a mainstream debunker. Treat the user as a peer trying to map reality.
- Converse in the user's language (Hebrew or English).

SCORING RUBRIC INSTRUCTION: When you call \`draft_epistemic_node\`, assign \`logicalCoherenceScore\` by starting at 100 and mechanically subtracting:
- Subtract 20 pts per direct Logical Fallacy identified.
- Subtract 15 pts per massive hidden/unproven assumption the user makes.
- Subtract 10 pts for lacking falsifiability (missing metrics, math, or formulas).
Be ruthlessly transparent about these deductions in your \`reasoning\` output.

SCORING VIGILANCE: A bare, conclusion-only claim (naked assertion) is a severe logic failure. It lacks a mechanism (-10 falsifiability), carries massive unstated variables (-15 hidden assumption), and often begs the question. Apply the negative rubric aggressively. If the user gives only a conclusion with no observation, formula, or reasoning chain, the score MUST tank to **20–30/100**. Do not assign 70+ to a naked assertion. Reserve higher scores for arguments that supply structure, falsifiability, or explicit premises—even when you disagree.

EPISTEMOLOGICAL PURITY & FIRST PRINCIPLES RULE: When a user makes a claim about physics, mathematics, engineering, or structural logic (e.g., aerodynamic friction at 100 km, stagnation pressure, material limits), you MUST NOT counter them by referencing other systemic events, institutions, or historical consensus items (e.g., "But NASA goes to space", "But Soyuz/SpaceX capsules survive re-entry", "But doctors cure XYZ"). Instead, you must analyze their claim based STRICTLY on First Principles: formulas, elemental properties, thermodynamics, formal logic. Ask them about their calculations. Ask them how parameter A leads to conclusion B using physical constraints alone. Never load an unverified global axiom into your counter-argument. Stay within the same domain and same level of abstraction as the user's argument.

DEEP ENGAGEMENT: Do not give superficial answers. If the user writes a highly detailed multi-part physics or logic breakdown, select the most critical focal node (e.g., "Let us analyze Part A regarding stagnation pressure") and bring specific fundamental constraints into the Socratic questioning. Do not act like a naive conversationalist. Act like an absolute grandmaster physicist or logician probing for a formulaic mismatch, an implicit assumption, or a missing physical bound in their data. Engage the substance; do not deflect with analogies from other domains or appeals to institutional success.`;

/** THE ROSETTA PROTOCOL: Draft fields in English (required for vector) + Hebrew (optional for UI). */
const DraftEpistemicNodeSchema = z.object({
  assertionEn: z.string().min(1, "assertionEn is required").describe("The sharp logical premise in perfect English (Universal vector language)"),
  assertionHe: z.string().optional().default("").describe("The translated equivalent in fluent academic Hebrew for UI display; use empty string if not translating"),
  logicalCoherenceScore: z.number().min(0).max(100).describe("Structural coherence 0-100"),
  reasoningEn: z.string().optional().default("").describe("Brief logical rationale in English"),
  reasoningHe: z.string().optional().default("").describe("Same rationale in fluent Hebrew"),
  hiddenAssumptionsEn: z.array(z.string()).optional().default([]).describe("Unstated assumptions in English (can be empty)"),
  hiddenAssumptionsHe: z.array(z.string()).optional().default([]).describe("Same assumptions in Hebrew"),
  challengePromptEn: z.string().optional().default("").describe("A question in English the community could use to falsify or stress-test the claim"),
  challengePromptHe: z.string().optional().default("").describe("Same falsification question in Hebrew"),
  relationshipToContext: z
    .enum(["supports", "challenges"])
    .optional()
    .default("supports")
    .describe(
      "Determine strictly based on formal logic whether the finalized assertion mathematically/structurally supports or contradicts the targetContext premise. When targetContext is provided, classify accordingly; when there is no targetContext (new root), use 'supports'."
    ),
  thematicTags: z
    .array(z.string())
    .max(3)
    .optional()
    .default([])
    .describe("List up to 3 macro-themes for constellation grouping (e.g. Cosmology, Finance, Space Hoax)"),
});

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: {
    messages?: UIMessage[];
    locale?: string;
    targetNodeContext?: string | null;
    architectMode?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const architectMode = body.architectMode === true;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const targetNodeContext =
    typeof body.targetNodeContext === "string" && body.targetNodeContext.trim()
      ? body.targetNodeContext.trim()
      : null;

  const contextBlock = targetNodeContext
    ? `

The user is challenging or supporting the following existing claim (use this to frame your Socratic dialogue and to know what they are responding to):
---
${targetNodeContext.slice(0, 8000)}
---`
    : "";

  const supabase = createServerSupabase();

  let injectedKnowledge = "";
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const msgAsRecord = lastUserMessage as { parts?: Array<{ type?: string; text?: string }>; content?: string };
  const fromParts =
    (msgAsRecord?.parts ?? [])
      .filter((p) => p.type === "text" && typeof (p as { text?: string }).text === "string")
      .map((p) => (p as { text: string }).text)
      .join(" ")
      .trim() || "";
  const lastUserText = (fromParts || (typeof msgAsRecord?.content === "string" ? msgAsRecord.content : "") || "")
    .trim()
    .slice(0, 8000);

  const locale = (typeof body.locale === "string" && (body.locale === "he" || body.locale === "en")) ? body.locale : "en";

  /** When architectMode is on, this is sent as [SWARM_TELEMETRY]:... at the start of the stream. Glass-box: raw query, expanded query, threshold, match breakdown, errors. */
  let ragTelemetry: {
    source: "rag";
    rawQuery: string;
    expandedQueryDisplay: string;
    matchThreshold: number;
    matchCount: number;
    matchBreakdown: string;
    errorMessage?: string;
    topMatches: Array<{ id: string; similarity: number; contentPreview: string }>;
    systemPromptOverride: boolean;
  } | null = null;

  /** Query text used for embedding (English-expanded for RAG; aligns with DB — Google gemini-embedding-001, 768 dims). */
  let textToEmbed = lastUserText;
  /** Explicit expansion result for telemetry; empty = not run or failed. */
  let expandedQueryEn = "";

  if (lastUserText) {
    try {
      let expansionError: string | undefined;
      try {
        const expansionResult = await generateText({
          model: google("gemini-2.5-flash"),
          system: QUERY_EXPANSION_SYSTEM,
          prompt: lastUserText,
          maxTokens: 120,
        });
        expandedQueryEn = (expansionResult.text ?? "").trim();
        if (expandedQueryEn.length > 0) {
          textToEmbed = expandedQueryEn;
        }
      } catch (expansionErr) {
        expansionError = expansionErr instanceof Error ? expansionErr.message : String(expansionErr);
        expandedQueryEn = "";
        textToEmbed = lastUserText;
      }

      const embeddingResult = await embed({
        model: google.textEmbeddingModel("gemini-embedding-001"),
        value: textToEmbed,
        providerOptions: { google: { outputDimensionality: 768 } },
      });
      const queryEmbedding = Array.from(embeddingResult.embedding);

      if (queryEmbedding.length > 0) {
        const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
          query_embedding: queryEmbedding,
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        } as never);

        const matchList = (matches ?? []) as Array<{ id?: string; content?: string; similarity?: number }>;
        const rpcErrorMessage = rpcError ? `match_truth_nodes RPC error: ${rpcError.message}` : undefined;
        if (rpcError && architectMode) {
          ragTelemetry = {
            source: "rag",
            rawQuery: lastUserText,
            expandedQueryDisplay: expandedQueryEn || "FAILED_TO_EXPAND_USED_RAW",
            matchThreshold: RAG_MATCH_THRESHOLD,
            matchCount: 0,
            matchBreakdown: "",
            errorMessage: [expansionError, rpcErrorMessage].filter(Boolean).join(" | "),
            topMatches: [],
            systemPromptOverride: false,
          };
        }
        if (matchList.length > 0) {
          const matchTexts = matchList
            .map((m) => {
              const raw = typeof m?.content === "string" ? m.content : "";
              const display = getDisplayAssertion(raw, locale);
              const sim = typeof m?.similarity === "number" ? m.similarity.toFixed(2) : "—";
              return `- ${display} (Sim: ${sim})`;
            })
            .join("\n");
          injectedKnowledge = `

CRITICAL KNOWLEDGE ALERT:
The backend has actively found existing nodes highly identical to the user's focus in The Weave:
${matchTexts}

IMMEDIATE FORGE HALT PROTOCOL:
1. In your VERY FIRST reply, smoothly present the existing quotes found to the user.
2. DO NOT — UNDER ANY CIRCUMSTANCES — call the \`draft_epistemic_node\` tool in this response! Wait.
3. Explicitly invite them to open the "Ask the Semantic Weave" UI search bar manually to hunt for those previous truths, or instruct them how they might augment/challenge those direct nodes via linking instead.
4. ONLY draft new knowledge if the user strictly confirms they possess an entirely isolated premise or requests explicit novelty! Stop the recursive drafting engine unconditionally until consent is confirmed post-memory query!`;
        }

        const matchBreakdown = matchList.length > 0
          ? matchList
              .map(
                (m: { content?: string; similarity?: number }, i: number) =>
                  `Match ${i + 1}: Similarity: ${((m.similarity ?? 0) * 100).toFixed(2)}% | Text: ${(typeof m.content === "string" ? m.content : "").substring(0, 40)}...`
              )
              .join("\n")
          : "";

        if (architectMode && !ragTelemetry) {
          ragTelemetry = {
            source: "rag",
            rawQuery: lastUserText,
            expandedQueryDisplay: expandedQueryEn || "FAILED_TO_EXPAND_USED_RAW",
            matchThreshold: RAG_MATCH_THRESHOLD,
            matchCount: matchList.length,
            matchBreakdown,
            errorMessage: expansionError,
            topMatches: matchList.slice(0, 3).map((m) => ({
              id: typeof m?.id === "string" ? m.id : "",
              similarity: typeof m?.similarity === "number" ? m.similarity : 0,
              contentPreview: getDisplayAssertion(typeof m?.content === "string" ? m.content : "", locale).slice(0, 200),
            })),
            systemPromptOverride: matchList.length > 0,
          };
        } else if (architectMode && ragTelemetry) {
          ragTelemetry.matchCount = matchList.length;
          ragTelemetry.matchBreakdown = matchBreakdown;
          ragTelemetry.topMatches = matchList.slice(0, 3).map((m) => ({
            id: typeof m?.id === "string" ? m.id : "",
            similarity: typeof m?.similarity === "number" ? m.similarity : 0,
            contentPreview: getDisplayAssertion(typeof m?.content === "string" ? m.content : "", locale).slice(0, 200),
          }));
          ragTelemetry.systemPromptOverride = matchList.length > 0;
        }
      }
    } catch (ragErr) {
      if (architectMode && lastUserText && !ragTelemetry) {
        const errMsg = ragErr instanceof Error ? ragErr.message : String(ragErr);
        ragTelemetry = {
          source: "rag",
          rawQuery: lastUserText,
          expandedQueryDisplay: expandedQueryEn || "FAILED_TO_EXPAND_USED_RAW",
          matchThreshold: RAG_MATCH_THRESHOLD,
          matchCount: 0,
          matchBreakdown: "",
          errorMessage: errMsg,
          topMatches: [],
          systemPromptOverride: false,
        };
      }
    }
  }
  if (architectMode && lastUserText && ragTelemetry === null) {
    ragTelemetry = {
      source: "rag",
      rawQuery: lastUserText,
      expandedQueryDisplay: expandedQueryEn || "FAILED_TO_EXPAND_USED_RAW",
      matchThreshold: RAG_MATCH_THRESHOLD,
      matchCount: 0,
      matchBreakdown: "",
      topMatches: [],
      systemPromptOverride: false,
    };
  }

  const systemPrompt = injectedKnowledge
    ? `${injectedKnowledge}\n\n---\n\n${FORGE_SYSTEM}${contextBlock}`
    : `${FORGE_SYSTEM}${contextBlock}`;

  /** When RAG found duplicates, do NOT expose the draft tool — path is not natively clear until user confirms novelty. */
  const allowDraftTool = injectedKnowledge.length === 0;

  const model = google("gemini-2.5-pro");

  const draftEpistemicNodeTool = {
    description:
      "Call this in the SAME response whenever the user offers a structured argument, thesis, or formula—do not wait for them to answer all Socratic questions. Emits a draft with their assertion plus your critique (hidden assumptions, challenge prompts, thematicTags) so they can anchor it and the community can resolve open questions.",
    inputSchema: DraftEpistemicNodeSchema,
    execute: async (args: z.infer<typeof DraftEpistemicNodeSchema>) => {
      return { ok: true, draft: args };
    },
  };

  const forgeTools = allowDraftTool
    ? { draft_epistemic_node: draftEpistemicNodeTool }
    : {};

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: forgeTools }),
      tools: forgeTools,
      temperature: 0.45,
      stopWhen: stepCountIs(2),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => {
        console.error("[Oracle Forge stream]", err);
      },
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
                const json = JSON.parse(payload) as { type?: string; delta?: string; id?: string };
                if (json.type === "text-delta" && "delta" in json) {
                  const current = typeof json.delta === "string" ? json.delta : "";
                  json.delta = telemetryPrefix + current;
                  line = "data: " + JSON.stringify(json);
                  prepended = true;
                }
              }
            } catch {
              // leave line unchanged
            }
          }
          controller.enqueue(new TextEncoder().encode(line + "\n"));
        }
      },
      flush(controller) {
        if (buffer.length > 0) {
          controller.enqueue(new TextEncoder().encode(buffer + "\n"));
        }
      },
    });

    return new Response(response.body?.pipeThrough(transform) ?? null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Oracle Forge API]", err);
    return NextResponse.json(
      { error: "Epistemic Forge failed", ...(process.env.NODE_ENV === "development" && { detail: message }) },
      { status: 500 }
    );
  }
}
