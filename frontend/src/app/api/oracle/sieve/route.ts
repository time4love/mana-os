/**
 * POST /api/oracle/sieve
 *
 * Transcript Sieve (Bulk Ingestion & Theory Alignment).
 * Agentic Swarm: Extractor → Logician & Aligner (per claim in parallel).
 * Does NOT write to DB; returns processed claims for the Harvest Dashboard.
 *
 * Body: { transcript, arenaId, theoryA, theoryB, locale? }
 * Rosetta Protocol: assertionEn = Universal English (vector math); assertionHe = display in user language.
 */

import { NextResponse } from "next/server";
import { generateObject, embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SieveProcessedClaim, SieveSupportedTheory, SieveTelemetry } from "@/types/truth";

/** English-to-English semantic match (Rosetta Protocol: DB vectors are assertionEn). */
const SIEVE_SCOUT_THRESHOLD = 0.8;
const SIEVE_SCOUT_MATCH_COUNT = 1;

const MAX_TRANSCRIPT_LENGTH = 500_000;
const MAX_CLAIMS_TO_PROCESS = 10;

/** Agent 1: Context-aware extractor output (arena theories injected into prompt). */
const ExtractorClaimsSchema = z.object({
  claims: z.array(z.string()).max(MAX_CLAIMS_TO_PROCESS).describe("Core logical arguments that directly support, attack, or relate to Theory A or Theory B"),
});

function buildExtractorPrompt(transcript: string, theoryA: string, theoryB: string): string {
  return `You are the Epistemic Extractor for a specific debate arena.

THEORY A: "${theoryA}"
THEORY B: "${theoryB}"

Analyze the following transcript strictly through the lens of this debate.
Extract ONLY the core logical arguments that directly support, attack, or actively relate to Theory A or Theory B.
DO NOT atomize the text into trivial micro-facts, background stories, or conversational filler.
If the speaker is using rhetorical sarcasm (e.g., "The plane WOULD need to dip, but it doesn't"), extract the actual underlying argument ("The lack of a 9.5-mile dip proves the Earth is not a curved globe").
Combine premises with their conclusions into robust, standalone claims.
Target 3 to 8 high-quality, comprehensive arguments.

TRANSCRIPT:
"${transcript.slice(0, 500_000)}"`;
}

const BodySchema = z.object({
  transcript: z.string().min(1).max(MAX_TRANSCRIPT_LENGTH),
  arenaId: z.string().uuid(),
  theoryA: z.string().min(1),
  theoryB: z.string().min(1),
  locale: z.enum(["he", "en"]).optional().default("en"),
});

/** Map request locale to language name for prompts (expandable: fr → French, etc.). */
function localeToUserLanguage(locale: string): string {
  switch (locale) {
    case "he":
      return "Hebrew";
    case "en":
    default:
      return "English";
  }
}

const LogicianAlignerSchema = z.object({
  assertionEn: z.string().describe("Universal English: the core logical premise for vector math and cross-language deduplication"),
  assertionHe: z.string().describe("Exact translation of assertionEn into the user's display language (Hebrew, English, etc.)"),
  logicalCoherenceScore: z.number().min(0).max(100),
  supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]),
  reasoning: z.string(),
  matchedExistingNodeId: z.string().nullable().optional().describe("Set by server after Scout RAG; not emitted by Logician"),
});

/** Schema for Logician LLM output only (Scout sets matchedExistingNodeId server-side). */
const LogicianOutputSchema = LogicianAlignerSchema.omit({ matchedExistingNodeId: true });

