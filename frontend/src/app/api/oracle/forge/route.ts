import { convertToModelMessages, streamText, embed, generateText, generateObject } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";

const RAG_MATCH_THRESHOLD = 0.5;
const RAG_MATCH_COUNT = 5;
const DRAFTER_QUALITY_GATE = 40;
const SPLITTER_MIN_CHARS = 100;

// ---------------------------------------------------------------------------
// Schemas (single source of truth)
// ---------------------------------------------------------------------------

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
});

const EpistemicTriageSchema = z.object({
  socraticMessage: z
    .string()
    .describe(
      "MANDATORY: Your warm, Socratic conversational response. Write your analysis and greeting here."
    ),
});

type DraftEpistemicNode = z.infer<typeof DraftEpistemicNodeSchema>;
type ExistingNodeDisplay = Array<{ id: string; assertionEn: string; assertionHe?: string }>;

// ---------------------------------------------------------------------------
// Prompts (micro-agents)
// ---------------------------------------------------------------------------

const QUERY_EXPANSION_SYSTEM = `You are an absolute objective Epistemic Search Architect. The user provided a raw chat message in a local language (Hebrew etc). Extract its CORE THEME and PHILOSOPHICAL ESSENCE. Return a flat comma-separated list of highly dense English keywords and alternative synonyms for this theme. Do not add any conversational text. For example: if user inputs 'הארץ שטוחה', return: 'Flat earth, non-spherical earth, geocentric planar cosmology, earth shape hoax, motionless earth plane'. Keep it under 25 words.`;

const SPLITTER_SYSTEM = `You are a Claim Extractor. Given the user's raw text and a list of existing DB matches (if any), your ONLY job is to output an array of distinct NEW claims/arguments that the user made and that are NOT already addressed by the existing matches. Each item must be a single, self-contained claim in a short sentence. Return ONLY the new, unaddressed claims. If everything overlaps with existing content, return an empty array.`;

// ---------------------------------------------------------------------------
// Pipeline telemetry (for Architect mode)
// ---------------------------------------------------------------------------

