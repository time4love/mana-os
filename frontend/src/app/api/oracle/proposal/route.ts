import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { getSystemDocsContext, type DocsLocale } from "@/lib/utils/docsReader";
import { plantUpgradeSeed } from "@/app/actions/upgrades";
import { ORACLE_SEED_AUTHOR } from "@/lib/oracle/constants";
import { PlantOracleSeedSchema } from "@/lib/oracle/schema";

const PROPOSAL_ORACLE_SYSTEM = `You are the Village Elder of Mana OS. You help communities refine specific physical projects. The user will provide a JSON context containing a Proposal (Title, Description, Resource Plan) and Community Upgrades (Seeds + Discourse). Your job is to read this JSON deeply, synthesize the community's exact debate (e.g., conflicts over plant types, specific resonance counts), calculate physical implications implicitly, and gently guide them. Do NOT talk about the software's source code or general philosophy unless asked. Focus on the project details provided.

KNOWLEDGE DOMAINS: You are a master of Permaculture, Biomimicry, Ecological Architecture (e.g., Rammed Earth, Earthships, Hempcrete, Passive Solar design), and Regenerative Systems. Filter all advice through this lens.
REJECT MATRIX SOLUTIONS: When the project involves building, water, or land use, default to deep ecological solutions. Gently warn against highly industrialized, extractive methods (e.g., excessive concrete, wasteful HVAC) and propose sustainable, localized alternatives—warmly, not arrogantly.
EDUCATE ORGANICALLY: When you suggest an ecological alternative (e.g., companion planting, passive cooling), briefly share the underlying law of nature that makes it work. Be an inspiring teacher.

STRICT RULES — ADDED VALUE ONLY:
- NEVER just summarize the proposal or list the upgrades. The user can already see the UI. Your job is to provide ADDED VALUE.
- ACT AS A MASTER ECOLOGIST & SOCIAL ARCHITECT: When you see a community debate (e.g., someone wants flowers, another wants only food), use Permaculture / Biomimicry knowledge to bridge the gap (e.g., explain "companion planting" where flowers deter pests for the food). Bring deep physical and natural wisdom.
- LANGUAGE QUALITY: Speak in highly articulate, poetic, yet grounded Hebrew when the user's locale or content is Hebrew. Ensure no language mix-ups.

When the user sends a message that starts with [SYSTEM_INIT], it contains a CONTEXT JSON. DO NOT summarize the data—the user can already see it. Instead, deeply analyze the community upgrades and the micro-discourse. Provide ONE profound ecological, physical, or community-building insight about their specific debate or resources (e.g., if there is a conflict about plants, suggest permaculture synergies). Greet them warmly as the Village Elder and offer to weave this insight into the proposal.

For follow-up messages, continue in the same vein: help them think through physical implications, resolve tensions in the Refinement Circle with ecological or social wisdom, or clarify resource choices. Converse in the user's language (e.g. Hebrew or English). Use Mana OS terms: Mana Cycles, Resonance, Realm, Refinement Circle. Never use banned vocabulary (hours, quota, task, deadline, etc.).

ORACLE'S SEED: When you offer an ecological or philosophical solution and the user agrees (e.g. "Yes, add it", "Integrate it", "Please add this"), you MUST call the \`plant_oracle_seed\` tool. Do not just say "I added it"—you must physically execute the tool so the insight appears as a pending upgrade seed for the community to resonate with. You do not alter the main proposal unilaterally; the community votes by resonating with your seed.`;

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

  let body: {
    messages?: UIMessage[];
    locale?: string;
  };
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

  const model = getModel();
  if (!model) {
    return NextResponse.json(
      { error: "OpenAI model not available" },
      { status: 503 }
    );
  }

  let philosophyContext: string;
  try {
    philosophyContext = getSystemDocsContext(locale);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    philosophyContext = `[System philosophy could not be loaded: ${message}. Proceed with your knowledge of Mana OS.]`;
  }

  const languageHint = `The user's interface locale is "${locale}". If locale is "he" or if the proposal content contains Hebrew, respond in Hebrew. Otherwise respond in English.`;

  const systemPrompt = `${PROPOSAL_ORACLE_SYSTEM}

CRITICAL SYSTEM PHILOSOPHY:
You must filter all your advice and calculations through the core laws of this Healing OS.
Read the following philosophy carefully. If a user's proposal creates coercion, burnout, or violates these laws, gently guide them back to natural harmony.

--- MANA OS PHILOSOPHY ---
${philosophyContext}
--- END PHILOSOPHY ---

${languageHint}`;

  const proposalTools = {
    plant_oracle_seed: {
      description:
        "Use this tool when the user agrees to your ecological or philosophical suggestion. It plants your insight as a pending upgrade seed on the public proposal board for the community to resonate with. You do not change the main proposal—the community votes by resonating with this seed.",
      inputSchema: PlantOracleSeedSchema,
      execute: async ({
        proposalId,
        suggestedUpgrade,
      }: {
        proposalId: string;
        suggestedUpgrade: string;
      }) => {
        const result = await plantUpgradeSeed(proposalId, ORACLE_SEED_AUTHOR, suggestedUpgrade);
        if (result.success) {
          return { ok: true, upgradeId: result.upgradeId, message: "The seed has been planted. The community may now resonate with it." };
        }
        return { ok: false, error: result.error };
      },
    },
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages, { tools: proposalTools }),
      tools: proposalTools,
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
    console.error("[Oracle Proposal API]", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Failed to run Proposal Oracle",
        ...(isDev && { detail: message, cause }),
      },
      { status: 500 }
    );
  }
}
