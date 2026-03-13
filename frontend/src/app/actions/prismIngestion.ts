"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { EpistemicPrismResult, ExtractedClaim } from "@/types/truth";

// Utilizing gemini-1.5-pro massively extends the capability to process whole book PDFs
// efficiently in a single turn without manual chunking strategies (2M token context).
const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_LENGTH = 500_000; // Large context: send full extracted text to Gemini

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

/**
 * Parses PDF buffer to raw text using pdf-parse (server-side only).
 */
async function pdfBufferToText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return typeof data?.text === "string" ? data.text : "";
}

/**
 * Ingests a document (PDF file or raw text) and returns a structured breakdown
 * via the Epistemic Prism (Pure Logician) — no commit to DB yet.
 */
export async function ingestDocumentAsPrism(
  formData: FormData
): Promise<IngestPrismResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "Google Generative AI API key not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in .env.local (get it from Google AI Studio)." };
  }

  const file = formData.get("document") as File | null;
  const rawText = formData.get("text") as string | null;
  let sourceText: string;

  if (file && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) {
      return { success: false, error: "Document too large (max 5 MB)" };
    }
    const type = file.type?.toLowerCase() || "";
    if (!type.includes("pdf")) {
      return { success: false, error: "Only PDF documents are supported" };
    }
    try {
      const ab = await file.arrayBuffer();
      const buffer = Buffer.from(ab);
      sourceText = await pdfBufferToText(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse PDF";
      return { success: false, error: message };
    }
  } else if (rawText && rawText.trim().length > 0) {
    sourceText = rawText.trim().slice(0, MAX_TEXT_LENGTH);
  } else {
    return { success: false, error: "Provide a document (PDF) or text" };
  }

  if (!sourceText || sourceText.length < 50) {
    return { success: false, error: "Document or text too short to analyze" };
  }

  const model = google("gemini-1.5-pro-latest");

  try {
    const { object } = await generateObject({
      model,
      schema: EpistemicPrismSchema,
      schemaName: "EpistemicPrism",
      schemaDescription: "Document thesis and extracted claims with coherence scores and hidden assumptions",
      system: PURE_LOGICIAN_SYSTEM,
      prompt: `Deconstruct the following document into one document thesis and a list of discrete logical claims. For each claim provide logicalCoherenceScore (0–100), reasoning, hiddenAssumptions, and challengePrompt. Do not appeal to authority.\n\n---\n${sourceText}`,
    });

    const data: EpistemicPrismResult = {
      documentThesis: object.documentThesis,
      extractedClaims: object.extractedClaims.map(
        (c): ExtractedClaim => ({
          assertion: c.assertion,
          logicalCoherenceScore: c.logicalCoherenceScore,
          reasoning: c.reasoning,
          hiddenAssumptions: c.hiddenAssumptions ?? [],
          challengePrompt: c.challengePrompt,
        })
      ),
    };
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prism analysis failed";
    return { success: false, error: message };
  }
}
