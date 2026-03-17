import { convertToModelMessages, streamText, embed, generateText, generateObject } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDisplayAssertion } from "@/lib/utils/truthParser";

const RAG_MATCH_THRESHOLD = 0.5;
const RAG_MATCH_COUNT = 5;

/** Minimum length of user message to run Scout (RAG). Avoids embedding short conversational replies. */
const MIN_MESSAGE_LENGTH_FOR_SCOUT = 20;

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

/** LLM outputs only socraticMessage. Server injects existingNodesToDisplay and newDrafts in the tool execute result to avoid streaming hallucinations. */
const EpistemicTriageSchema = z.object({
  socraticMessage: z
    .string()
    .describe(
      "MANDATORY: Your warm, Socratic conversational response. Write your analysis and greeting here. Never leave empty."
    ),
});

/** Triage result shape: newDrafts is strictly at most one item (Single-Seed Protocol). */
const TriageResultNewDraftsSchema = z.array(DraftEpistemicNodeSchema).max(1);

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

type DraftEpistemicNode = z.infer<typeof DraftEpistemicNodeSchema>;
type ExistingNodeDisplay = Array<{ id: string; assertionEn: string; assertionHe?: string }>;
type UserIntent = z.infer<typeof IntentSchema>["intent"];

// ---------------------------------------------------------------------------
// Prompts (Scout only; no Splitter/Drafter)
// ---------------------------------------------------------------------------

