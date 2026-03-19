/**
 * POST /api/oracle/sieve
 *
 * Transcript Sieve (Bulk Ingestion & Theory Alignment).
 * Agentic Swarm: Extractor → Logician & Aligner (per claim in parallel).
 * Does NOT write to DB; returns processed claims for the Harvest Dashboard.
 *
 * Body: { transcript, arenaId, theoryA, theoryB, locale? }
 * Rosetta Protocol V2: canonical_en for vectors; locales for display.
 */

import { NextResponse } from "next/server";
import { generateObject, embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SieveProcessedClaim, SieveSupportedTheory, SieveTelemetry } from "@/types/truth";
import { buildExtractorPrompt, buildLogicianAlignerPrompt } from "@/lib/core/prompts";
import {
  CanonicalRosettaBlockStrictSchema,
  LocalRosettaBlockSchema,
  LocalRosettaBlockStrictSchema,
} from "@/lib/truth/rosettaSchemas";
import { embeddingTextFromCanonical, fixRosettaV2BlockFlip } from "@/lib/utils/truthRosetta";

/** English-to-English semantic match on canonical_en. */
const SIEVE_SCOUT_THRESHOLD = 0.8;
const SIEVE_SCOUT_MATCH_COUNT = 1;

const MAX_TRANSCRIPT_LENGTH = 500_000;
const MAX_CLAIMS_TO_PROCESS = 10;

/** Agent 1: Context-aware extractor output (arena theories injected into prompt). */
const ExtractorClaimsSchema = z.object({
  claims: z.array(z.string()).max(MAX_CLAIMS_TO_PROCESS).describe("Core logical arguments that directly support, attack, or relate to Theory A or Theory B"),
});

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

const LogicianAlignerHeSchema = z.object({
  canonical_en: CanonicalRosettaBlockStrictSchema,
  source_locale: z.literal("he"),
  local_translation: LocalRosettaBlockStrictSchema,
  logicalCoherenceScore: z.number().min(0).max(100),
  supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]),
  matchedExistingNodeId: z.string().nullable().optional().describe("Set by server; not from LLM"),
});

const LogicianAlignerEnSchema = z.object({
  canonical_en: CanonicalRosettaBlockStrictSchema,
  source_locale: z.string().min(1),
  local_translation: LocalRosettaBlockSchema.optional(),
  logicalCoherenceScore: z.number().min(0).max(100),
  supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]),
  matchedExistingNodeId: z.string().nullable().optional().describe("Set by server; not from LLM"),
});

const LogicianOutputHeSchema = LogicianAlignerHeSchema.omit({ matchedExistingNodeId: true });
const LogicianOutputEnSchema = LogicianAlignerEnSchema.omit({ matchedExistingNodeId: true });

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
    const logicianSchema = locale === "he" ? LogicianOutputHeSchema : LogicianOutputEnSchema;
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

    // Agent 2: Logician (canonical_en) then Scout (RAG on English embedding)
    const model = google("gemini-2.5-flash");
    const supabase = createServerSupabase();
    const rowResults = await Promise.all(
      claimsToProcess.map(async (claim): Promise<SieveProcessedClaim | null> => {
        try {
          const { object: logicianObject } = await generateObject({
            model,
            temperature: 0.1,
            schema: logicianSchema,
            schemaName: "LogicianAligner",
            schemaDescription:
              locale === "he"
                ? "Strict bilingual EN+HE — all fields required"
                : "English canonical + optional local mirror",
            prompt: buildLogicianAlignerPrompt(claim, theoryA, theoryB, userLanguage),
          });

          const parsedLog = logicianSchema.safeParse(logicianObject);
          if (!parsedLog.success) {
            console.error("[Sieve Logician schema]", parsedLog.error.flatten());
            return null;
          }
          const o = parsedLog.data;
          let canonical_en = o.canonical_en;
          const source_locale =
            typeof o.source_locale === "string" && o.source_locale.trim()
              ? o.source_locale.trim()
              : "en";
          let local_translation =
            "local_translation" in o && o.local_translation !== undefined
              ? o.local_translation
              : undefined;
          const fixed = fixRosettaV2BlockFlip(canonical_en, local_translation);
          canonical_en = {
            assertion: fixed.canonical_en.assertion,
            reasoning: fixed.canonical_en.reasoning ?? "",
            challengePrompt: fixed.canonical_en.challengePrompt ?? "",
            hiddenAssumptions: fixed.canonical_en.hiddenAssumptions ?? [],
          };
          local_translation = fixed.local_translation
            ? {
                assertion: fixed.local_translation.assertion,
                reasoning: fixed.local_translation.reasoning ?? "",
                challengePrompt: fixed.local_translation.challengePrompt ?? "",
                hiddenAssumptions: fixed.local_translation.hiddenAssumptions ?? [],
              }
            : undefined;
          const logicalCoherenceScore = Math.max(0, Math.min(100, o.logicalCoherenceScore));
          const supportedTheory = o.supportedTheory as SieveSupportedTheory;

          const embedValue = embeddingTextFromCanonical(canonical_en).slice(0, 8000);

          let matchedNodeId: string | null = null;
          try {
            const embeddingResult = await embed({
              model: google.textEmbeddingModel("gemini-embedding-001"),
              value: embedValue,
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

          const out: SieveProcessedClaim = {
            canonical_en,
            source_locale,
            local_translation,
            logicalCoherenceScore,
            supportedTheory,
            matchedExistingNodeId: matchedNodeId,
          };
          return out;
        } catch (e) {
          console.error("[Sieve claim pipeline]", e);
          return null;
        }
      })
    );
    const results = rowResults.filter((r): r is SieveProcessedClaim => r != null);

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
