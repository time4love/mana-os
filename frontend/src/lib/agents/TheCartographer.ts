/**
 * The Cartographer — Constellation Graph RAG Agent
 *
 * Maintains abstractive "Living Summaries" per macro-thematic group (constellations).
 * When new truth nodes anchor, syncConstellationMap updates the summary so the Forge
 * can inject Forest-level context (match_constellations) before drilling into nodes.
 */

import { generateText, embed } from "ai";
import { google } from "@ai-sdk/google";
import { createServerSupabase } from "@/lib/supabase/server";

const CARTOGRAPHER_SYSTEM = `You are The Cartographer of Mana OS. A masterful encyclopedia keeper formatting humanity's unadulterated exploration of taboo and raw truths.

You receive an ongoing "Living Summary" detailing current epistemic positions for a thematic constellation. You are presented with newly forged insights approved and anchored into the Weave.

Your task: INTELLIGENTLY update the Living Summary. Maintain a purely clinical map showing strictly:
- **Established pillars** — claims the community has structurally validated or that stand as reference points.
- **Broken premises** — positions that have been formally challenged or falsified with clear logical grounds.
- **Burning debate fronts** — open questions, unresolved tensions, and active Socratic dialogue.

Return purely an intricately updated Markdown document mirroring exactly what the Weave knows at this phase. No preamble, no meta-commentary. Only the updated Living Summary. Preserve structure; add or refine sections as the new insight warrants.`;

/**
 * Syncs the constellation map for a theme: fetches existing living_summary, sends it plus
 * the new node context to Gemini for an updated summary, then upserts the row with new embedding.
 */
export async function syncConstellationMap(themeTag: string, newNodeContext: string): Promise<void> {
  const themeName = themeTag?.trim();
  if (!themeName) return;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return;

  const supabase = createServerSupabase();

  const { data: existingRaw } = await supabase
    .from("epistemic_constellations")
    .select("id, living_summary")
    .eq("theme_name", themeName)
    .maybeSingle();

  const existing = existingRaw as { id?: string; living_summary?: string } | null;
  const currentSummary = (existing?.living_summary)?.trim() ?? "";
  const newContext = newNodeContext?.trim().slice(0, 12000) ?? "";

  const prompt = currentSummary
    ? `Current Living Summary for theme "${themeName}":\n\n${currentSummary}\n\n---\n\nNewly anchored insight to integrate:\n\n${newContext}\n\nProduce the updated Living Summary (Markdown only).`
    : `Theme: "${themeName}". No prior summary. First anchored insight:\n\n${newContext}\n\nProduce the initial Living Summary (Markdown only).`;

  const model = google("gemini-1.5-pro");
  const { text } = await generateText({
    model,
    system: CARTOGRAPHER_SYSTEM,
    prompt,
    temperature: 0.35,
  });

  const livingSummary = (text ?? "").trim();
  if (!livingSummary) return;

  const embeddingResult = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: `${themeName}\n\n${livingSummary}`.slice(0, 8000),
    providerOptions: { google: { outputDimensionality: 768 } },
  });
  const embedding = Array.from(embeddingResult.embedding);

  const updatedAt = new Date().toISOString();

  if (existing?.id) {
    await supabase
      .from("epistemic_constellations")
      .update({ living_summary: livingSummary, embedding, updated_at: updatedAt } as never)
      .eq("id", existing.id as string);
  } else {
    await supabase.from("epistemic_constellations").insert({
      theme_name: themeName,
      living_summary: livingSummary,
      embedding,
      updated_at: updatedAt,
    } as never);
  }
}