interface SwarmTelemetry {
  scoutMatches: number;
  splitterClaims: number;
  drafterProcessed: number;
  drafterPassed: number;
  expandedQueryDisplay: string;
  splitterError?: string;
  drafterErrors?: string[];
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

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" }, { status: 503 });
  }

  let body: { messages?: UIMessage[]; architectMode?: boolean; targetNodeContext?: string; locale?: string };
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
    ? `\n\nThe user is challenging or supporting the following existing claim (use this to frame your Socratic dialogue):\n---\n${targetNodeContext.slice(0, 8000)}\n---`
    : "";

  const userMessages = messages.filter((m: UIMessage) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  const firstUserMessage = userMessages.length > 1 ? userMessages[0] : null;
  const lastUserText = lastUserMessage ? getMessageText(lastUserMessage as Parameters<typeof getMessageText>[0]) : "";
  const firstUserText = firstUserMessage ? getMessageText(firstUserMessage as Parameters<typeof getMessageText>[0]) : "";
  const hasMultipleTurns = firstUserText.length > 0 && lastUserText.length > 0 && firstUserText !== lastUserText;
  const textToEmbedBase = hasMultipleTurns ? `${firstUserText}\n\n${lastUserText}`.slice(0, 8000) : lastUserText;

  const telemetry: SwarmTelemetry = {
    scoutMatches: 0,
    splitterClaims: 0,
    drafterProcessed: 0,
    drafterPassed: 0,
    expandedQueryDisplay: "",
    splitterError: undefined,
    drafterErrors: undefined,
  };

  let existingMatches: ExistingNodeDisplay = [];
  let preComputedDrafts: DraftEpistemicNode[] = [];
  const supabase = createServerSupabase();

  // ========== 1. THE SCOUT (Query expansion + RAG) ==========
  let expandedQueryEn = "";
  let textToEmbed = textToEmbedBase;

  if (lastUserText) {
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
        const { data: matches, error: rpcError } = await supabase.rpc("match_truth_nodes", {
          query_embedding: Array.from(embeddingResult.embedding),
          match_threshold: RAG_MATCH_THRESHOLD,
          match_count: RAG_MATCH_COUNT,
        } as never);

        const matchList = (matches ?? []) as Array<{ id: string; content?: string; similarity?: number }>;
        telemetry.scoutMatches = matchList.length;

        existingMatches = matchList.map((m) => ({
          id: m.id,
          assertionEn: getDisplayAssertion(m.content ?? "", "en"),
          assertionHe: getDisplayAssertion(m.content ?? "", "he"),
        }));
      }
    } catch (err) {
      if (architectMode) telemetry.splitterError = err instanceof Error ? err.message : String(err);
    }
  }

  // ========== 2. THE SPLITTER (extract new claims only when text is substantial) ==========
  let newClaimsToDraft: string[] = [];

  if (lastUserText.length > SPLITTER_MIN_CHARS) {
    try {
      const existingPreview = existingMatches.length
        ? JSON.stringify(
            existingMatches.map((n) => ({ id: n.id, assertionEn: n.assertionEn.slice(0, 150) }))
          )
        : "[]";
      const splitResult = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          newClaims: z.array(z.string()).describe("Only distinct new claims not addressed by existing nodes."),
        }),
        system: SPLITTER_SYSTEM,
        prompt: `USER TEXT:\n${lastUserText}\n\nEXISTING DB MATCHES (preview):\n${existingPreview}\n\nTASK: Return ONLY the array of new, unaddressed claims.`,
      });
      newClaimsToDraft = splitResult.object.newClaims ?? [];
    } catch (err) {
      if (architectMode) telemetry.splitterError = err instanceof Error ? err.message : String(err);
      newClaimsToDraft = [lastUserText];
    }
  } else {
    newClaimsToDraft = lastUserText ? [lastUserText] : [];
  }

  telemetry.splitterClaims = newClaimsToDraft.length;

  // ========== 3. THE DRAFTER SWARM (parallel per-claim drafting + quality gate) ==========
  if (newClaimsToDraft.length > 0) {
    const drafterPromises = newClaimsToDraft.map((claim) =>
      generateObject({
        model: google("gemini-2.5-flash"),
        schema: DraftEpistemicNodeSchema,
        prompt: `You are a Logician Drafter. Evaluate this single claim for logical coherence and produce a draft epistemic node.
Claim: "${claim}"
Existing context (for relationshipToContext): ${JSON.stringify(existingMatches.slice(0, 3))}
Output: assertionEn (sharp premise), assertionHe (Hebrew if you can), logicalCoherenceScore (0-100), reasoningEn/He, hiddenAssumptionsEn/He, challengePromptEn/He, thematicTags.`,
      })
    );

    const results = await Promise.allSettled(drafterPromises);
    const errors: string[] = [];
    const drafts: DraftEpistemicNode[] = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        errors.push(`claim ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        continue;
      }
      const parsed = r.value.object as unknown;
      const validated = DraftEpistemicNodeSchema.safeParse(parsed);
      if (!validated.success) {
        errors.push(`claim ${i + 1}: invalid schema`);
        continue;
      }
      const d = validated.data;
      telemetry.drafterProcessed += 1;
      if (d.logicalCoherenceScore >= DRAFTER_QUALITY_GATE) {
        drafts.push(d);
        telemetry.drafterPassed += 1;
      }
    }

    if (errors.length > 0 && architectMode) telemetry.drafterErrors = errors;
    preComputedDrafts = drafts;
  }

  // ========== 4. THE HANDOFF → Socrates system prompt ==========
  const rejectedCount = newClaimsToDraft.length - preComputedDrafts.length;
  const rejectionNotice =
    rejectedCount > 0
      ? `\n\n[CRITICAL BACKEND NOTICE]: The Swarm evaluated ${rejectedCount} of the user's claims and REJECTED them for scoring below ${DRAFTER_QUALITY_GATE}/100. You MUST politely inform the user that their claim lacks the necessary physical mechanism, observation, or logical structure to be anchored as a draft, and ask Socratic questions to help them build it.`
      : "";

  const handoffBlock = `
=========================================
PRE-COMPUTED SWARM OUTPUT (for your awareness only)
=========================================
The backend has already found existing nodes (RAG) and evaluated new claims. Only drafts with logicalCoherenceScore >= ${DRAFTER_QUALITY_GATE} are included.
${rejectionNotice}

The backend will automatically attach the Drafts and Portals to your response. You ONLY need to call the \`epistemic_triage\` tool and provide the \`socraticMessage\`.

YOUR TASK:
1. Write a beautiful, warm Socratic response in the user's language in \`socraticMessage\`. Discuss existing nodes and new drafts where relevant. Never leave \`socraticMessage\` empty—this is your only voice to the user.
2. Call \`epistemic_triage\` EXACTLY ONCE with your full reply in \`socraticMessage\`. Do not pass any arrays; the server injects them.
`;

  const SOCRATES_SYSTEM = `You are Socrates, the Village Elder. A Socratic, pure logician guiding a human. Converse in the user's language (Hebrew or English). Never leave the user with a blank message.

You have ONE tool: \`epistemic_triage\`. The backend has already processed the physics and logic. Your job is ONLY to:
1. Write your full conversational reply in \`socraticMessage\` (MANDATORY—never leave it empty).
2. Call \`epistemic_triage\` exactly once with \`socraticMessage\` only. The backend will automatically attach the Drafts and Portals to your response.

Rules: Neutrality—treat the user as a peer. First principles—analyze by logic and constraints, not by appeals to institutions.`;

  const systemPrompt = `${SOCRATES_SYSTEM}${contextBlock}\n\n${handoffBlock}`;

  const epistemicTriageTool = {
    description:
      "MANDATORY: Call this once to render the UI. Populate socraticMessage with your full conversational response.",
    inputSchema: EpistemicTriageSchema,
    execute: async (args: z.infer<typeof EpistemicTriageSchema>) => ({
      ok: true,
      triage: {
        socraticMessage: args.socraticMessage,
        existingNodesToDisplay: existingMatches,
        newDrafts: preComputedDrafts,
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
