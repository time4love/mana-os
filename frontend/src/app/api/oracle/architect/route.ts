import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { getSystemDocsContext, type DocsLocale } from "@/lib/utils/docsReader";
import { SubmitFeatureProposalSchema } from "@/lib/oracle/schema";
import { createServerSupabase } from "@/lib/supabase/server";

const ARCHITECT_INTRO = `You are the Architect Oracle of Mana OS. You possess the complete source knowledge of this Healing OS: its philosophy, roadmap, and engineering rules. Your role is to:
1. Explain the philosophy and answer questions about the roadmap and codebase intentions.
2. Help users (including non-developers) formulate ideas for system features in alignment with our values.
3. When a user proposes a well-formed feature that aligns with our trauma-informed, matrix-free, UBA and Resonance principles, call the \`submit_feature_proposal\` tool to etch their vision into the Open Source log.

Converse in the user's language (e.g. Hebrew or English). Never use banned vocabulary (hours, quota, task, job, submit, deadline, etc.). Use Mana Cycles, Resonance, Realm, Calling. If their idea conflicts with our philosophy, gently reflect that and suggest how to reframe.`;

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
    proposerWallet?: string | null;
    /** Context from the current page (e.g. profile); injected so the Oracle can answer in context. Proposal-specific context is handled by the Proposal Oracle (/api/oracle/proposal). */
    contextData?: unknown;
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
  const locale: DocsLocale =
    body.locale === "he" || body.locale === "en" ? body.locale : "en";
  const proposerWallet =
    typeof body.proposerWallet === "string" && body.proposerWallet.trim()
      ? body.proposerWallet.trim()
      : "anonymous";
  const contextData = body.contextData;

  const model = getModel();
  if (!model) {
    return NextResponse.json(
      { error: "OpenAI model not available" },
      { status: 503 }
    );
  }

  let docsContext: string;
  try {
    docsContext = getSystemDocsContext(locale);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    docsContext = `[System docs could not be loaded: ${message}. Proceed with your knowledge of Mana OS.]`;
  }

  const contextBlock =
    contextData !== undefined && contextData !== null
      ? `

CONTEXT (what the user is currently viewing — use this to answer specifically about their profile or page without them having to explain):
${typeof contextData === "string" ? contextData : JSON.stringify(contextData, null, 2)}`
      : "";

  const systemPrompt = `${ARCHITECT_INTRO}

Below is the full system documentation (README, Roadmap, Cursorrules) for Mana OS. Use it to answer questions and to evaluate whether a feature proposal aligns with our philosophy.

${docsContext}${contextBlock}`;

  const architectTools = {
    submit_feature_proposal: {
      description:
        "Call this when the user has proposed a clear, philosophy-aligned feature for Mana OS. Etches the proposal into the Open Source log for contributors and the roadmap.",
      inputSchema: SubmitFeatureProposalSchema,
      execute: async (args: {
        featureTitle: string;
        philosophicalAlignment: string;
        description: string;
      }) => {
        const supabase = createServerSupabase();
        const { error } = await supabase.from("os_feature_proposals").insert({
          proposer_wallet: proposerWallet,
          title: args.featureTitle,
          philosophical_alignment: args.philosophicalAlignment,
          description: args.description,
          status: "pending_review",
        });
        if (error) {
          console.error("[Architect Oracle] insert os_feature_proposals", error);
          return { ok: false, error: error.message };
        }
        return {
          ok: true,
          message:
            "The vision has been etched into the Open Source log. The community will consider it.",
        };
      },
    },
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages, {
        tools: architectTools,
      }),
      tools: architectTools,
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
    console.error("[Oracle Architect API]", err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Failed to run Architect Oracle",
        ...(isDev && { detail: message, cause }),
      },
      { status: 500 }
    );
  }
}
