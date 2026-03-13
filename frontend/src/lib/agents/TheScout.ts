/**
 * The Scout — Assumption Hunter Agent (Epistemic Prism Swarm)
 *
 * Single responsibility: find unstated baseline assumptions a claim relies on
 * and form a falsification question for the community to stress-test it.
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const SCOUT_SCHEMA = z.object({
  hiddenAssumptions: z.array(z.string()).describe("Unstated baseline assumptions the author relies on for the claim to hold"),
  falsificationChallenge: z.string().describe("A question or challenge the community could use to falsify or stress-test the claim"),
});

const SCOUT_SYSTEM = `You are the Scout. Find the unstated baseline assumptions an author relies on for a claim to be true, and form a falsification question for the community.

RULES:
- List only assumptions that are implicit or assumed, not explicitly stated in the claim.
- The falsification challenge should be a clear, constructive question or test the community could use to probe or falsify the claim.
- Be precise and neutral. You are mapping hidden structure, not attacking or defending.

**LANGUAGE DIRECTIVE: You MUST analyze and respond ONLY in fluent, precise HEBREW. Your rationales, assumptions, and challenge prompts MUST be formulated in Hebrew, ignoring any tendency to fallback to English, regardless of the input language. Use academic, objective, localized vocabulary.**`;

/**
 * Finds hidden assumptions for one claim and a falsification challenge for the community.
 */
export async function findHiddenAssumptions(claim: string): Promise<{
  hiddenAssumptions: string[];
  falsificationChallenge: string;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Configure it in .env.local (Google AI Studio).");
  }

  const trimmed = claim.trim();
  if (!trimmed) {
    return { hiddenAssumptions: [], falsificationChallenge: "" };
  }

  const model = google("gemini-2.5-pro");
  const { object } = await generateObject({
    model,
    schema: SCOUT_SCHEMA,
    schemaName: "ScoutAssumptions",
    schemaDescription: "Hidden assumptions and a falsification challenge for a claim",
    system: SCOUT_SYSTEM,
    prompt: `Find the unstated baseline assumptions this claim relies on, and form a falsification question for the community.\n\nClaim: ${trimmed}`,
  });

  const o = object as { hiddenAssumptions?: string[]; falsificationChallenge?: string };
  return {
    hiddenAssumptions: Array.isArray(o?.hiddenAssumptions) ? o.hiddenAssumptions.map(String).filter(Boolean) : [],
    falsificationChallenge: typeof o?.falsificationChallenge === "string" ? o.falsificationChallenge.trim() : "",
  };
}
