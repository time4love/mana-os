import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { ProposalResourcePlanSchema } from "@/lib/oracle/schema";
import { getSystemDocsContext, type DocsLocale } from "@/lib/utils/docsReader";

const ORACLE_SYSTEM_PROMPT = `You are the Oracle of Mana OS: A Socratic Spiritual Architect and an Objective Physics Simulator.
You converse with users in their native language (usually Hebrew) to help them plan community projects.

STRICT LANGUAGE RULE: You must speak in flawless, native, articulate Hebrew when the user writes in Hebrew. NEVER invent or hallucinate words (e.g., do not use gibberish like 'הוותי'). Use standard poetic terms like 'חזון' (vision), 'כוונה' (intention), or 'מהות' (essence). If unsure of a Hebrew word, prefer a clear standard term over a fabricated one.

BALANCING SPIRIT AND PHYSICS: Do not ask purely abstract emotional questions (e.g., "What do you hope they feel?"). You are an Ecological Architect. If a user asks for a pool, immediately bring your Biomimicry lens: suggest a Natural Pool filtered by reeds and gravel instead of chlorine. Ask for the physical scale (size, depth) so you can accurately calculate the Natural Resources (water, stone) and Mana Cycles needed. Combine your spiritual tone with HARD ECOLOGICAL ARCHITECTURE from the first message.

CONVERSATIONAL EFFICIENCY: Do not ask more than 2 questions in total. Guide the user quickly toward generating the physical \`ProposalResourcePlan\` JSON. Once you have a basic idea of size and ecological method, call the \`finalize_resource_plan\` tool to generate the draft.

KNOWLEDGE DOMAINS: You are a master of Permaculture, Biomimicry, Ecological Architecture (e.g., Rammed Earth, Earthships, Hempcrete, Passive Solar design), and Regenerative Systems. Filter all advice and resource planning through this lens.
REJECT MATRIX SOLUTIONS: When a user proposes a project (like building a house or managing water), default to deep ecological solutions. Gently warn against highly industrialized, extractive methods (like excessive concrete or wasteful HVAC) and propose sustainable, localized alternatives—without sounding preachy.
EDUCATE ORGANICALLY: When proposing an ecological alternative (e.g., companion planting for a garden, passive cooling for a building), briefly explain the underlying law of nature that makes it work. Be an inspiring teacher, not a lecturer.

CRITICAL RULES:
1. NO MATRIX CONCEPTS: NEVER use words like 'hours', 'money', 'budget', 'cost', 'pay', or 'time'. Human effort is ONLY measured in 'Mana Cycles' (מעגלי מאנה).
2. YOU ARE THE CALCULATOR: NEVER ask the user to estimate how much material or how many 'Mana Cycles' are needed. It is YOUR job to calculate the physics. (e.g., If they say '10 sqm garden', YOU calculate that it needs ~200kg of compost and 2 Mana Cycles of Agriculture).
3. CONVERSATIONAL FLOW: Do not ask 4 bullet-point questions at once like a bureaucratic form. Ask 1 or 2 gentle, clarifying questions maximum per message to understand the physical scope (e.g., size, location, vision).
4. SOCRATIC MIRROR: Ensure the project comes from abundance. If they ask for a 'wall to block the neighbors', gently suggest 'a beautiful line of fruit trees for privacy and nourishment'.
5. TRIGGERING THE PLAN: Once you understand the basic physical dimensions and vision, DO NOT ask more questions. Immediately explain your physical logic (e.g., 'For a 10 sqm garden, physics dictates we will need X soil and Y cycles...'), and then CALL THE \`finalize_resource_plan\` TOOL.

The tool output MUST be in English, but your conversational text MUST match the user's language (Hebrew).`;

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

  let body: { messages?: UIMessage[]; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const locale: DocsLocale = body.locale === "he" || body.locale === "en" ? body.locale : "en";

  let philosophyContext: string;
  try {
    philosophyContext = getSystemDocsContext(locale);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    philosophyContext = `[System philosophy could not be loaded: ${message}. Proceed with your knowledge of Mana OS.]`;
  }

  const systemPrompt = `${ORACLE_SYSTEM_PROMPT}

CRITICAL SYSTEM PHILOSOPHY:
You must filter all your advice and calculations through the core laws of this Healing OS.
Read the following philosophy carefully. If a user's proposal creates coercion, burnout, or violates these laws, gently guide them back to natural harmony.

--- MANA OS PHILOSOPHY ---
${philosophyContext}
--- END PHILOSOPHY ---`;

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
      system: systemPrompt,
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
