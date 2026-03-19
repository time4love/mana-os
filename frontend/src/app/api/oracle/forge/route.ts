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
  SOVEREIGN_OVERRIDE_SYSTEM,
  buildForgeHandoffDraftRequest,
  buildForgeHandoffExploreChat,
  FORGE_DEBATE_SUPPORT_OVERRIDE,
  FORGE_DEBATE_SUPPORT_COACH,
  FORGE_DEBATE_CHALLENGE_OVERRIDE,
  FORGE_DEBATE_CHALLENGE_COACH,
} from "@/lib/core/prompts";
import { getDisplayAssertion } from "@/lib/utils/truthParser";
import {
  DraftEpistemicNodeV2HeForgeSchema,
  DraftEpistemicNodeV2LooseSchema,
} from "@/lib/truth/rosettaSchemas";
import { fixDraftRosettaV2Flip } from "@/lib/utils/truthRosetta";

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
    debateIntent?: "supports" | "challenges";
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
  const drafterSchema = locale === "he" ? DraftEpistemicNodeV2HeForgeSchema : DraftEpistemicNodeV2LooseSchema;
  const triageDraftArrSchema = z.array(drafterSchema).max(1);
  type DraftEpistemicNode = z.infer<typeof drafterSchema>;
  const debateIntent = body.debateIntent === "supports" || body.debateIntent === "challenges" ? body.debateIntent : undefined;

  let debateOverride = "";
  let coachDirective = "";
  if (targetNodeContext && debateIntent) {
    if (debateIntent === "supports") {
      debateOverride = "\n\n" + FORGE_DEBATE_SUPPORT_OVERRIDE;
      coachDirective = FORGE_DEBATE_SUPPORT_COACH;
    } else if (debateIntent === "challenges") {
      debateOverride = "\n\n" + FORGE_DEBATE_CHALLENGE_OVERRIDE;
      coachDirective = FORGE_DEBATE_CHALLENGE_COACH;
    }
  }

  const contextBlock = targetNodeContext
    ? "\n\nThe user is challenging or supporting the following existing claim (use this to frame your Socratic dialogue):\n---\n"
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

  // ========== 0. SEMANTIC INTENT ROUTER (pre-flight classification) ==========
  let userIntent: UserIntent = "CHAT";
  let claimToDraft: string | undefined;

  if (lastUserText.trim().length > 0) {
    try {
      const intentResult = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: IntentSchema,
        prompt: buildForgeIntentPrompt(getChatPreview(messages), lastUserText),
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
        prompt: buildForgeDrafterPrompt({
          claim,
          existingMatchesPreview: JSON.stringify(existingMatches.slice(0, 3)),
          locale,
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
        errors.push(`claim ${i + 1}: invalid schema — ${parsed.error.issues.map((x) => x.message).join("; ")}`);
        continue;
      }
      drafts.push(fixDraftRosettaV2Flip(parsed.data) as DraftEpistemicNode);
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
    userIntent === "DRAFT_REQUEST" ? SOVEREIGN_OVERRIDE_SYSTEM : SOCRATES_SYSTEM;
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
