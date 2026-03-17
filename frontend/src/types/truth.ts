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
// Vector embedding (Google gemini-embedding-001, outputDimensionality: 768)
// ---------------------------------------------------------------------------

export const TRUTH_EMBEDDING_DIMENSIONS = 768;

export type TruthEmbedding = number[];

// ---------------------------------------------------------------------------
// TruthNode — core concept/argument (table: public.truth_nodes)
// ---------------------------------------------------------------------------

/** Competing theories for a Macro-Arena (stored in node.metadata). */
export interface CompetingTheory {
  assertionEn: string;
  assertionHe: string;
}

/** Node metadata (e.g. competingTheories for macro-arenas). */
export interface TruthNodeMetadata {
  competingTheories?: CompetingTheory[];
}

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
  /** True for document theses and standalone premises (hub entry points); false for sub-claims. */
  is_macro_root?: boolean;
  /** Macro-themes for constellation grouping (e.g. Cosmology, Space Hoax, Finance). */
  thematic_tags?: string[];
  /** Extensible metadata (e.g. competingTheories for macro-arenas). */
  metadata?: TruthNodeMetadata;
  /** Epistemic Resonance votes from verified SBT holders. Multiplier: mass = baseScore * (1 + resonance_count * 0.2). */
  resonance_count?: number;
}

/** Input shape when inserting a node (id and created_at are generated). */
export type TruthNodeInsert = Omit<TruthNode, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

/** Shape when updating a node (partial; e.g. setting embedding after compute). */
export type TruthNodeUpdate = Partial<
  Pick<TruthNode, "content" | "embedding" | "author_wallet" | "is_macro_root" | "thematic_tags">
>;

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
// Universal Rosetta Node — bilingual storage (en = vector/algorithm, he = display)
// ---------------------------------------------------------------------------

/** Per-language block for a single epistemic node (assertion, reasoning, scout). */
export interface RosettaContentBlock {
  assertion: string;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
}

/** Stored in truth_nodes.content when using Rosetta format: en + he for global vector + localized UI. */
export interface RosettaContentJson {
  en: RosettaContentBlock;
  he: RosettaContentBlock;
}

/** Type guard: true if raw content is stringified RosettaContentJson. */
export function isRosettaContentJson(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw.trim()) return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.includes('"en"') || !trimmed.includes('"he"')) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "en" in parsed &&
      "he" in parsed &&
      typeof (parsed as RosettaContentJson).en === "object" &&
      typeof (parsed as RosettaContentJson).he === "object"
    );
  } catch {
    return false;
  }
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

// ---------------------------------------------------------------------------
// Forge draft — bilingual tool output (Universal English + Hebrew)
// ---------------------------------------------------------------------------

/** Competing theory for Macro-Arena (Theory A / Theory B). */
export interface CompetingTheory {
  assertionEn: string;
  assertionHe: string;
}

export interface ForgeDraftBilingual {
  assertionEn: string;
  assertionHe: string;
  reasoningEn: string;
  reasoningHe: string;
  hiddenAssumptionsEn: string[];
  hiddenAssumptionsHe: string[];
  challengePromptEn: string;
  challengePromptHe: string;
  logicalCoherenceScore: number;
  relationshipToContext?: "supports" | "challenges";
  thematicTags?: string[];
  /** For macro-arena: exactly 2 competing theories (Theory A vs Theory B). */
  competingTheories?: CompetingTheory[];
}

// ---------------------------------------------------------------------------
// Graph traversal — node with children and parents (Endless Dive)
// ---------------------------------------------------------------------------

/** Child nodes grouped by edge relationship for a single focal node. */
export interface ChildrenByRelationship {
  supports: TruthNode[];
  challenges: TruthNode[];
  ai_analysis: TruthNode[];
}

/** Parent node plus the edge relationship (for breadcrumbs: supports → THEORY_A, challenges → THEORY_B). */
export interface ParentWithRelationship {
  node: TruthNode;
  relationship: EdgeRelationship;
}

/** Focal node plus its relational layer for viewport rendering. */
export interface TruthNodeWithRelations {
  node: TruthNode;
  childrenByRelationship: ChildrenByRelationship;
  parents: ParentWithRelationship[];
}

/** Macro root node with claim count for hub portals ("Dismantled to n claims"). */
export interface MacroRootWithMeta {
  node: TruthNode;
  claimsCount: number;
}

/** Agentic telemetry entry for Swarm Observer (Architect Mode). */
export interface AgentTraceEntry {
  agent: string;
  task: string;
  timeMs: number;
  found?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Transcript Sieve (Bulk Ingestion & Theory Alignment)
// ---------------------------------------------------------------------------

/** Which competing theory a claim supports (or neutral). */
export type SieveSupportedTheory = "THEORY_A" | "THEORY_B" | "NEUTRAL";

/** Single claim after Extractor + Scout (RAG) + Logician & Aligner (Harvest Dashboard item). */
export interface SieveProcessedClaim {
  assertionEn: string;
  assertionHe: string;
  logicalCoherenceScore: number;
  supportedTheory: SieveSupportedTheory;
  reasoning: string;
  /** Set when Scout finds a near-exact semantic match in the weave (deduplication). */
  matchedExistingNodeId?: string | null;
}

/** Telemetry returned by the Sieve pipeline (Extractor → Scout → Logician). */
export interface SieveTelemetry {
  /** Raw claims from Extractor before limit. */
  extractedCount: number;
  /** Claims passed to Scout + Logician (capped by MAX_CLAIMS_TO_PROCESS). */
  processedCount: number;
  /** Claims that matched an existing node in the weave (Scout deduplication). */
  duplicateCount: number;
}

/** Response from POST /api/oracle/sieve (run sieve only; no DB write). */
export interface SieveRunResult {
  processedClaims: SieveProcessedClaim[];
  telemetry?: SieveTelemetry;
}
