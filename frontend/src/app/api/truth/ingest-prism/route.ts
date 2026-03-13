/**
 * POST /api/truth/ingest-prism
 * Epistemic Prism ingestion via API route to bypass the 1 MB Server Action body limit.
 * Accepts multipart/form-data with "document" (PDF file) or "text" (raw string).
 */

import { NextResponse } from "next/server";
import { runPrismOnSourceText, pdfBufferToText } from "@/lib/prism/ingestCore";

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_TEXT_LENGTH = 500_000;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("document") as File | null;
    const rawText = formData.get("text") as string | null;
    let sourceText: string;

    if (file && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { success: false, error: "Document too large (max 50 MB)" },
          { status: 400 }
        );
      }
      const type = file.type?.toLowerCase() || "";
      if (!type.includes("pdf")) {
        return NextResponse.json(
          { success: false, error: "Only PDF documents are supported" },
          { status: 400 }
        );
      }
      const ab = await file.arrayBuffer();
      const buffer = Buffer.from(ab);
      sourceText = await pdfBufferToText(buffer);
    } else if (rawText && rawText.trim().length > 0) {
      sourceText = rawText.trim().slice(0, MAX_TEXT_LENGTH);
    } else {
      return NextResponse.json(
        { success: false, error: "Provide a document (PDF) or text" },
        { status: 400 }
      );
    }

    const result = await runPrismOnSourceText(sourceText);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
