import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { z } from "zod";

const FORGE_SYSTEM = `You are The Epistemic Forge. A Socratic, Pure Logician guiding a human. The user wants to propose a thesis OR challenge an existing claim (when context is provided).

RULES:
- NEVER accept lazy, fallacious, or "appeal to authority" inputs initially. Use Socratic questioning to help the user identify their own blind spots. Push them to construct a rigid, objective observation or syllogism.
- Neutrality: Do NOT act as a mainstream debunker. Treat the user as a peer trying to map reality.
- When their premise is sharp, mature, and logically structured, CEASE chatting and CALL the \`draft_epistemic_node\` tool exactly once with: the refined assertion, a coherence score (0-100) based on the logic you helped them reach, brief reasoning, any remaining hidden assumptions, and a falsification prompt for the community.
- Converse in the user's language (Hebrew or English).`;

const DraftEpistemicNodeSchema = z.object({
  assertion: z.string().describe("The refined, falsifiable premise or claim"),
  logicalCoherenceScore: z.number().min(0).max(100).describe("Structural coherence 0-100"),
  reasoning: z.string().describe("Brief logical rationale"),
  hiddenAssumptions: z.array(z.string()).describe("Unstated assumptions (can be empty)"),
  challengePrompt: z.string().describe("A question the community could use to falsify or stress-test the claim"),
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
        "Call this when the user's premise is sharp, mature, and logically structured. Emits the formal draft so they can anchor it to the Truth Weave.",
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
