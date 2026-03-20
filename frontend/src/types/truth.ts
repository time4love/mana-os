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

export type EpistemicState = "SOLID" | "CONTESTED" | "SHATTERED";

export type EpistemicMoveType =
  | "EMPIRICAL_CONTRADICTION"
  | "INTERNAL_INCONSISTENCY"
  | "EMPIRICAL_VERIFICATION"
  | "AD_HOC_RESCUE"
  | "APPEAL_TO_AUTHORITY";

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
  epistemic_state?: EpistemicState;
  epistemic_move?: EpistemicMoveType | null;
  /** Sharpening lineage: prior version of this claim (append-only). */
  previous_version_id?: string | null;
}

export type TruthNodeInsert = Omit<TruthNode, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type TruthNodeUpdate = Partial<
  Pick<
    TruthNode,
    "content" | "embedding" | "author_wallet" | "is_macro_root" | "thematic_tags" | "previous_version_id"
  >
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

/** POST `/api/oracle/forge` — `debateIntent` shapes how the drafter frames the new node / edge. */
export type ForgeDebateIntent = "challenges" | "sharpens" | "TACTICAL_STRIKE";

export interface DraftEpistemicNodeV2 {
  canonical_en: RosettaBlock;
  source_locale: string;
  local_translation?: RosettaBlock;
  epistemicState?: EpistemicState;
  epistemicMoveType?: EpistemicMoveType;
  supportedTheory?: "THEORY_A" | "THEORY_B" | "NEUTRAL";
  thematicTags?: string[];
  matchedExistingNodeId?: string | null;
  /** challenges = attack edge under parent; sharpens = upgraded claim version (linked via DB `previous_version_id`). */
  relationshipToContext?: "challenges" | "sharpens";
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
  epistemicState?: EpistemicState;
  epistemicMoveType?: EpistemicMoveType;
  supportedTheory: SieveSupportedTheory;
  matchedExistingNodeId?: string | null;
  /** Auto cross-match: if this claim directly attacks/supports an existing node, set by Sieve Logician. */
  crossMatchTargetId?: string | null;
  crossMatchRelationship?: "supports" | "challenges" | null;
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
