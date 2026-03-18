import { convertToModelMessages, streamText, generateObject, embed } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";
import {
  DraftEpistemicNodeV2HeArenaSchema,
  DraftEpistemicNodeV2LooseSchema,
} from "@/lib/truth/rosettaSchemas";
import { fixDraftRosettaV2Flip } from "@/lib/utils/truthRosetta";

// ---------------------------------------------------------------------------
// Schemas (Arena — Rosetta V2, macro-arena)
// ---------------------------------------------------------------------------

const EpistemicTriageSchema = z.object({
  socraticMessage: z
    .string()
    .describe(
      "MANDATORY: Your warm, Socratic conversational response. Write your analysis and greeting here. Never leave empty."
    ),
});


// ---------------------------------------------------------------------------
// Arena Drafter: neutral root title only (no RAG, no intent router)
// ---------------------------------------------------------------------------

const ARENA_DRAFTER_PROMPT = (topic: string, hebrewStrict: boolean) =>
  hebrewStrict
    ? `You are the Arena Architect (Rosetta V2, Hebrew UI — IRON DISCIPLINE).

Topic: "${topic}"

Output MUST satisfy strict JSON:
- source_locale: exactly "he"
- canonical_en: FULL English block — assertion, reasoning (min 1 sentence), challengePrompt (min 1 sentence), hiddenAssumptions (array, [] if none)
- local_translation: FULL Hebrew mirror of canonical_en — same four fields, all real Hebrew (never copy-paste English)
- logicalCoherenceScore: 50
- thematicTags: include "macro-arena"
- relationshipToContext: "supports"
- competingTheories: EXACTLY 2 entries. Each entry: canonical_en (full English block) + local_translation (full Hebrew block). Every reasoning and challengePrompt required in BOTH languages.`
    : `You are the Arena Architect (Rosetta V2).

Topic: "${topic}"

- canonical_en: English root question + reasoning + challengePrompt
- source_locale: "en"
- local_translation: optional
- competingTheories: 2 theories, English in canonical_en
- thematicTags: include "macro-arena"
- logicalCoherenceScore: 50, relationshipToContext: "supports"`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_MESSAGE_TEXT_LENGTH = 8000;

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  if (!msg) return "";
  const parts = (msg.parts ?? [])
    .filter((p: { type: string }) => p.type === "text")
    .map((p: { text?: string }) => p.text ?? "")
    .join(" ")
    .trim();
  return (parts || (msg as { content?: string }).content || "").trim().slice(0, MAX_MESSAGE_TEXT_LENGTH);
}

/** High threshold for Arena deduplication: only catch actual overlaps. */
const ARENA_SCOUT_THRESHOLD = 0.75;
const ARENA_SCOUT_MATCH_COUNT = 3;

export const maxDuration = 30;

/**
 * Arena Initiator API — dedicated to Macro-Arena creation only.
 * No Scout (RAG). No Intent Router. Always extract neutral formulation and produce one draft card.
 */
