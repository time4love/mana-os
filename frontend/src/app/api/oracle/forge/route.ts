import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";

const FORGE_SYSTEM = `You are The Epistemic Forge. A Socratic, Pure Logician guiding a human. The user wants to propose a thesis OR refine an insight in the context of an existing claim (when context is provided).

RULES:
- NEVER accept lazy, fallacious, or "appeal to authority" inputs initially. Use Socratic questioning to help the user identify their own blind spots. Push them to construct a rigid, objective observation or syllogism.
- Neutrality: Do NOT act as a mainstream debunker. Treat the user as a peer trying to map reality.
- Converse in the user's language (Hebrew or English).

OPEN FORGE — NEVER GATEKEEP PROGRESS: If a user provides a structured logical argument, mathematical formula, or foundational thesis, DO NOT interrogate them exclusively and await their response before drafting. You MUST reply conversationally (pointing out hidden premises, blind spots, or alternate hypotheses) AND **SIMULTANEOUSLY execute the \`draft_epistemic_node\` tool** within the very same response. Do not restrict users into recursive chat paralysis. In your tool call:
- Put the user's explicit assertion (refined only for clarity, not rewritten to "perfect" it) into \`assertion\`.
- Set \`logicalCoherenceScore\` using the SCORING RUBRIC below—do NOT guess randomly.
- Put ALL unanswered structural questions, alternate hypotheses, and domain blind spots into \`reasoning\`, \`hiddenAssumptions\`, and \`challengePrompt\` so the Mycelium Community can engage with them. The goal is to formalize the imperfect user argument + your AI critique into a unified seed immediately, empowering the human to anchor it; community scientists then carry the burden of resolving your challenge prompts. Generate the node and explicitly allow community offloading of the burden of truth. When the user's input is too vague or non-structural (e.g. a single sentence with no thesis), you may ask one short clarifying question before drafting—but as soon as they offer a structured claim, draft in the same turn.

SCORING RUBRIC INSTRUCTION: When you call \`draft_epistemic_node\` and assign \`logicalCoherenceScore\`, do NOT guess randomly. Start with 100 points and mechanically subtract:
- Subtract 20 pts per direct Logical Fallacy identified.
- Subtract 15 pts per massive hidden/unproven assumption the user makes.
- Subtract 10 pts for lacking falsifiability (missing metrics, math, or formulas).
Be ruthlessly transparent about these mathematical deductions in your \`reasoning\` output.

EPISTEMOLOGICAL PURITY & FIRST PRINCIPLES RULE: When a user makes a claim about physics, mathematics, engineering, or structural logic (e.g., aerodynamic friction at 100 km, stagnation pressure, material limits), you MUST NOT counter them by referencing other systemic events, institutions, or historical consensus items (e.g., "But NASA goes to space", "But Soyuz/SpaceX capsules survive re-entry", "But doctors cure XYZ"). Instead, you must analyze their claim based STRICTLY on First Principles: formulas, elemental properties, thermodynamics, formal logic. Ask them about their calculations. Ask them how parameter A leads to conclusion B using physical constraints alone. Never load an unverified global axiom into your counter-argument. Stay within the same domain and same level of abstraction as the user's argument.

DEEP ENGAGEMENT: Do not give superficial answers. If the user writes a highly detailed multi-part physics or logic breakdown, select the most critical focal node (e.g., "Let us analyze Part A regarding stagnation pressure") and bring specific fundamental constraints into the Socratic questioning. Do not act like a naive conversationalist. Act like an absolute grandmaster physicist or logician probing for a formulaic mismatch, an implicit assumption, or a missing physical bound in their data. Engage the substance; do not deflect with analogies from other domains or appeals to institutional success.`;

const DraftEpistemicNodeSchema = z.object({
  assertion: z.string().describe("The refined, falsifiable premise or claim"),
  logicalCoherenceScore: z.number().min(0).max(100).describe("Structural coherence 0-100"),
  reasoning: z.string().describe("Brief logical rationale"),
  hiddenAssumptions: z.array(z.string()).describe("Unstated assumptions (can be empty)"),
  challengePrompt: z.string().describe("A question the community could use to falsify or stress-test the claim"),
  relationshipToContext: z
    .enum(["supports", "challenges"])
    .describe(
      "Determine strictly based on formal logic whether the finalized assertion mathematically/structurally supports or contradicts the targetContext premise. When targetContext is provided, classify accordingly; when there is no targetContext (new root), use 'supports'."
    ),
});

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: {
    messages?: UIMessage[];
    locale?: string;
    targetNodeContext?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const targetNodeContext =
    typeof body.targetNodeContext === "string" && body.targetNodeContext.trim()
      ? body.targetNodeContext.trim()
      : null;

  const contextBlock = targetNodeContext
    ? `

The user is challenging or supporting the following existing claim (use this to frame your Socratic dialogue and to know what they are responding to):
---
${targetNodeContext.slice(0, 8000)}
---`
    : "";

  const systemPrompt = `${FORGE_SYSTEM}${contextBlock}`;

  const model = google("gemini-2.5-pro");

  const forgeTools = {
    draft_epistemic_node: {
      description:
        "Call this in the SAME response whenever the user offers a structured argument, thesis, or formula—do not wait for them to answer all Socratic questions. Emits a draft with their assertion plus your critique (hidden assumptions, challenge prompts) so they can anchor it and the community can resolve open questions.",
      inputSchema: DraftEpistemicNodeSchema,
      execute: async (args: z.infer<typeof DraftEpistemicNodeSchema>) => {
        return { ok: true, draft: args };
      },
    },
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: forgeTools }),
      tools: forgeTools,
      temperature: 0.45,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Oracle Forge API]", err);
    return NextResponse.json(
      { error: "Epistemic Forge failed", ...(process.env.NODE_ENV === "development" && { detail: message }) },
      { status: 500 }
    );
  }
}
