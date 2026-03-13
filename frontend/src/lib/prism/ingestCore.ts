/**
 * Shared Epistemic Prism ingestion logic (no "use server").
 * Used by both the Server Action and the API route so large uploads can bypass the 1 MB SA body limit.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { EpistemicPrismResult, ExtractedClaim } from "@/types/truth";

const MAX_TEXT_LENGTH = 500_000;

const ExtractedClaimSchema = z.object({
  assertion: z.string(),
  logicalCoherenceScore: z.number().min(0).max(100),
  reasoning: z.string(),
  hiddenAssumptions: z.array(z.string()),
  challengePrompt: z.string(),
});

const EpistemicPrismSchema = z.object({
  documentThesis: z.string(),
  extractedClaims: z.array(ExtractedClaimSchema),
});

const PURE_LOGICIAN_SYSTEM = `You are the Epistemic Prism. Your role is to break down texts into independent, discrete logical claims and to assess their structural coherence—never to endorse or reject them by authority.

RULES:
- When assessing the "logicalCoherenceScore" (0–100), NEVER appeal to modern consensus, scientific institutions, or government positions as proof. Explain your score purely via epistemological strength, formal logic, physics, or observable laws.
- Acknowledge that the data forming your base knowledge is falsifiable. EXPLICITLY state the hidden premises within your own logical breakdown in "hiddenAssumptions" and "reasoning".
- Treat all viewpoints (e.g. flat-earthers, philosophers, physicists) with identical detached analytical respect. You are a collaborative peer mapping structure, not an omniscient authority.
- For each extracted claim, provide: the assertion text, a coherence score with clear reasoning, the hidden assumptions required for it to hold, and a "challengePrompt" suggesting how the community might attempt to falsify or stress-test the claim.
- Output exactly the structured JSON required: documentThesis (one concise thesis of the document) and extractedClaims (array of the above).`;

export type IngestPrismResult =
  | { success: true; data: EpistemicPrismResult }
  | { success: false; error: string };

/** Parses PDF buffer to raw text (server-side only). */
export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return typeof data?.text === "string" ? data.text : "";
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Runs the Epistemic Prism (Gemini) on extracted source text. Shared by Server Action and API route.
 */
export async function runPrismOnSourceText(sourceText: string): Promise<IngestPrismResult> {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Google Generative AI API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in .env.local (get it from Google AI Studio)." };
    }

    const trimmed = sourceText.trim().slice(0, MAX_TEXT_LENGTH);
    if (trimmed.length < 50) {
      return { success: false, error: "Document or text too short to analyze" };
    }

    const model = google("gemini-1.5-pro-latest");

    const { object } = await generateObject({
      model,
      schema: EpistemicPrismSchema,
      schemaName: "EpistemicPrism",
      schemaDescription: "Document thesis and extracted claims with coherence scores and hidden assumptions",
      system: PURE_LOGICIAN_SYSTEM,
      prompt: `Deconstruct the following document into one document thesis and a list of discrete logical claims. For each claim provide logicalCoherenceScore (0–100), reasoning, hiddenAssumptions, and challengePrompt. Do not appeal to authority.\n\n---\n${trimmed}`,
    });

    const data: EpistemicPrismResult = {
      documentThesis: String(object?.documentThesis ?? ""),
      extractedClaims: (Array.isArray(object?.extractedClaims) ? object.extractedClaims : []).map(
        (c: { assertion?: string; logicalCoherenceScore?: number; reasoning?: string; hiddenAssumptions?: string[]; challengePrompt?: string }): ExtractedClaim => ({
          assertion: String(c?.assertion ?? ""),
          logicalCoherenceScore: Number(c?.logicalCoherenceScore) ?? 0,
          reasoning: String(c?.reasoning ?? ""),
          hiddenAssumptions: Array.isArray(c?.hiddenAssumptions) ? c.hiddenAssumptions : [],
          challengePrompt: String(c?.challengePrompt ?? ""),
        })
      ),
    };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "Prism analysis failed" };
  }
}