export async function POST(request: Request) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" }, { status: 503 });
  }

  let body: {
    messages?: UIMessage[];
    architectMode?: boolean;
    targetNodeContext?: string;
    locale?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const architectMode = body.architectMode === true;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const targetNodeContext = typeof body.targetNodeContext === "string" ? body.targetNodeContext.trim() : null;
  const locale = body.locale === "he" ? "he" : "en";

  const contextBlock = targetNodeContext
    ? `\n\nContext (optional):\n---\n${targetNodeContext.slice(0, 2000)}\n---`
    : "";

  const userMessages = messages.filter((m: UIMessage) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const lastUserText = lastUserMessage ? getMessageText(lastUserMessage as Parameters<typeof getMessageText>[0]) : "";
  const topic = lastUserText.trim();

  // ---------------------------------------------------------------------------
  // Arena Scout (RAG): deduplication — only macro roots (existing arenas)
  // ---------------------------------------------------------------------------
  type ExistingNodeDisplay = Array<{ id: string; enLine: string; heLine: string }>;
  let existingMatches: ExistingNodeDisplay = [];

  if (topic.length > 0) {
    try {
      const embeddingResult = await embed({
        model: google.textEmbeddingModel("gemini-embedding-001"),
        value: topic,
        providerOptions: { google: { outputDimensionality: 768 } },
      });

      if (embeddingResult.embedding.length > 0) {
        const supabase = createServerSupabase();
        const { data: matches } = await supabase.rpc("match_truth_nodes", {
          query_embedding: Array.from(embeddingResult.embedding),
          match_threshold: ARENA_SCOUT_THRESHOLD,
          match_count: ARENA_SCOUT_MATCH_COUNT,
        } as never);

        const matchList = (matches ?? []) as Array<{ id: string; content?: string }>;
        if (matchList.length > 0) {
          const { data: macroRows } = await supabase
            .from("truth_nodes")
            .select("id")
            .in("id", matchList.map((m) => m.id))
            .eq("is_macro_root", true);

          const macroIds = new Set(
            ((macroRows ?? []) as { id: string }[]).map((r) => r.id)
          );
          const arenaMatches = matchList.filter((m) => macroIds.has(m.id));
          existingMatches = arenaMatches.map((m) => ({
            id: m.id,
            enLine: getDisplayAssertion(m.content ?? "", "en"),
            heLine: getDisplayAssertion(m.content ?? "", "he"),
          }));
        }
      }
    } catch (err) {
      console.error("[Arena Scout Error]", err);
    }
  }

  const arenaDrafterSchema =
    locale === "he" ? DraftEpistemicNodeV2HeArenaSchema : DraftEpistemicNodeV2LooseSchema;
  const arenaTriageArr = z.array(arenaDrafterSchema).max(1);
  type ArenaDraft = z.infer<typeof arenaDrafterSchema>;

  // ---------------------------------------------------------------------------
  // Draft generation only when NO similar arena exists
  // ---------------------------------------------------------------------------
  let newDraftsForTriage: ArenaDraft[] = [];

  if (topic.length > 0 && existingMatches.length === 0) {
    try {
      const result = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: arenaDrafterSchema,
        prompt: ARENA_DRAFTER_PROMPT(topic, locale === "he"),
      });
      const draft = arenaDrafterSchema.parse(result.object);
      const flipped = fixDraftRosettaV2Flip(draft);
      const tags = (flipped as { thematicTags?: string[] }).thematicTags ?? [];
      const normalized = {
        ...flipped,
        logicalCoherenceScore: 50,
        thematicTags: [...new Set([...tags, "macro-arena"])],
      };
      newDraftsForTriage = arenaTriageArr.parse([normalized]);
    } catch {
      newDraftsForTriage = [];
    }
  }

  const ARENA_SYSTEM = `You are the Arena Architect. Converse in the user's language (Hebrew or English). Never leave the user with a blank message.

You have ONE tool: \`epistemic_triage\`. Call it exactly once per turn. Output ONLY \`socraticMessage\` (your conversational reply). The server injects draft cards or existing-arena portals into the tool result—do not stream JSON.`;

  let handoffBlock: string;
  if (existingMatches.length > 0) {
    handoffBlock = `
=========================================
ARENA DEDUPLICATION — SIMILAR ARENA(S) EXIST
=========================================
The user asked to create a new debate arena, but highly similar arena(s) already exist in the weave. Display them as Portals so they enter the existing arena instead of fragmenting the community.

EXISTING ARENAS TO DISPLAY (pass these as existingNodesToDisplay; leave newDrafts EMPTY):
${JSON.stringify(existingMatches)}

YOUR TASK:
1. Write a warm Socratic message in the user's language. Explain that a very similar debate arena already exists in the weave and invite them to enter it instead of creating a duplicate.
2. Call \`epistemic_triage\` EXACTLY ONCE. Pass your text to \`socraticMessage\`.
3. The server will inject the existing arenas into \`existingNodesToDisplay\` and leave \`newDrafts\` empty. Do not generate a new arena card.`;
  } else if (newDraftsForTriage.length > 0) {
    handoffBlock = `
=========================================
ARENA CREATION (GENERATIVE UI)
=========================================
No duplicate arena was found. The backend has formulated the full Arena package: the neutral root question AND the two competing theories (Theory A vs Theory B).
APPROVED DRAFT JSON: ${JSON.stringify(newDraftsForTriage)}

YOUR TASK:
1. Write a short, warm Socratic response in the user's language. Say that you formulated the neutral root question and extracted the two main competing theories for the debate; if it accurately captures the arena, they can click to anchor.
2. Call \`epistemic_triage\` EXACTLY ONCE.
3. Pass your text to \`socraticMessage\`.
4. The server will inject the APPROVED DRAFT into the tool result. You do not pass newDrafts; the server attaches it.`;
  } else {
    handoffBlock = `
=========================================
ARENA — AWAITING TOPIC
=========================================
The user has not yet sent a topic (or the message was empty).

YOUR TASK:
1. Write a short, warm prompt in the user's language asking what topic they would like to open for debate (e.g. "What arena would you like to open? Name the root question or theme.").
2. Call \`epistemic_triage\` EXACTLY ONCE. Pass your text to \`socraticMessage\`. The server will attach empty newDrafts.
`;
  }

  const systemPrompt = `${ARENA_SYSTEM}${contextBlock}\n\n${handoffBlock}`;

  const epistemicTriageTool = {
    description:
      "MANDATORY: Call this once to render the UI. Populate socraticMessage only. The server injects the Arena draft card or existing-arena portals into the result.",
    inputSchema: EpistemicTriageSchema,
    execute: async (args: z.infer<typeof EpistemicTriageSchema>) => ({
      ok: true,
      triage: {
        socraticMessage: args.socraticMessage,
        existingNodesToDisplay: existingMatches,
        newDrafts: newDraftsForTriage,
      },
    }),
  };

  const arenaTools = { epistemic_triage: epistemicTriageTool };

  try {
    const result = streamText({
      model: google("gemini-2.5-pro"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: arenaTools }),
      tools: arenaTools,
      toolChoice: "required",
      temperature: 0.45,
      providerOptions: { google: { maxOutputTokens: 8192 } },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => {
        console.error("[Oracle Arena stream]", err);
        return err instanceof Error ? err.message : String(err);
      },
    });

    return response;
  } catch (err) {
    console.error("[Oracle Arena API]", err);
    return NextResponse.json(
      { error: "Arena Initiator failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
