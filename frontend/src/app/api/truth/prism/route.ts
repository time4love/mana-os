/**
 * POST /api/truth/prism
 *
 * Epistemic Prism Agentic Swarm — Multipart API Route.
 * Bypasses Next.js Server Actions body limits by using native FormData/Multipart.
 *
 * Pipeline:
 * 1. Parse PDF (or use raw text) from request body.
 * 2. The Sieve: extract distinct logical claims.
 * 3. Document thesis: one-sentence summary (parallel with Sieve).
 * 4. For each claim: The Logician + The Scout in parallel.
 * 5. Return unified EpistemicPrismResult.
 *
 * Solarpunk-aligned: structure mapping, no authority appeal; community falsification.
 */

import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { pdfBufferToText } from "@/lib/prism/ingestCore";
import { extractClaims } from "@/lib/agents/TheSieve";
import { evaluateLogic } from "@/lib/agents/TheLogician";
import { findHiddenAssumptions } from "@/lib/agents/TheScout";
import type { EpistemicPrismResult, ExtractedClaim, AgentTraceEntry } from "@/types/truth";

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_TEXT_LENGTH = 500_000;

/** One-sentence document thesis for EpistemicPrismResult (no extra agent file). */
async function getDocumentThesis(rawText: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || rawText.trim().length < 20) return "";

  const model = google("gemini-2.5-pro");
  const schema = z.object({
    documentThesis: z.string().describe("The central thesis of the document in one sentence"),
  });
  const { object } = await generateObject({
    model,
    schema,
    schemaName: "DocumentThesis",
    schemaDescription: "Single-sentence thesis of the document",
    system: "You are a neutral summarizer. State the document's central thesis in one clear sentence. No authority appeal.",
    prompt: `State the central thesis of this document in one sentence.\n\n---\n${rawText.slice(0, 100_000)}`,
  });
  const o = object as { documentThesis?: string };
  return typeof o?.documentThesis === "string" ? o.documentThesis.trim() : "";
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const architectMode = formData.get("architectMode") === "true";
    const file = (formData.get("file") ?? formData.get("document")) as File | null;
    const rawTextParam = formData.get("text") as string | null;

    const agentTraces: AgentTraceEntry[] = [];
    const trace = (agent: string, task: string, timeMs: number, extra?: { found?: number; status?: string }) => {
      agentTraces.push({ agent, task, timeMs, ...extra });
    };

    let sourceText: string;

    const t0 = Date.now();
    if (file && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { success: false, error: "Document too large (max 50 MB)" },
          { status: 400 }
        );
      }
      const type = (file.type ?? "").toLowerCase();
      if (!type.includes("pdf")) {
        return NextResponse.json(
          { success: false, error: "Only PDF documents are supported" },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      sourceText = await pdfBufferToText(buffer);
      if (architectMode) trace("PDF Parser", "PDF buffer to text", Date.now() - t0, { found: sourceText.length });
    } else if (rawTextParam?.trim()) {
      sourceText = rawTextParam.trim().slice(0, MAX_TEXT_LENGTH);
      if (architectMode) trace("Input", "Raw text ingestion", Date.now() - t0, { found: sourceText.length });
    } else {
      return NextResponse.json(
        { success: false, error: "Provide a PDF file (field 'file' or 'document') or 'text'" },
        { status: 400 }
      );
    }

    const trimmed = sourceText.trim();
    if (trimmed.length < 50) {
      return NextResponse.json(
        { success: false, error: "Document or text too short to analyze" },
        { status: 400 }
      );
    }

    const tSieve = Date.now();
    const [claims, documentThesis] = await Promise.all([
      extractClaims(trimmed),
      getDocumentThesis(trimmed),
    ]);
    if (architectMode) {
      trace("The Sieve", "PDF Parsing & Claim Extraction", Date.now() - tSieve, { found: claims.length });
    }

    if (claims.length === 0) {
      const result: EpistemicPrismResult = {
        documentThesis: documentThesis || "No distinct claims could be extracted.",
        extractedClaims: [],
      };
      return NextResponse.json(
        architectMode ? { success: true, data: result, agentTraces } : { success: true, data: result }
      );
    }

    const extractedClaims: ExtractedClaim[] = [];
    for (let i = 0; i < claims.length; i++) {
      const assertion = claims[i];
      let logic: { coherenceScore: number; logicalReasoning: string };
      let scout: { hiddenAssumptions: string[]; falsificationChallenge: string };
      if (architectMode) {
        const tLogician = Date.now();
        logic = await evaluateLogic(assertion);
        trace(
          "The Logician",
          `Validating structural soundness of Claim ${i + 1}…`,
          Date.now() - tLogician,
          { status: `Scored ${logic.coherenceScore}/100` }
        );
        const tScout = Date.now();
        scout = await findHiddenAssumptions(assertion);
        trace(
          "The Scout",
          `Hidden assumptions for Claim ${i + 1}`,
          Date.now() - tScout,
          { status: `Found ${scout.hiddenAssumptions.length} assumption(s)` }
        );
      } else {
        [logic, scout] = await Promise.all([
          evaluateLogic(assertion),
          findHiddenAssumptions(assertion),
        ]);
      }
      extractedClaims.push({
        assertion,
        logicalCoherenceScore: logic.coherenceScore,
        reasoning: logic.logicalReasoning,
        hiddenAssumptions: scout.hiddenAssumptions,
        challengePrompt: scout.falsificationChallenge,
      });
    }

    const result: EpistemicPrismResult = {
      documentThesis: documentThesis || "Epistemic breakdown (no single thesis extracted).",
      extractedClaims,
    };

    return NextResponse.json(
      architectMode ? { success: true, data: result, agentTraces } : { success: true, data: result }
    );
  } catch (err) {
    const message = toErrorMessage(err) || "Prism pipeline failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
