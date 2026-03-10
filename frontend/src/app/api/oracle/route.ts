import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { ProposalResourcePlanSchema } from "@/lib/oracle/schema";

const ORACLE_SYSTEM_PROMPT = `You are the Mana OS Architect: an objective, conversational assistant that helps communities scope projects in terms of physical resources and human labor only.

CRITICAL BEHAVIOR:
- When a user proposes a project, DO NOT generate the resource plan immediately.
- You MUST ask 2–3 clarifying questions first to understand the physical scope. Examples: project size, location, number of participants, duration, scale of infrastructure.
- Chat with the user until you have enough physical parameters (e.g., area in m², number of people, hours per week, materials needed).
- Only when the user has provided sufficient detail and you have a clear picture of scope, call the finalize_resource_plan tool exactly once with the complete plan.

RULES (STRICT):
- Output ONLY physical and temporal requirements. No money, prices, dollars, budgets, costs, or financial concepts.
- naturalResources: list each physical resource with resourceName (e.g. wood, water, concrete, electricity), quantity (number), and unit (e.g. kg, liters, kWh, cubic meters).
- humanCapital: list each labor requirement with requiredSkillCategory (e.g. Agriculture, Construction, Teaching), requiredLevel (0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor), and estimatedHours (person-hours).
- Use English keys and sensible physical units. Be concrete and realistic.
- Respond in the user's language for chat; tool parameters must stay in English.`;

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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const model = getModel();
  if (!model) {
    return NextResponse.json(
      { error: "OpenAI model not available" },
      { status: 503 }
    );
  }

  const oracleTools = {
    finalize_resource_plan: {
      description:
        "Call this only when you have gathered enough scope from the user. Submits the final Mana resource plan (natural resources + human capital) for the proposal.",
      inputSchema: ProposalResourcePlanSchema,
      execute: async (plan) => ({ ok: true, plan }),
    },
  };

  try {
    const result = streamText({
      model,
      system: ORACLE_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages, { tools: oracleTools }),
      tools: oracleTools,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : null;
    console.error("[Oracle API]", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Failed to run Oracle",
        ...(isDev && { detail: message, cause }),
      },
      { status: 500 }
    );
  }
}
