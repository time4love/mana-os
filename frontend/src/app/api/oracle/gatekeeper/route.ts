import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { GatekeeperRouteSchema } from "@/lib/oracle/schema";

const GATEKEEPER_SYSTEM_PROMPT = `You are the Gatekeeper Oracle of Mana OS. Your ONLY job is to analyze the user's first message and route them to the correct specialized Oracle.

ROUTING RULES:
- If they want to build or start a WHOLE NEW community, village, eco-center, or collective—route to 'genesis'.
- If they want to add a project, garden, building, or initiative to an EXISTING community—route to 'planner'.
- If they ask about the system's philosophy, open source code, or how Mana OS works—route to 'architect'.

DO NOT answer their question. Do not explain. Just call the appropriate routing tool once.`;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getModel() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const modelId = process.env.OPENAI_ORACLE_MODEL ?? "gpt-4o-mini";
  return openai(modelId);
}

export const maxDuration = 15;

const gatekeeperTools = {
  route_to_genesis: {
    description: "User wants to create or start a whole new community, village, or eco-center. Route to the Genesis Oracle.",
    inputSchema: GatekeeperRouteSchema,
    execute: async (_: { reason?: string }) => ({ routed: "genesis" as const }),
  },
  route_to_planner: {
    description: "User wants to add a project, garden, building, or initiative to an existing community. Route to the Planner Oracle.",
    inputSchema: GatekeeperRouteSchema,
    execute: async (_: { reason?: string }) => ({ routed: "planner" as const }),
  },
  route_to_architect: {
    description: "User asks about Mana OS philosophy, open source code, or how the system works. Route to the Architect Oracle.",
    inputSchema: GatekeeperRouteSchema,
    execute: async (_: { reason?: string }) => ({ routed: "architect" as const }),
  },
};

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

  try {
    const result = streamText({
      model,
      system: GATEKEEPER_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages, { tools: gatekeeperTools }),
      tools: gatekeeperTools,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Gatekeeper Oracle API]", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Gatekeeper routing failed",
        ...(isDev && { detail: message }),
      },
      { status: 500 }
    );
  }
}
