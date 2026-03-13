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
import type { EpistemicPrismResult, ExtractedClaim } from "@/types/truth";

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
    const file = (formData.get("file") ?? formData.get("document")) as File | null;
    const rawTextParam = formData.get("text") as string | null;

    let sourceText: string;

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
    } else if (rawTextParam?.trim()) {
      sourceText = rawTextParam.trim().slice(0, MAX_TEXT_LENGTH);
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

    const [claims, documentThesis] = await Promise.all([
      extractClaims(trimmed),
      getDocumentThesis(trimmed),
    ]);

    if (claims.length === 0) {
      const result: EpistemicPrismResult = {
        documentThesis: documentThesis || "No distinct claims could be extracted.",
        extractedClaims: [],
      };
      return NextResponse.json({ success: true, data: result });
    }

    const extractedClaims: ExtractedClaim[] = await Promise.all(
      claims.map(async (assertion): Promise<ExtractedClaim> => {
        const [logic, scout] = await Promise.all([
          evaluateLogic(assertion),
          findHiddenAssumptions(assertion),
        ]);
        return {
          assertion,
          logicalCoherenceScore: logic.coherenceScore,
          reasoning: logic.logicalReasoning,
          hiddenAssumptions: scout.hiddenAssumptions,
          challengePrompt: scout.falsificationChallenge,
        };
      })
    );

    const result: EpistemicPrismResult = {
      documentThesis: documentThesis || "Epistemic breakdown (no single thesis extracted).",
      extractedClaims,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = toErrorMessage(err) || "Prism pipeline failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
