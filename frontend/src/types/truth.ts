/**
 * Mana OS — Fractal Truth Engine (DAG) Types
 *
 * Strictly typed interfaces matching the Supabase schema for the Truth Engine:
 * - truth_nodes: canonical concepts/arguments with optional vector embeddings
 * - truth_edges: DAG mapping (source = thesis, target = supporting/challenging node)
 * - edge_relationship: supports | challenges | ai_analysis
 *
 * Used by the frontend and API layer to interact with the Semantic Graph.
 * All keys remain in English; UI copy is localized elsewhere.
 */

// ---------------------------------------------------------------------------
// Edge relationship (matches DB enum edge_relationship)
// ---------------------------------------------------------------------------

export type EdgeRelationship = "supports" | "challenges" | "ai_analysis";

export const EDGE_RELATIONSHIPS: readonly EdgeRelationship[] = [
  "supports",
  "challenges",
  "ai_analysis",
] as const;

export function isEdgeRelationship(value: string): value is EdgeRelationship {
  return EDGE_RELATIONSHIPS.includes(value as EdgeRelationship);
}

// ---------------------------------------------------------------------------
// Vector embedding (OpenAI text-embedding-3-small: 1536 dimensions)
// ---------------------------------------------------------------------------

export const TRUTH_EMBEDDING_DIMENSIONS = 1536;

export type TruthEmbedding = number[];

// ---------------------------------------------------------------------------
// TruthNode — core concept/argument (table: public.truth_nodes)
// ---------------------------------------------------------------------------

export interface TruthNode {
  /** Primary key (UUID). */
  id: string;
  /** Wallet address of author; nullable for future full-anonymity; used for SBT sync. */
  author_wallet: string | null;
  /** The argument or concept text. */
  content: string;
  /** Vector embedding for semantic search (pgvector); null until computed. */
  embedding: TruthEmbedding | null;
  /** Insert time (UTC). */
  created_at: string;
}

/** Input shape when inserting a node (id and created_at are generated). */
export type TruthNodeInsert = Omit<TruthNode, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/** Shape when updating a node (partial; e.g. setting embedding after compute). */
export type TruthNodeUpdate = Partial<Pick<TruthNode, "content" | "embedding" | "author_wallet">>;

// ---------------------------------------------------------------------------
// TruthEdge — DAG edge (table: public.truth_edges)
// source_id = node being addressed (thesis); target_id = node making the claim
// ---------------------------------------------------------------------------

export interface TruthEdge {
  /** Primary key (UUID). */
  id: string;
  /** The node being addressed (the thesis). */
  source_id: string;
  /** The node making the claim (supports or challenges the source). */
  target_id: string;
  /** Type of relationship. */
  relationship: EdgeRelationship;
  /** Insert time (UTC). */
  created_at: string;
}

/** Input shape when inserting an edge (id and created_at are generated). */
export type TruthEdgeInsert = Omit<TruthEdge, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// match_truth_nodes() result (Semantic Weaver)
// ---------------------------------------------------------------------------

export interface MatchTruthNodeResult {
  id: string;
  content: string;
  /** Cosine similarity in [0, 1]; higher = more similar. */
  similarity: number;
}

// ---------------------------------------------------------------------------
// Epistemic Prism — document deconstruction (AI-extracted claims)
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  assertion: string;
  logicalCoherenceScore: number;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
}

export interface EpistemicPrismResult {
  documentThesis: string;
  extractedClaims: ExtractedClaim[];
}
