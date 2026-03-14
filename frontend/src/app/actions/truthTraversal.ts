"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  TruthNode,
  TruthNodeWithRelations,
  ChildrenByRelationship,
  MacroRootWithMeta,
} from "@/types/truth";
import { isEdgeRelationship } from "@/types/truth";

export type FetchTruthNodeResult =
  | { success: true; data: TruthNodeWithRelations }
  | { success: false; error: string };

function rowToNode(row: {
  id: string;
  author_wallet: string | null;
  content: string;
  created_at: string;
  is_macro_root?: boolean;
  thematic_tags?: string[] | null;
}): TruthNode {
  return {
    id: row.id,
    author_wallet: row.author_wallet,
    content: row.content,
    embedding: null,
    created_at: row.created_at,
    is_macro_root: row.is_macro_root ?? false,
    thematic_tags: Array.isArray(row.thematic_tags) ? row.thematic_tags : undefined,
  };
}

/**
 * Fetches a single truth node by id with its relational layer: child nodes
 * (outgoing edges, grouped by supports / challenges / ai_analysis) and parent
 * nodes (incoming edges) for breadcrumb navigation.
 */
export async function fetchTruthNodeWithRelations(nodeId: string): Promise<FetchTruthNodeResult> {
  try {
    const supabase = createServerSupabase();

    const { data: nodeRow, error: nodeError } = await supabase
      .from("truth_nodes")
      .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags")
      .eq("id", nodeId)
      .single();

    if (nodeError || !nodeRow) {
      return { success: false, error: nodeError?.message ?? "Node not found" };
    }

    type NodeRow = { id: string; author_wallet: string | null; content: string; created_at: string; is_macro_root: boolean; thematic_tags?: string[] | null };
    const node = rowToNode(nodeRow as NodeRow);

    // Children: edges where this node is the source (source_id = nodeId); target_id = child
    const { data: childEdgesData, error: childEdgesError } = await supabase
      .from("truth_edges")
      .select("target_id, relationship")
      .eq("source_id", nodeId);

    const childEdges = (childEdgesData ?? []) as { target_id: string; relationship: string }[];
    const childrenByRelationship: ChildrenByRelationship = {
      supports: [],
      challenges: [],
      ai_analysis: [],
    };

    if (!childEdgesError && childEdges.length) {
      const targetIds = [...new Set(childEdges.map((e) => e.target_id))];
      const { data: childRowsData } = await supabase
        .from("truth_nodes")
        .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags")
        .in("id", targetIds);

      const childRows = (childRowsData ?? []) as NodeRow[];
      const childMap = new Map<string | null, TruthNode>();
      childRows.forEach((row) => childMap.set(row.id, rowToNode(row)));

      for (const edge of childEdges) {
        const rel = edge.relationship;
        if (!isEdgeRelationship(rel)) continue;
        const child = childMap.get(edge.target_id) ?? null;
        if (child) childrenByRelationship[rel].push(child);
      }
    }

    // Parents: edges where this node is the target (target_id = nodeId); source_id = parent
    const { data: parentEdgesData, error: parentEdgesError } = await supabase
      .from("truth_edges")
      .select("source_id")
      .eq("target_id", nodeId);

    const parentEdges = (parentEdgesData ?? []) as { source_id: string }[];
    let parents: TruthNode[] = [];
    if (!parentEdgesError && parentEdges.length) {
      const parentIds = [...new Set(parentEdges.map((e) => e.source_id))];
      const { data: parentRowsData } = await supabase
        .from("truth_nodes")
        .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags")
        .in("id", parentIds);
      const parentRows = (parentRowsData ?? []) as NodeRow[];
      parents = parentRows.map(rowToNode);
    }

    const data: TruthNodeWithRelations = {
      node,
      childrenByRelationship,
      parents,
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Traversal failed";
    return { success: false, error: message };
  }
}

const MACRO_ROOTS_LIMIT = 20;

/**
 * Fetches macro-root nodes for the Truth hub (Gates of the Weave). Only document
 * theses and standalone premises (is_macro_root = true) appear here; sub-claims
 * are shown only inside the Endless Dive for each macro.
 */
export async function fetchMacroRoots(): Promise<MacroRootWithMeta[]> {
  try {
    const supabase = createServerSupabase();

    const { data: rowsData, error } = await supabase
      .from("truth_nodes")
      .select("id, author_wallet, content, created_at, is_macro_root, thematic_tags")
      .eq("is_macro_root", true)
      .order("created_at", { ascending: false })
      .limit(MACRO_ROOTS_LIMIT);

    if (error) return [];
    type NodeRow = { id: string; author_wallet: string | null; content: string; created_at: string; is_macro_root: boolean; thematic_tags?: string[] | null };
    const rows = (rowsData ?? []) as NodeRow[];
    if (!rows.length) return [];

    const nodeIds = rows.map((r) => r.id);
    const { data: edgeRowsData } = await supabase
      .from("truth_edges")
      .select("source_id")
      .in("source_id", nodeIds);

    const edgeRows = (edgeRowsData ?? []) as { source_id: string }[];
    const countBySource = new Map<string, number>();
    for (const e of edgeRows) {
      countBySource.set(e.source_id, (countBySource.get(e.source_id) ?? 0) + 1);
    }

    return rows.map((row) => ({
      node: rowToNode(row),
      claimsCount: countBySource.get(row.id) ?? 0,
    }));
  } catch {
    return [];
  }
}
