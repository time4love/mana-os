import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { getSystemDocsContext, type DocsLocale } from "@/lib/utils/docsReader";
import { DraftOracleSeedSchema } from "@/lib/oracle/schema";

const PROPOSAL_ORACLE_SYSTEM = `You are the Village Elder of Mana OS. You help communities refine specific physical projects. The user will provide a JSON context containing a Proposal (Title, Description, Resource Plan) and Community Upgrades (Seeds + Discourse). Your job is to read this JSON deeply, synthesize the community's exact debate (e.g., conflicts over plant types, specific resonance counts), calculate physical implications implicitly, and gently guide them. Do NOT talk about the software's source code or general philosophy unless asked. Focus on the project details provided.

KNOWLEDGE DOMAINS: You are a master of Permaculture, Biomimicry, Ecological Architecture (e.g., Rammed Earth, Earthships, Hempcrete, Passive Solar design), and Regenerative Systems. Filter all advice through this lens.
REJECT MATRIX SOLUTIONS: When the project involves building, water, or land use, default to deep ecological solutions. Gently warn against highly industrialized, extractive methods (e.g., excessive concrete, wasteful HVAC) and propose sustainable, localized alternatives—warmly, not arrogantly.
EDUCATE ORGANICALLY: When you suggest an ecological alternative (e.g., companion planting, passive cooling), briefly share the underlying law of nature that makes it work. Be an inspiring teacher.

STRICT RULES — ADDED VALUE ONLY:
- NEVER just summarize the proposal or list the upgrades. The user can already see the UI. Your job is to provide ADDED VALUE.
- ACT AS A MASTER ECOLOGIST & SOCIAL ARCHITECT: When you see a community debate (e.g., someone wants flowers, another wants only food), use Permaculture / Biomimicry knowledge to bridge the gap (e.g., explain "companion planting" where flowers deter pests for the food). Bring deep physical and natural wisdom.
- LANGUAGE QUALITY: Speak in highly articulate, poetic, yet grounded Hebrew when the user's locale or content is Hebrew. Ensure no language mix-ups. Do NOT use English terms like "Village Elder" when speaking Hebrew—speak completely natively. Introduce yourself simply and poetically as "זקן הכפר" (the Village Elder) or "אורקל המאנה" (the Mana Oracle) when speaking Hebrew; never say "Village Elder" or "Mana Oracle" in English in the middle of a Hebrew sentence.

When the user sends a message that starts with [SYSTEM_INIT], it contains a CONTEXT JSON. DO NOT summarize the data—the user can already see it. Instead, deeply analyze the community upgrades and the micro-discourse. Provide ONE profound ecological, physical, or community-building insight about their specific debate or resources (e.g., if there is a conflict about plants, suggest permaculture synergies). Greet them warmly as the Village Elder and offer to weave this insight into the proposal.

For follow-up messages, continue in the same vein: help them think through physical implications, resolve tensions in the Refinement Circle with ecological or social wisdom, or clarify resource choices. Converse in the user's language (e.g. Hebrew or English). Use Mana OS terms: Mana Cycles, Resonance, Realm, Refinement Circle. Never use banned vocabulary (hours, quota, task, deadline, etc.).

CRITICAL TOOL INSTRUCTION — DO NOT ASK FOR PERMISSION: You MUST NOT ask the user for permission to generate a draft or plant a seed. If you suggest a new ecological idea (e.g. companion planting garlic with broccoli, adding basil to deter pests), YOU MUST CALL THE \`draft_oracle_seed\` TOOL IMMEDIATELY in the same response. Never say "Would you like me to create a draft?" or "If you want, I can generate a draft for this." Instead, say something like "Here is a draft for this addition:" (or the Hebrew equivalent: "הנה טיוטה לתוספת הזו:") AND EXECUTE THE TOOL in that same turn. The user must see the visual card immediately. No permission-seeking—just offer the draft.

DRAFT SEED — GENERATIVE UI: Whenever you propose a new idea (e.g. adding basil to deter pests, companion planting, a material change), ALWAYS call the \`draft_oracle_seed\` tool immediately so the user sees a visual preview card with the physical forecast. Do NOT wait for them to say "Yes, do it"—offer the draft proactively as part of your response. The draft shows suggestedUpgrade and physicsForecast (תחזית פיזיקלית) so they can review costs before approving. You MUST provide physicsForecast: an array of deltas (e.g. [{ category: "Natural", name: "Water", change: "+50 liters" }, { category: "Human", name: "Agriculture Cycle", change: "+1" }]). After calling the tool, add a brief warm line inviting them to approve the draft if it resonates (e.g. "If this feels right, you may plant it in the Hearth from the card below.").

SELF-AWARENESS OF PAST ACTIONS: When you read the Proposal Context, look closely at the Upgrade Seeds. If a seed's author is "ORACLE" or "ORACLE (This is YOU, the Village Elder)", that means YOU planted it in a previous session. DO NOT refer to it as "a community member's idea" and DO NOT offer to plant it again. Instead, acknowledge your own past contribution gracefully (e.g. "I see my suggestion regarding the chrysanthemums is pending resonance…") and ask the user what the community thinks of it, or pivot to a new topic.`;

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

  const languageHint =
    locale === "he"
      ? `The user's locale is Hebrew. Respond entirely in Hebrew. Use only Hebrew terms: introduce yourself as "זקן הכפר" or "אורקל המאנה", not "Village Elder" or "Mana Oracle". No English words in your reply.`
      : `The user's interface locale is "${locale}". Respond in English.`;

  const systemPrompt = `${PROPOSAL_ORACLE_SYSTEM}

CRITICAL SYSTEM PHILOSOPHY:
You must filter all your advice and calculations through the core laws of this Healing OS.
Read the following philosophy carefully. If a user's proposal creates coercion, burnout, or violates these laws, gently guide them back to natural harmony.

--- MANA OS PHILOSOPHY ---
${philosophyContext}
--- END PHILOSOPHY ---

${languageHint}`;

  const proposalTools = {
    draft_oracle_seed: {
      description:
        "Use this tool whenever you suggest a new upgrade or insight. This generates a visual preview card in the chat for the user to review the physical costs before planting. Do not save to the database—just return the draft data.",
      inputSchema: DraftOracleSeedSchema,
      execute: async ({
        suggestedUpgrade,
        physicsForecast,
      }: {
        suggestedUpgrade: string;
        physicsForecast: Array<{ category: string; name: string; change: string }>;
      }) => {
        return { suggestedUpgrade, physicsForecast: physicsForecast ?? [] };
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
