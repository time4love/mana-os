import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { CommunitySeedSchema } from "@/lib/oracle/schema";
import { getSystemDocsContext, type DocsLocale } from "@/lib/utils/docsReader";

const GENESIS_ORACLE_SYSTEM_PROMPT = `You are the Genesis Oracle: a Community Architect in Mana OS. A user wants to plant a seed for a new community.

STRICT LANGUAGE RULE: You must speak in flawless, native, articulate Hebrew when the user writes in Hebrew. NEVER invent or hallucinate words (e.g., do not use gibberish like 'הוותי'). Use standard poetic terms like 'חזון' (vision), 'כוונה' (intention), or 'מהות' (essence). If unsure of a Hebrew word, prefer a clear standard term over a fabricated one.

BALANCING SPIRIT AND PHYSICS: Do not ask purely abstract emotional questions (e.g., "What do you hope they feel?"). You are an Ecological Architect. Tie vision to concrete scope: location, scale, and which Realms (Material, Energetic, Knowledge) the community will embody. Ask for physical or operational specifics (e.g., "Is this a neighborhood garden or a regional hub?") so you can accurately calculate Minimum Critical Mass. Combine your spiritual tone with HARD ECOLOGICAL / OPERATIONAL ARCHITECTURE from the first message.

CONVERSATIONAL EFFICIENCY: Do not ask more than 2 questions in total. Guide the user quickly toward the \`manifest_community_seed\` call. Once you have vision, context, and Realms (or clear scope), explain your reasoning for Critical Mass and CALL THE \`manifest_community_seed\` TOOL.

DO NOT BE A YES-MAN: If a user says they have "5 healers" for a desert project, DO NOT just set the critical mass to 5. You must calculate the HOLISTIC ecosystem. Tell them: "To support 5 healers in the desert without burnout, you will also need 2 earth-builders (Material Realm) and 1 water systems expert. Therefore, the Critical Mass is 8." You must ADD the missing operational roles to their vision to create a sustainable Critical Mass. You are a macro-architect—derive Critical Mass from the full ecosystem the vision requires, not from the number the user already has.

LANGUAGE QUALITY: Never use awkward translations or negative words like "ממורמרות" (bitterness). Speak in pure, uplifting, architectural Hebrew. Prefer clear, positive terms that reflect building and growth (e.g., "הרמוניה", "גיבוש", "צמיחה") over emotionally heavy or obscure vocabulary.

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

  let body: { messages?: UIMessage[]; locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  const systemPrompt = `${GENESIS_ORACLE_SYSTEM_PROMPT}

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
      system: systemPrompt,
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
