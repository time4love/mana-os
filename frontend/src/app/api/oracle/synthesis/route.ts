import { NextResponse } from "next/server";
import { runOracleSynthesis } from "@/lib/oracle/runSynthesis";

export const maxDuration = 30;

export async function POST(request: Request) {
  let body: { proposalId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const proposalId = typeof body.proposalId === "string" ? body.proposalId.trim() : null;
  if (!proposalId) {
    return NextResponse.json(
      { error: "proposalId is required" },
      { status: 400 }
    );
  }

  const result = await runOracleSynthesis(proposalId);

  if (!result.success) {
    if (result.error === "OPENAI_API_KEY is not configured" || result.error === "OpenAI model not available") {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    if (result.error === "Proposal not found") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if (result.error === "No merged upgrade seeds to synthesize") {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    socraticInsight: result.socraticInsight,
  });
}
