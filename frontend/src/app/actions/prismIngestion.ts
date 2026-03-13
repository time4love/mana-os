"use server";

import type { EpistemicPrismResult } from "@/types/truth";
import { runPrismOnSourceText, pdfBufferToText } from "@/lib/prism/ingestCore";

export type { IngestPrismResult } from "@/lib/prism/ingestCore";

const MAX_PDF_BYTES_SA = 1024 * 1024; // 1 MB — keep under SA limit; use API route for larger files
const MAX_TEXT_LENGTH = 500_000;

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Ingests a document (PDF or text) via Server Action. For PDFs or large text, the client
 * should use POST /api/truth/ingest-prism instead to avoid the 1 MB Server Action body limit.
 */
export async function ingestDocumentAsPrism(
  formData: FormData
): Promise<{ success: true; data: EpistemicPrismResult } | { success: false; error: string }> {
  try {
    const file = formData.get("document") as File | null;
    const rawText = formData.get("text") as string | null;
    let sourceText: string;

    if (file && file.size > 0) {
      if (file.size > MAX_PDF_BYTES_SA) {
        return { success: false, error: "File too large for this path. Use the upload button (sends via API route for large PDFs)." };
      }
      const type = file.type?.toLowerCase() || "";
      if (!type.includes("pdf")) {
        return { success: false, error: "Only PDF documents are supported" };
      }
      try {
        const ab = await file.arrayBuffer();
        const buffer = Buffer.from(ab);
        sourceText = await pdfBufferToText(buffer);
      } catch (err) {
        return { success: false, error: toErrorMessage(err) || "Failed to parse PDF" };
      }
    } else if (rawText && rawText.trim().length > 0) {
      sourceText = rawText.trim().slice(0, MAX_TEXT_LENGTH);
    } else {
      return { success: false, error: "Provide a document (PDF) or text" };
    }

    return runPrismOnSourceText(sourceText);
  } catch (err) {
    return { success: false, error: toErrorMessage(err) || "Prism analysis failed" };
  }
}
