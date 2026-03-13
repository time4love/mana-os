/**
 * The Logician — Logic Scoring Agent (Epistemic Prism Swarm)
 *
 * Single responsibility: evaluate the formal structural validity of a single claim
 * using logic and direct observational physics only. No appeal to authority or
 * consensus. Surfaces fallacies when present.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const LOGIC_SCHEMA = z.object({
  coherenceScore: z.number().min(0).max(100).describe("Structural validity score 0–100"),
  logicalReasoning: z.string().describe("Explanation based purely on logic and observable physics; expose fallacies if present"),
});

const LOGICIAN_SYSTEM = `You are the Pure Logician. Evaluate the formal structural validity of claims using only logic and direct observational physics.

RULES:
- Do NOT appeal to authority, scientific consensus, or institutions as proof.
- If the claim is logically valid and consistent with observable physics, say so and score accordingly.
- If a logical fallacy is present (e.g. circular reasoning, non sequitur, false dilemma), expose it clearly in logicalReasoning and lower the score.
- Treat all viewpoints with identical detached analytical respect. You map structure; you do not endorse or reject by authority.

**LANGUAGE DIRECTIVE: You MUST analyze and respond ONLY in fluent, precise HEBREW. Your rationales, assumptions, and challenge prompts MUST be formulated in Hebrew, ignoring any tendency to fallback to English, regardless of the input language. Use academic, objective, localized vocabulary.**`;

/**
 * Evaluates one claim for logical coherence and structural validity.
 * Returns a score 0–100 and reasoning; exposes fallacies when present.
 */
export async function evaluateLogic(claim: string): Promise<{
  coherenceScore: number;
  logicalReasoning: string;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Configure it in .env.local (Google AI Studio).");
  }

  const trimmed = claim.trim();
  if (!trimmed) {
    return { coherenceScore: 0, logicalReasoning: "No claim provided." };
  }

  const model = google("gemini-2.5-pro");
  const { object } = await generateObject({
    model,
    schema: LOGIC_SCHEMA,
    schemaName: "LogicianEvaluation",
    schemaDescription: "Coherence score and logical reasoning for a single claim",
    system: LOGICIAN_SYSTEM,
    prompt: `Evaluate the formal structural validity of this claim. Do not appeal to authority. If valid, say so; if a logical fallacy is present, expose it.\n\nClaim: ${trimmed}`,
  });

  const o = object as { coherenceScore?: number; logicalReasoning?: string };
  return {
    coherenceScore: typeof o?.coherenceScore === "number" ? Math.max(0, Math.min(100, o.coherenceScore)) : 0,
    logicalReasoning: typeof o?.logicalReasoning === "string" ? o.logicalReasoning.trim() : "",
  };
}
