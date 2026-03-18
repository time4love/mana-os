/**
 * Mana OS — Fractal Truth Engine (DAG) Types
 *
 * Rosetta Protocol V2: canonical_en + locales; no flat assertionEn/He.
 */

export type EdgeRelationship = "supports" | "challenges" | "ai_analysis";

export const EDGE_RELATIONSHIPS: readonly EdgeRelationship[] = [
  "supports",
  "challenges",
  "ai_analysis",
] as const;

export function isEdgeRelationship(value: string): value is EdgeRelationship {
  return EDGE_RELATIONSHIPS.includes(value as EdgeRelationship);
}

export const TRUTH_EMBEDDING_DIMENSIONS = 768;

export type TruthEmbedding = number[];

// ---------------------------------------------------------------------------
// Rosetta Protocol V2
// ---------------------------------------------------------------------------

export interface RosettaBlock {
  assertion: string;
  reasoning?: string;
  hiddenAssumptions?: string[];
  challengePrompt?: string;
}

export interface TruthNodeContentV2 {
  canonical_en: RosettaBlock;
  source_locale: string;
  locales: Record<string, RosettaBlock>;
}

/** Macro-arena theory stored in metadata (same shape as node slice for getDisplayBlock). */
export interface CompetingTheoryV2 {
  canonical_en: RosettaBlock;
  source_locale: string;
  locales: Record<string, RosettaBlock>;
}

export interface TruthNodeMetadata {
  competingTheories?: CompetingTheoryV2[];
}

export interface TruthNode {
  id: string;
  author_wallet: string | null;
  content: string;
  embedding: TruthEmbedding | null;
  created_at: string;
  is_macro_root?: boolean;
  thematic_tags?: string[];
  metadata?: TruthNodeMetadata;
  resonance_count?: number;
}

export type TruthNodeInsert = Omit<TruthNode, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type TruthNodeUpdate = Partial<
  Pick<TruthNode, "content" | "embedding" | "author_wallet" | "is_macro_root" | "thematic_tags">
>;

export interface TruthEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: EdgeRelationship;
  created_at: string;
}

export type TruthEdgeInsert = Omit<TruthEdge, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export interface MatchTruthNodeResult {
  id: string;
  content: string;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Forge / Oracle drafts (AI → anchor)
// ---------------------------------------------------------------------------

export interface DraftEpistemicNodeV2 {
  canonical_en: RosettaBlock;
  source_locale: string;
  local_translation?: RosettaBlock;
  logicalCoherenceScore: number;
  supportedTheory?: "THEORY_A" | "THEORY_B" | "NEUTRAL";
  thematicTags?: string[];
  matchedExistingNodeId?: string | null;
  relationshipToContext?: "supports" | "challenges";
  competingTheories?: Array<{
    canonical_en: RosettaBlock;
    local_translation?: RosettaBlock;
  }>;
}

/** @deprecated Use DraftEpistemicNodeV2 */
export type ForgeDraftBilingual = DraftEpistemicNodeV2;

// ---------------------------------------------------------------------------
// Epistemic Prism
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
// Graph traversal
// ---------------------------------------------------------------------------

export interface ChildrenByRelationship {
  supports: TruthNode[];
  challenges: TruthNode[];
  ai_analysis: TruthNode[];
}

export interface ParentWithRelationship {
  node: TruthNode;
  relationship: EdgeRelationship;
}

export interface TruthNodeWithRelations {
  node: TruthNode;
  childrenByRelationship: ChildrenByRelationship;
  parents: ParentWithRelationship[];
}

export interface MacroRootWithMeta {
  node: TruthNode;
  claimsCount: number;
}

export interface AgentTraceEntry {
  agent: string;
  task: string;
  timeMs: number;
  found?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Transcript Sieve
// ---------------------------------------------------------------------------

export type SieveSupportedTheory = "THEORY_A" | "THEORY_B" | "NEUTRAL";

export interface SieveProcessedClaim {
  canonical_en: RosettaBlock;
  source_locale: string;
  local_translation?: RosettaBlock;
  logicalCoherenceScore: number;
  supportedTheory: SieveSupportedTheory;
  matchedExistingNodeId?: string | null;
}

export interface SieveTelemetry {
  extractedCount: number;
  processedCount: number;
  duplicateCount: number;
}

export interface SieveRunResult {
  processedClaims: SieveProcessedClaim[];
  telemetry?: SieveTelemetry;
}
