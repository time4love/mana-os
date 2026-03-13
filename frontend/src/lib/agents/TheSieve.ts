/**
 * The Sieve — Extractor Agent (Epistemic Prism Swarm)
 *
 * Single responsibility: read large text and extract only distinct, core logical
 * propositions or factual assertions. No philosophical flair; raw claims only.
 * Used by the Prism Orchestrator to feed The Logician and The Scout.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const CLAIMS_SCHEMA = z.object({
  claims: z.array(z.string()).describe("List of distinct core logical propositions or factual assertions"),
});

const SIEVE_SYSTEM = `You are The Sieve. Your only job is to extract the distinct, core logical propositions or factual assertions an author is making.

RULES:
- Ignore philosophical flair, rhetoric, and framing. Extract ONLY the discrete claims.
- Each item must be a single, testable proposition or factual assertion.
- Deduplicate: if the same claim appears in different words, output it once.
- Output in the same language as the source text when possible.
- Return an empty array only if the text contains no identifiable claims.`;

/**
 * Extracts an array of distinct core logical propositions from document text.
 * Uses Gemini for large-context, serverless-friendly processing.
 */
export async function extractClaims(documentText: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Configure it in .env.local (Google AI Studio).");
  }

  const trimmed = documentText.trim();
  if (trimmed.length < 20) {
    return [];
  }

  const model = google("gemini-2.5-pro");
  const { object } = await generateObject({
    model,
    schema: CLAIMS_SCHEMA,
    schemaName: "SieveClaims",
    schemaDescription: "Distinct logical propositions extracted from the document",
    system: SIEVE_SYSTEM,
    prompt: `Extract every distinct, core logical proposition or factual assertion from the following text. Output only the list of claims, no commentary.\n\n---\n${trimmed.slice(0, 500_000)}`,
  });

  const list = Array.isArray((object as { claims?: string[] })?.claims)
    ? (object as { claims: string[] }).claims
    : [];
  return list.map((c) => (typeof c === "string" ? c : String(c)).trim()).filter(Boolean);
}
