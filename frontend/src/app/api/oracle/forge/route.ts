import { convertToModelMessages, streamText, embed, generateText, generateObject } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  QUERY_EXPANSION_SYSTEM,
  buildForgeIntentPrompt,
  buildForgeDrafterPrompt,
  SOCRATES_SYSTEM,
  SOCRATIC_EDITOR_SYSTEM,
  buildForgeHandoffDraftRequest,
  buildForgeHandoffExploreChat,
  FORGE_DEBATE_SHARPEN_OVERRIDE,
  FORGE_DEBATE_SHARPEN_COACH,
  FORGE_DEBATE_CHALLENGE_OVERRIDE,
  FORGE_DEBATE_CHALLENGE_COACH,
} from "@/lib/core/prompts";
import { getDisplayAssertion } from "@/lib/utils/truthParser";
import {
  DraftEpistemicNodeV2HeForgeSchema,
  DraftEpistemicNodeV2LooseSchema,
} from "@/lib/truth/rosettaSchemas";
import { fixDraftRosettaV2Flip } from "@/lib/utils/truthRosetta";
import type { ForgeDebateIntent } from "@/types/truth";

const RAG_MATCH_THRESHOLD = 0.5;
const RAG_MATCH_COUNT = 5;

/** Minimum length of user message to run Scout (RAG). Avoids embedding short conversational replies. */
const MIN_MESSAGE_LENGTH_FOR_SCOUT = 20;

// ---------------------------------------------------------------------------
// Schemas (Rosetta Protocol V2)
// ---------------------------------------------------------------------------

/** LLM outputs only socraticMessage. Server injects existingNodesToDisplay and newDrafts in the tool execute result to avoid streaming hallucinations. */
const EpistemicTriageSchema = z.object({
  socraticMessage: z
    .string()
    .describe(
      "MANDATORY: Your warm, Socratic conversational response. Write your analysis and greeting here. Never leave empty."
    ),
});

/** Semantic Intent Router: classify user message to avoid RAG overriding draft requests. */
const IntentSchema = z.object({
  intent: z
    .enum(["EXPLORE", "DRAFT_REQUEST", "CHAT"])
    .describe(
      "EXPLORE: User is pasting new text, article, or broad claim to explore. DRAFT_REQUEST: User explicitly asks to draft/anchor/create a card for a specific claim. CHAT: User is arguing, asking a question, or conversing."
    ),
  targetClaimToDraft: z
    .string()
    .optional()
    .describe("If intent is DRAFT_REQUEST, the exact claim they want to draft. Otherwise empty."),
});

/** Weave portal lines: canonical (en) + localized (he) preview for chat UI. */
type ExistingNodeDisplay = Array<{ id: string; enLine: string; heLine: string }>;
type UserIntent = z.infer<typeof IntentSchema>["intent"];

// ---------------------------------------------------------------------------
// Prompts (Scout only; no Splitter/Drafter)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pipeline telemetry (Intent + Scout / Drafter)
// ---------------------------------------------------------------------------

