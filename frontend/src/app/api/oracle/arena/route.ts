import { convertToModelMessages, streamText, generateObject, embed } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";

// ---------------------------------------------------------------------------
// Schemas (Arena: single draft card, score 50, macro-arena tag)
// ---------------------------------------------------------------------------

const CompetingTheorySchema = z.object({
  assertionEn: z.string().min(1),
  assertionHe: z.string().optional().catch(""),
});

const DraftEpistemicNodeSchema = z.object({
  assertionEn: z.string().min(1).catch("Assertion unavailable"),
  assertionHe: z.string().optional().catch(""),
  logicalCoherenceScore: z.number().min(0).max(100).catch(50),
  reasoningEn: z.string().optional().catch(""),
  reasoningHe: z.string().optional().catch(""),
  hiddenAssumptionsEn: z.array(z.string()).optional().catch([]),
  hiddenAssumptionsHe: z.array(z.string()).optional().catch([]),
  challengePromptEn: z.string().optional().catch(""),
  challengePromptHe: z.string().optional().catch(""),
  matchedExistingNodeId: z.string().nullable().optional().catch(null),
  relationshipToContext: z.enum(["supports", "challenges"]).optional().catch("supports"),
  thematicTags: z.array(z.string()).max(10).optional().catch([]),
  competingTheories: z.array(CompetingTheorySchema).max(2).optional(),
});

const EpistemicTriageSchema = z.object({
  socraticMessage: z
    .string()
    .describe(
      "MANDATORY: Your warm, Socratic conversational response. Write your analysis and greeting here. Never leave empty."
    ),
});

const TriageResultNewDraftsSchema = z.array(DraftEpistemicNodeSchema).max(1);

type DraftEpistemicNode = z.infer<typeof DraftEpistemicNodeSchema>;

// ---------------------------------------------------------------------------
// Arena Drafter: neutral root title only (no RAG, no intent router)
// ---------------------------------------------------------------------------

const ARENA_DRAFTER_PROMPT = (topic: string) => `You are the Arena Architect of Mana OS. The user wants to establish a new Macro-Arena for debate.

Your task is to extract THREE things from their request:
1. The neutral Root Question of the arena (e.g. "What is the shape of the Earth?").
2. Theory A: The first main competing theory/answer.
3. Theory B: The second main competing theory/answer.

Topic or request: "${topic}"

Output requirements:
- assertionEn & assertionHe: The neutral root question only (no theory text here).
- thematicTags: MUST include "macro-arena". Add 1–2 other broad themes if relevant (e.g. Cosmology, Education).
- logicalCoherenceScore: 50 (system placeholder; the Arena is an open question and has no logical score).
- competingTheories: An array of EXACTLY 2 objects representing the opposing theories. Example:
  [
    { assertionEn: "The Earth is a spherical globe.", assertionHe: "הארץ היא כדור." },
    { assertionEn: "The Earth is a flat plane.", assertionHe: "הארץ היא מישור שטוח." }
  ]
- relationshipToContext: "supports".
- reasoningEn, reasoningHe, hiddenAssumptionsEn/He, challengePromptEn/He: empty or one-line.

Do not ask for permission. Output the JSON so the UI can render the complete Arena card with the question and the two theories.`;

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
  type ExistingNodeDisplay = Array<{ id: string; assertionEn: string; assertionHe?: string }>;
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

          const macroIds = new Set((macroRows ?? []).map((r) => r.id));
          const arenaMatches = matchList.filter((m) => macroIds.has(m.id));
          existingMatches = arenaMatches.map((m) => ({
            id: m.id,
            assertionEn: getDisplayAssertion(m.content ?? "", "en"),
            assertionHe: getDisplayAssertion(m.content ?? "", "he"),
          }));
        }
      }
    } catch (err) {
      console.error("[Arena Scout Error]", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Draft generation only when NO similar arena exists
  // ---------------------------------------------------------------------------
  let newDraftsForTriage: DraftEpistemicNode[] = [];

  if (topic.length > 0 && existingMatches.length === 0) {
    try {
      const result = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: DraftEpistemicNodeSchema,
        prompt: ARENA_DRAFTER_PROMPT(topic),
      });
      const draft = DraftEpistemicNodeSchema.parse(result.object);
      const normalized = {
        ...draft,
        logicalCoherenceScore: 50,
        thematicTags: [...new Set([...(draft.thematicTags ?? []), "macro-arena"])],
        competingTheories:
          Array.isArray(draft.competingTheories) && draft.competingTheories.length === 2
            ? draft.competingTheories
            : undefined,
      };
      newDraftsForTriage = TriageResultNewDraftsSchema.parse([normalized]);
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
