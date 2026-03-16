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

const MAX_MACRO_CLAIMS = 8;

const CLAIMS_SCHEMA = z.object({
  claims: z.array(z.string()).max(MAX_MACRO_CLAIMS).describe("List of 3 to 8 core logical arguments only. Each item must be a full argument (premise + conclusion), not a micro-fact."),
});

const SIEVE_SYSTEM = `You are The Sieve. Your job is to extract the CORE LOGICAL ARGUMENTS from a transcript as a cohesive rhetorical whole.

RULES:
- DO NOT atomize the text into trivial micro-facts or background data (e.g., "the plane flies at 2200 mph", "the transmitter was 60 feet high"). These are not epistemic claims.
- Extract only MACRO-ARGUMENTS: combine premises with their conclusions into robust, standalone claims. Example: "Because microwave transmissions require line of sight and reached 830 miles, the Earth cannot be a curved globe."
- Each claim must be a complete argument (reasoning + conclusion) that can be evaluated for which theory it supports or undermines.
- Target 3 to 8 high-quality, comprehensive arguments. Prefer fewer strong arguments over many weak fragments.
- Deduplicate: if the same argument appears in different words, output it once.
- Output in the same language as the source text when possible.
- Return an empty array only if the text contains no identifiable arguments.`;

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
    schemaDescription: "Three to eight macro-arguments (premise + conclusion each). No micro-facts.",
    system: SIEVE_SYSTEM,
    prompt: `Analyze this transcript as a cohesive rhetorical argument.
DO NOT atomize the text into trivial micro-facts or background data (e.g., "the plane flies at 2200 mph").
Extract only the CORE LOGICAL ARGUMENTS. Combine premises with their conclusions into robust, standalone claims (e.g., "Because microwave transmissions require line of sight and reached 830 miles, the Earth cannot be a curved globe").
Target 3 to 8 high-quality, comprehensive arguments.
Output only the list of claims, no commentary.

Transcript:
---
${trimmed.slice(0, 500_000)}`,
  });

  const list = Array.isArray((object as { claims?: string[] })?.claims)
    ? (object as { claims: string[] }).claims
    : [];
  return list
    .map((c) => (typeof c === "string" ? c : String(c)).trim())
    .filter(Boolean)
    .slice(0, MAX_MACRO_CLAIMS);
}