interface ForgeTelemetry {
  intent: UserIntent;
  scoutMatches: number;
  expandedQueryDisplay: string;
  targetClaimToDraft?: string;
  /** Set when Drafter Swarm runs (EXPLORE multi-claim or DRAFT_REQUEST single-claim) */
  splitterClaims?: number;
  drafterProcessed?: number;
  drafterPassed?: number;
  drafterErrors?: string[];
  /** True when DRAFT_REQUEST bypassed RAG/Splitter and fed claim directly to Drafter */
  draftBypassRag?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_MESSAGE_TEXT_LENGTH = 8000;

/** Referee-only prompt for human-in-the-loop tactical strikes (prompts.ts stays untouched). */
function buildTacticalRefereeForgePrompt(claim: string, targetCtx: string, uiLocale: "he" | "en"): string {
  const safeTarget = targetCtx.replace(/"""/g, "''").slice(0, 8000);
  const safeClaim = claim.replace(/"""/g, "''").slice(0, 8000);
  const rosettaHint =
    uiLocale === "he"
      ? 'source_locale MUST be "he" with a complete local_translation (Hebrew) mirroring canonical_en.'
      : 'source_locale "en" is sufficient; local_translation optional.';

  return `You are the Epistemic Referee.

TARGET CLAIM: """${safeTarget}"""
USER'S RAW ATTACK: """${safeClaim}"""

YOUR JOB IS STRICTLY TO REFEREE THE USER'S MOVE.
1. Analyze the user's raw attack only against the target claim.
2. If the user supplied recognizable logical or empirical counter-material: extract it into a sharp Rosetta premise (canonical_en in English; ${rosettaHint}).
3. If the text is weak, off-topic, or non-counter: still produce a valid schema object that faithfully reflects what they wrote and why it fails as a refutation (in reasoning fields).
4. Categorize strictly into one epistemicMoveType: EMPIRICAL_CONTRADICTION | INTERNAL_INCONSISTENCY | EMPIRICAL_VERIFICATION | AD_HOC_RESCUE | APPEAL_TO_AUTHORITY.
   This field is REQUIRED and must never be omitted or null.
4b. CRITICAL THEORY ASSIGNMENT: output supportedTheory as THEORY_A or THEORY_B according to the side this counter-claim strengthens.
5. relationshipToContext MUST be "challenges".

FORBIDDEN: Inventing empirical facts not clearly grounded in USER'S RAW ATTACK. Structural clarification only.
FORBIDDEN: Any numeric 0–100 coherence, validity, or confidence score.

Output MUST satisfy the provided Zod schema (Rosetta V2 + epistemicMoveType + relationshipToContext).`;
}

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  if (!msg) return "";
  const parts = (msg.parts ?? [])
    .filter((p: { type: string }) => p.type === "text")
    .map((p: { text?: string }) => p.text ?? "")
    .join(" ")
    .trim();
  return (parts || (msg as { content?: string }).content || "").trim().slice(0, MAX_MESSAGE_TEXT_LENGTH);
}

function getChatPreview(messages: UIMessage[], maxMessages = 3): string {
  const slice = messages.slice(-maxMessages);
  return slice
    .map((m) => {
      const role = m.role ?? "unknown";
      const text = getMessageText(m as Parameters<typeof getMessageText>[0]);
      return `${role}: ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}`;
    })
    .join("\n");
}

