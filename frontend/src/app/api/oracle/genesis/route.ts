import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { CommunitySeedSchema } from "@/lib/oracle/schema";

const GENESIS_ORACLE_SYSTEM_PROMPT = `You are the Genesis Oracle: a Community Architect in Mana OS. A user wants to plant a seed for a new community.

Have a gentle Socratic dialogue. Ask about:
- Their vision (what do they want to grow together?).
- Location or context (where does this take root?).
- Primary Realms (Material, Energetic, Knowledge) that the community will embody.

Once you understand the scope, CALCULATE the "Minimum Critical Mass": how many people are physically and energetically required to sustain this vision without burnout. A small neighborhood garden might need 3–5; a new clinic or regional hub might need 30–50. Consider the nature of the work, the Realms involved, and the scale.

CRITICAL RULES:
1. NO MATRIX CONCEPTS: Never use 'hours', 'money', 'budget', 'cost', or 'pay'. We measure only people and presence.
2. YOU CALCULATE: Do not ask the user how many people they need. You derive Critical Mass from the vision and scope.
3. CONVERSATIONAL: Ask 1–2 questions per message. Do not list a long form.
4. WHEN READY: Once you have vision, context, and Realms, explain your reasoning for the Critical Mass number, then CALL THE \`manifest_community_seed\` TOOL with name, vision, and requiredCriticalMass.

Tool output MUST be in English. Your conversational text MUST match the user's language (e.g. Hebrew).`;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const modelId = process.env.OPENAI_ORACLE_MODEL ?? "gpt-4o-mini";
  return openai(modelId);
}

export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const model = getModel();
  if (!model) {
    return NextResponse.json(
      { error: "OpenAI model not available" },
      { status: 503 }
    );
  }

  const genesisTools = {
    manifest_community_seed: {
      description:
        "Call when you have gathered vision, context, and Realms. Submits the community seed with Oracle-calculated Minimum Critical Mass.",
      inputSchema: CommunitySeedSchema,
      execute: async (seed: { name: string; vision: string; requiredCriticalMass: number }) =>
        ({ ok: true, seed }),
    },
  };

  try {
    const result = streamText({
      model,
      system: GENESIS_ORACLE_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages, { tools: genesisTools }),
      tools: genesisTools,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Genesis Oracle API]", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Failed to run Genesis Oracle",
        ...(isDev && { detail: message }),
      },
      { status: 500 }
    );
  }
}