const QUERY_EXPANSION_SYSTEM = `You are an absolute objective Epistemic Search Architect. The user provided a raw chat message in a local language (Hebrew etc). Extract its CORE THEME and PHILOSOPHICAL ESSENCE. Return a flat comma-separated list of highly dense English keywords and alternative synonyms for this theme. Do not add any conversational text. For example: if user inputs 'הארץ שטוחה', return: 'Flat earth, non-spherical earth, geocentric planar cosmology, earth shape hoax, motionless earth plane'. Keep it under 25 words.`;

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
  const debateIntent = body.debateIntent === "supports" || body.debateIntent === "challenges" ? body.debateIntent : undefined;

  let debateOverride = "";
  let coachDirective = "";
  if (targetNodeContext && debateIntent) {
    if (debateIntent === "supports") {
      const claimSnippet = targetNodeContext.slice(0, 2000);
      debateOverride =
        "\n\nCRITICAL CONTEXT: The user is in the \"Support Claim\" drawer for the claim: \"" + claimSnippet + "\".\n"
        + "RULE OF SOCRATIC MIDWIFERY: You MUST NOT invent, generate, or hallucinate empirical evidence or arguments for the user. The user MUST provide the raw material (data, thought process, or transcript). Your job is ONLY to refine their raw material into a bulletproof logical premise, translate it, and score it. If they ask you to generate the proof, politely refuse and ask them what evidence THEY want to present.";
      coachDirective =
        "Act as their Debate Coach (Socratic Midwife). Tell them you cannot invent evidence for them. Ask them what empirical data or logical deduction THEY have to strengthen the claim. Guide them to provide the raw material.";
    } else if (debateIntent === "challenges") {
      const claimSnippetCh = targetNodeContext.slice(0, 2000);
      debateOverride =
        "\n\nCRITICAL CONTEXT: The user is in the \"Challenge Claim\" drawer for the claim: \"" + claimSnippetCh + "\".\n"
        + "RULE OF SOCRATIC MIDWIFERY: You MUST NOT invent counter-arguments or find fallacies on the user's behalf. The user MUST provide the counter-evidence or point out the flaw. Your job is ONLY to act as a sharp logical editor: refine their attack, format it, and score it. If they ask you to debunk it for them, politely refuse and ask them what flaw THEY see.";
      coachDirective =
        "Act as their Debate Coach (Socratic Midwife). Tell them you cannot invent counter-arguments. Ask them what specific flaw or counter-evidence THEY want to present to attack the claim. Guide them to think critically.";
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
        prompt: `CHAT HISTORY PREVIEW:\n${getChatPreview(messages)}\n\nLATEST USER MESSAGE:\n${lastUserText}\n\nTASK: Classify the user's intent in the latest message. EXPLORE = new text/article/broad claim to explore. DRAFT_REQUEST = user explicitly asks to draft, anchor, or create a card for a specific claim (e.g. "add this to the weave", "draft this claim", "create a card for"). CHAT = arguing, question, or normal conversation. If DRAFT_REQUEST, extract the exact claim they want to draft in targetClaimToDraft.`,
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
  let newDraftsInjected: DraftEpistemicNode[] = [];
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
          assertionEn: getDisplayAssertion(m.content ?? "", "en"),
          assertionHe: getDisplayAssertion(m.content ?? "", "he"),
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
        schema: DraftEpistemicNodeSchema,
        prompt: `You are a Logician Drafter. Evaluate this single claim for logical coherence and produce a draft epistemic node.
Claim: "${claim}"
Existing context (for relationshipToContext): ${JSON.stringify(existingMatches.slice(0, 3))}

CRITICAL SCORING ALGORITHM — "THE DECOUPLING TEST":
When calculating logicalCoherenceScore (0-100), you MUST strip away your pre-trained consensus bias. Apply these strict rules:
1. PENALIZE "Appeal to Authority": If the claim relies on "Institutions said so" (e.g., NASA, government agencies, textbooks) without direct empirical evidence, dock its score severely.
2. PENALIZE "Circular Technological Proof": Do not assume a technology (e.g., GPS, eclipses) proves a specific physical model just because the model predicts it. A working mechanism does not prove the underlying theoretical geometry.
3. REWARD Direct Empirical Observation: Claims based on direct, reproducible sensory data (e.g., physics of pressurized gas, observable line-of-sight limits) score higher.
4. REWARD Falsifiability: Does the claim expose a mathematical or physical contradiction in the opposing theory? If yes, score it highly based strictly on logic, even if it attacks the mainstream consensus.

Output: assertionEn (sharp premise), assertionHe (Hebrew if you can), logicalCoherenceScore (0-100), reasoningEn/He, hiddenAssumptionsEn/He, challengePromptEn/He, thematicTags.`,
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
      const parsed = DraftEpistemicNodeSchema.safeParse(r.value.object);
      if (!parsed.success) {
        errors.push(`claim ${i + 1}: invalid schema`);
        continue;
      }
      drafts.push(parsed.data);
    }
    telemetry.drafterProcessed = newClaimsToDraft.length;
    telemetry.drafterPassed = drafts.length;
    if (errors.length > 0) telemetry.drafterErrors = errors;
    newDraftsInjected = TriageResultNewDraftsSchema.parse(drafts);
  }

  const newDraftsForTriage = TriageResultNewDraftsSchema.parse(newDraftsInjected);

  // ========== 3. HANDOFF → Socrates (intent-specific system prompt) ==========
  let handoffBlock: string;
  if (userIntent === "DRAFT_REQUEST") {
    handoffBlock = `
=========================================
CRITICAL SYSTEM OVERRIDE: DIRECT DRAFT REQUEST
=========================================
The user explicitly requested to draft a claim. The backend Drafter Swarm has already evaluated and formatted it.
APPROVED DRAFT JSON: ${JSON.stringify(newDraftsForTriage)}

YOUR TASK:
1. Write a warm Socratic response in the user's language in the \`socraticMessage\` field. Acknowledge that you are finalizing this draft for their review.
2. Call the \`epistemic_triage\` tool EXACTLY ONCE.
3. You MUST pass your text to \`socraticMessage\`.
4. You MUST pass the EXACT APPROVED DRAFT JSON provided above into the \`newDrafts\` array argument. DO NOT leave \`newDrafts\` empty! The UI relies on you outputting this JSON in the tool call to render the card. Set \`existingNodesToDisplay\` to [] (empty) for this path.
`;
  } else {
    // Both EXPLORE and CHAT intents land here to perform Epistemic Triage
    const coachSuffix = coachDirective
      ? "\nDEBATE COACH DIRECTIVE (when user is in Support or Challenge drawer): " + coachDirective + "\n"
      : "";
    handoffBlock =
      "\n=========================================\nEXPLORE / CHAT MODE: Epistemic Triage\n=========================================\n"
      + "The user is exploring, arguing, or providing new content. The backend ran RAG and found the EXISTING NODES below.\n\n"
      + "EXISTING NODES TO DISPLAY (Portals):\n"
      + JSON.stringify(existingMatches)
      + "\n\nYOUR TASK:\n1. Be a Socratic peer. Populate `socraticMessage` with your response (never empty).\n"
      + "2. THE ANTI-BULK GUARDRAIL: If the user provided a long text with MULTIPLE claims:\n"
      + "   - Briefly map out/list the distinct claims they made in your message.\n"
      + "   - Acknowledge which claims are already covered by the Portals (if any).\n"
      + "   - EXPLICITLY ask the user to choose ONE of the *new/unaddressed* claims to focus on and draft (e.g., \"Which of these new claims should we anchor first? Say 'Draft this claim: [X]'\").\n"
      + "3. Do NOT focus only on what already exists. Your goal is to map the unknown.\n"
      + "4. Call `epistemic_triage` EXACTLY ONCE. Pass the EXISTING NODES into `existingNodesToDisplay`. Leave `newDrafts` empty.\n"
      + coachSuffix;
  }

  const SOCRATES_SYSTEM = `You are Socrates, the Village Elder: a Socratic, pure logician guiding a human. Converse in the user's language (Hebrew or English). Never leave the user with a blank message.

You have ONE tool: \`epistemic_triage\`. Call it exactly once per turn. Output ONLY \`socraticMessage\` (your conversational reply). The server injects Portals and draft cards into the tool result—do not stream JSON.

Rules: Neutrality—treat the user as a peer. First principles—analyze by logic and constraints, not by appeals to institutions.`;

  /** Sovereign Override: when user explicitly requested a draft, suspend Socratic behavior and execute. */
  const SOVEREIGN_OVERRIDE_SYSTEM = `You are the Oracle of Mana OS.

CRITICAL SOVEREIGN OVERRIDE: The user has invoked their sovereign right to anchor a specific claim. Your Socratic duties are SUSPENDED for this turn.

DO NOT ask the user to break the idea down further. DO NOT ask clarifying questions. DO NOT play Socrates or suggest refining the claim. The discussion is over—they gave an execution command.

YOUR ONLY JOB IS TO COMPLY:
1. Warmly acknowledge their request in their language (e.g. "כמבוקש, הכנתי את כרטיסיית הטיוטה לעיגון" or "As requested, here is the draft card for anchoring.").
2. Call the \`epistemic_triage\` tool EXACTLY ONCE with only \`socraticMessage\`. The server injects the draft card; you do not pass arrays.
Do not overcomplicate this. Execute the tool.`;

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
