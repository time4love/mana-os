import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Normalize thematic_tags from DB (array or scalar). */
function hasMacroArenaTag(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.includes("macro-arena");
  if (typeof raw === "string") return raw === "macro-arena";
  return false;
}

/**
 * After inserting challenge edges, mark attacked **claim** parents as CONTESTED (SOLID → CONTESTED).
 * Skips sources tagged `macro-arena` so arena roots are not "contested" by column-placement edges.
 */
export async function markSourcesContestedForChallenges(
  supabase: SupabaseClient<Database>,
  edges: { source_id: string; relationship: string }[]
): Promise<void> {
  const sourceIds = [
    ...new Set(edges.filter((e) => e.relationship === "challenges").map((e) => e.source_id)),
  ];
  if (sourceIds.length === 0) return;

  const { data: rows, error } = await supabase
    .from("truth_nodes")
    .select("id, thematic_tags")
    .in("id", sourceIds);

  if (error || !rows?.length) return;

  const claimParentIds = rows
    .filter((row) => !hasMacroArenaTag((row as { thematic_tags?: unknown }).thematic_tags))
    .map((row) => (row as { id: string }).id)
    .filter(Boolean);

  if (claimParentIds.length === 0) return;

  await supabase
    .from("truth_nodes")
    .update({ epistemic_state: "CONTESTED" } as never)
    .in("id", claimParentIds)
    .eq("epistemic_state", "SOLID");
}