export const maxDuration = 30;

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
    debateIntent?: ForgeDebateIntent;
    arenaId?: string;
    tacticalSupportedTheoryHint?: "THEORY_A" | "THEORY_B";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tacticalStrike = body.debateIntent === "TACTICAL_STRIKE";
  const tacticalSupportedTheoryHint =
    body.tacticalSupportedTheoryHint === "THEORY_A" || body.tacticalSupportedTheoryHint === "THEORY_B"
      ? body.tacticalSupportedTheoryHint
      : undefined;

  const architectMode = body.architectMode === true;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const targetNodeContext = typeof body.targetNodeContext === "string" ? body.targetNodeContext.trim() : null;
  const locale = body.locale === "he" ? "he" : "en";
  const drafterSchema =
    locale === "he"
      ? DraftEpistemicNodeV2HeForgeSchema.refine((obj) => !!obj.epistemicMoveType, {
          message: "epistemicMoveType is required for draft cards",
          path: ["epistemicMoveType"],
        })
      : DraftEpistemicNodeV2LooseSchema.refine((obj) => !!obj.epistemicMoveType, {
          message: "epistemicMoveType is required for draft cards",
          path: ["epistemicMoveType"],
        });
  const triageDraftArrSchema = z.array(drafterSchema).max(1);
  type DraftEpistemicNode = z.infer<typeof DraftEpistemicNodeV2HeForgeSchema> | z.infer<typeof DraftEpistemicNodeV2LooseSchema>;
  const debateIntent =
    body.debateIntent === "sharpens" || body.debateIntent === "challenges" ? body.debateIntent : undefined;

  if (tacticalStrike && (!targetNodeContext || targetNodeContext.length === 0)) {
    return NextResponse.json({ error: "targetNodeContext is required for TACTICAL_STRIKE" }, { status: 400 });
  }

  let debateOverride = "";
  let coachDirective = "";
  if (targetNodeContext && debateIntent) {
    if (debateIntent === "sharpens") {
      debateOverride = "\n\n" + FORGE_DEBATE_SHARPEN_OVERRIDE;
      coachDirective = FORGE_DEBATE_SHARPEN_COACH;
    } else if (debateIntent === "challenges") {
      debateOverride = "\n\n" + FORGE_DEBATE_CHALLENGE_OVERRIDE;
      coachDirective = FORGE_DEBATE_CHALLENGE_COACH;
    }
  }

  const contextBlock = targetNodeContext
    ? "\n\nThe user is interacting with the following existing claim — sharpen (upgrade) or challenge it (use this to frame your Socratic dialogue):\n---\n"
      + targetNodeContext.slice(0, 8000)
      + "\n---"
      + debateOverride
    : "";

  const userMessages = messages.filter((m: UIMessage) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const firstUserMessage = userMessages.length > 1 ? userMessages[0] : null;
  const lastUserText = lastUserMessage ? getMessageText(lastUserMessage as Parameters<typeof getMessageText>[0]) : "";
  const firstUserText = firstUserMessage ? getMessageText(firstUserMessage as Parameters<typeof getMessageText>[0]) : "";
  const hasMultipleTurns = firstUserText.length > 0 && lastUserText.length > 0 && firstUserText !== lastUserText;
  const textToEmbedBase = hasMultipleTurns ? `${firstUserText}\n\n${lastUserText}`.slice(0, 8000) : lastUserText;

  if (tacticalStrike && !lastUserText.trim()) {
    return NextResponse.json({ error: "TACTICAL_STRIKE requires a non-empty user message" }, { status: 400 });
  }

  // ========== 0. SEMANTIC INTENT ROUTER (pre-flight classification) ==========
  let userIntent: UserIntent = "CHAT";
  let claimToDraft: string | undefined;

  if (tacticalStrike && targetNodeContext && lastUserText.trim().length > 0) {
    userIntent = "DRAFT_REQUEST";
    claimToDraft = lastUserText.trim();
  } else if (lastUserText.trim().length > 0) {
    try {
      const intentResult = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: IntentSchema,
        prompt: buildForgeIntentPrompt({
          chatPreview: getChatPreview(messages),
          lastUserText,
          targetNodeContext: targetNodeContext ?? null,
          debateIntent: debateIntent ?? null,
        }),
      });
      userIntent = intentResult.object.intent;
      claimToDraft = intentResult.object.targetClaimToDraft?.trim() || undefined;
    } catch {
      userIntent = "CHAT";
    }
  }

  const telemetry: ForgeTelemetry = {
    intent: userIntent,
    scoutMatches: 0,
    expandedQueryDisplay: "",
  };
  if (claimToDraft) telemetry.targetClaimToDraft = claimToDraft.slice(0, 200);

  let existingMatches: ExistingNodeDisplay = [];
  let newClaimsToDraft: string[] = [];
  let newDraftsInjected: DraftEpistemicNode[] = [] as DraftEpistemicNode[];
  const supabase = createServerSupabase();

  // ========== DRAFT_REQUEST: Bypass RAG/Splitter — feed extracted claim directly to Drafter Swarm ==========
  if (userIntent === "DRAFT_REQUEST") {
    const claim = (claimToDraft || lastUserText).trim();
    if (claim.length > 0) {
      newClaimsToDraft = [claim];
      telemetry.splitterClaims = 1;
      telemetry.draftBypassRag = true;
    }
  }

  // ========== 1. SCOUT (RAG Portals) — EXPLORE/CHAT only ==========
  const shouldRunScout =
    userIntent !== "DRAFT_REQUEST" && lastUserText.length >= MIN_MESSAGE_LENGTH_FOR_SCOUT;
  if (shouldRunScout) {
    let expandedQueryEn = "";
    let textToEmbed = textToEmbedBase;
    try {
      const expansionResult = await generateText({
        model: google("gemini-2.5-flash"),
        system: QUERY_EXPANSION_SYSTEM,
        prompt: lastUserText,
      });
      expandedQueryEn = (expansionResult.text ?? "").trim();
      if (expandedQueryEn.length > 0) textToEmbed = expandedQueryEn;
    } catch {
      textToEmbed = lastUserText;
    }
    telemetry.expandedQueryDisplay = expandedQueryEn || "(used raw)";

    try {
      const embeddingResult = await embed({
        model: google.textEmbeddingModel("gemini-embedding-001"),
        value: textToEmbed,
        providerOptions: { google: { outputDimensionality: 768 } },
      });

      if (embeddingResult.embedding.length > 0) {
        const { data: matches } = await supabase.rpc("match_truth_nodes", {
          query_embedding: Array.from(embeddingResult.embedding),
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        } as never);

        const matchList = (matches ?? []) as Array<{ id: string; content?: string; similarity?: number }>;
        telemetry.scoutMatches = matchList.length;
        existingMatches = matchList.map((m) => ({
          id: m.id,
          enLine: getDisplayAssertion(m.content ?? "", "en"),
          heLine: getDisplayAssertion(m.content ?? "", "he"),
        }));
      }
    } catch {
      // Scout failure: continue with empty matches.
    }
  }

  // ========== 2. DRAFTER SWARM: Logician (claim drafting only) ==========
  if (newClaimsToDraft.length > 0) {
    const drafterPromises = newClaimsToDraft.map((claim) =>
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: drafterSchema,
        prompt:
          tacticalStrike && targetNodeContext
            ? buildTacticalRefereeForgePrompt(claim, targetNodeContext, locale)
            : buildForgeDrafterPrompt({
                claim,
                existingMatchesPreview: existingMatches.length > 0 ? JSON.stringify(existingMatches.slice(0, 3)) : undefined,
                locale,
                targetNodeContext: targetNodeContext ?? null,
                debateIntent: debateIntent ?? null,
              }),
      })
    );
    const results = await Promise.allSettled(drafterPromises);
    const drafts: DraftEpistemicNode[] = [];
    const errors: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        errors.push(`claim ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        continue;
      }
      const parsed = drafterSchema.safeParse(r.value.object);
      if (!parsed.success) {
        errors.push(`claim ${i + 1}: invalid schema — ${parsed.error.issues.map((x: { message: string }) => x.message).join("; ")}`);
        continue;
      }
      const flipped = fixDraftRosettaV2Flip(parsed.data) as DraftEpistemicNode;
      const withTacticalRel = tacticalStrike
        ? ({
            ...flipped,
            relationshipToContext: "challenges" as const,
            supportedTheory: tacticalSupportedTheoryHint ?? flipped.supportedTheory,
          } satisfies DraftEpistemicNode)
        : debateIntent === "sharpens"
          ? ({ ...flipped, relationshipToContext: "sharpens" as const } satisfies DraftEpistemicNode)
          : flipped;
      drafts.push(withTacticalRel);
    }
    telemetry.drafterProcessed = newClaimsToDraft.length;
    telemetry.drafterPassed = drafts.length;
    if (errors.length > 0) telemetry.drafterErrors = errors;
    newDraftsInjected = triageDraftArrSchema.parse(drafts);
  }

  const newDraftsForTriage = triageDraftArrSchema.parse(newDraftsInjected);

  // ========== 3. HANDOFF → Socrates (intent-specific system prompt) ==========
  const handoffBlock =
    userIntent === "DRAFT_REQUEST"
      ? buildForgeHandoffDraftRequest(newDraftsForTriage)
      : buildForgeHandoffExploreChat(existingMatches, coachDirective);

  const dynamicSystemPrompt =
    userIntent === "DRAFT_REQUEST" ? SOCRATIC_EDITOR_SYSTEM : SOCRATES_SYSTEM;
  const systemPrompt = `${dynamicSystemPrompt}${contextBlock}\n\n${handoffBlock}`;

  const epistemicTriageTool = {
    description:
      "MANDATORY: Call this once to render the UI. Populate socraticMessage only. The server injects Portals and draft cards into the result.",
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

  const forgeTools = { epistemic_triage: epistemicTriageTool };

  try {
    const result = streamText({
      model: google("gemini-2.5-pro"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: forgeTools }),
      tools: forgeTools,
      toolChoice: "required",
      temperature: 0.45,
      providerOptions: { google: { maxOutputTokens: 8192 } },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (err) => {
        console.error("[Oracle Forge stream]", err);
        return err instanceof Error ? err.message : String(err);
      },
    });

    if (!architectMode) return response;

    const TELEMETRY_STREAM_ID = "swarm-telemetry";
    const telemetryPayload = `[SWARM_TELEMETRY]:${JSON.stringify(telemetry)}\n\n`;
    let telemetryInjected = false;
    const encoder = new TextEncoder();
    const toSseChunk = (obj: object) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (!telemetryInjected) {
          telemetryInjected = true;
          controller.enqueue(toSseChunk({ type: "text-start", id: TELEMETRY_STREAM_ID }));
          controller.enqueue(toSseChunk({ type: "text-delta", id: TELEMETRY_STREAM_ID, delta: telemetryPayload }));
          controller.enqueue(toSseChunk({ type: "text-end", id: TELEMETRY_STREAM_ID }));
        }
        controller.enqueue(chunk);
      },
    });

    return new Response(response.body?.pipeThrough(transform) ?? null, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error("[Oracle Forge API]", err);
    return NextResponse.json(
      { error: "Epistemic Forge failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