function buildLogicianAlignerPrompt(
  claim: string,
  theoryA: string,
  theoryB: string,
  userLanguage: string
): string {
  return `You are the Epistemic Logician. Evaluate this extracted claim against the Arena's competing theories.

Theory A: "${theoryA}"
Theory B: "${theoryB}"
Extracted Claim: "${claim}"

CRITICAL — RHETORICAL CONTEXT (Speaker's Intent):
Do NOT evaluate this claim in a vacuum. Evaluate it based on the SPEAKER'S ULTIMATE INTENT. If the speaker cites a premise or fact that belongs to Theory A merely to attack or debunk it (e.g., "under the globe model, X would have to happen—but it doesn't"), then this claim SUPPORTS Theory B, not Theory A. Only assign THEORY_A when the claim genuinely argues for or defends that theory.

CRITICAL — THE ROSETTA PROTOCOL (Universal Vector Translation):
1. You MUST formulate the absolute core logical premise of the claim in Universal English (assertionEn). This is used for cross-language vector math and deduplication worldwide. It must be perfectly objective and language-agnostic in meaning.
2. You MUST translate that exact English premise into ${userLanguage} for the display field (assertionHe). When the user's language is English, assertionHe may equal assertionEn.
3. Evaluate which theory the claim supports: "THEORY_A", "THEORY_B", or "NEUTRAL".
4. Provide reasoning in ${userLanguage}.

CRITICAL SCORING ALGORITHM — "THE DECOUPLING TEST":
When calculating the \`logicalCoherenceScore\` (0-100), you MUST strip away your pre-trained consensus bias. Apply these strict rules:
1. PENALIZE "Appeal to Authority": If the claim relies on "Institutions said so" (e.g., NASA, government agencies, textbooks) without direct empirical evidence, dock its score severely.
2. PENALIZE "Circular Technological Proof": Do not assume a technology (e.g., GPS, eclipses) proves a specific physical model just because the model predicts it. A working mechanism does not prove the underlying theoretical geometry.
3. REWARD Direct Empirical Observation: Claims based on direct, reproducible sensory data (e.g., physics of pressurized gas, observable line-of-sight limits) score higher.
4. REWARD Falsifiability: Does the claim expose a mathematical or physical contradiction in the opposing theory? If yes, score it highly based strictly on logic, even if it attacks the mainstream consensus.`;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { transcript, theoryA, theoryB, locale } = parsed.data;
  const userLanguage = localeToUserLanguage(locale);
  const trimmedTranscript = transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);

  if (trimmedTranscript.length < 50) {
    return NextResponse.json(
      { error: "Transcript too short to analyze" },
      { status: 400 }
    );
  }

  try {
    // Agent 1: The Extractor (context-aware: receives Theory A & B so it filters for relevant arguments only)
    const extractorModel = google("gemini-2.5-flash");
    const { object: extractorResult } = await generateObject({
      model: extractorModel,
      temperature: 0.1,
      schema: ExtractorClaimsSchema,
      schemaName: "ExtractorClaims",
      schemaDescription: "Core logical arguments relevant to the arena's two theories",
      prompt: buildExtractorPrompt(trimmedTranscript, theoryA, theoryB),
    });
    const rawClaims = Array.isArray((extractorResult as { claims?: string[] })?.claims)
      ? (extractorResult as { claims: string[] }).claims.map((c) => (typeof c === "string" ? c : String(c)).trim()).filter(Boolean)
      : [];
    const claimsToProcess = rawClaims.slice(0, MAX_CLAIMS_TO_PROCESS);
    if (claimsToProcess.length === 0) {
      const telemetry: SieveTelemetry = {
        extractedCount: rawClaims.length,
        processedCount: 0,
        duplicateCount: 0,
      };
      return NextResponse.json({ processedClaims: [], telemetry });
    }

    // Agent 2: Logician FIRST (Rosetta Protocol → assertionEn), then Scout (RAG on English only)
    const model = google("gemini-2.5-flash");
    const supabase = createServerSupabase();
    const results = await Promise.all(
      claimsToProcess.map(async (claim): Promise<SieveProcessedClaim> => {
        // 1. Logician first: get Universal English (assertionEn) for vector math
        const { object: logicianObject } = await generateObject({
          model,
          temperature: 0.1,
          schema: LogicianOutputSchema,
          schemaName: "LogicianAligner",
          schemaDescription: "Claim normalized, scored, and aligned to Theory A or B",
          prompt: buildLogicianAlignerPrompt(claim, theoryA, theoryB, userLanguage),
        });

        const o = logicianObject as z.infer<typeof LogicianAlignerSchema>;
        const assertionEn = (o.assertionEn ?? claim).trim().slice(0, 4000);
        const assertionHe = (o.assertionHe ?? o.assertionEn ?? claim).trim().slice(0, 4000);
        const logicalCoherenceScore =
          typeof o.logicalCoherenceScore === "number"
            ? Math.max(0, Math.min(100, o.logicalCoherenceScore))
            : 50;
        const supportedTheory = (o.supportedTheory ?? "NEUTRAL") as SieveSupportedTheory;
        const reasoning = (o.reasoning ?? "").trim().slice(0, 2000);

        // 2. Scout (RAG) using assertionEn only — English-to-English deduplication (Rosetta Protocol)
        let matchedNodeId: string | null = null;
        try {
          const embeddingResult = await embed({
            model: google.textEmbeddingModel("gemini-embedding-001"),
            value: assertionEn,
            providerOptions: { google: { outputDimensionality: 768 } },
          });
          if (embeddingResult.embedding.length > 0) {
            const { data: matches } = await supabase.rpc("match_truth_nodes", {
              query_embedding: Array.from(embeddingResult.embedding),
              match_threshold: SIEVE_SCOUT_THRESHOLD,
              match_count: SIEVE_SCOUT_MATCH_COUNT,
            } as never);
            const matchList = (matches ?? []) as Array<{ id: string }>;
            if (matchList.length > 0 && matchList[0].id) {
              matchedNodeId = matchList[0].id;
            }
          }
        } catch (err) {
          console.error("[Sieve Scout Error]", err);
        }

        return {
          assertionEn,
          assertionHe,
          logicalCoherenceScore,
          supportedTheory,
          reasoning,
          matchedExistingNodeId: matchedNodeId,
        };
      })
    );

    const duplicateCount = results.filter((r) => r.matchedExistingNodeId != null).length;
    const telemetry: SieveTelemetry = {
      extractedCount: rawClaims.length,
      processedCount: results.length,
      duplicateCount,
    };
    return NextResponse.json({ processedClaims: results, telemetry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Sieve API]", err);
    return NextResponse.json(
      { error: "Sieve processing failed", detail: message },
      { status: 500 }
    );
  }
}
