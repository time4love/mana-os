/**
 * Mana OS — AI Oracle & Resource Plan Types
 *
 * These types describe the structured JSON output produced by the AI Oracle (LLM)
 * when analyzing a community proposal. All keys are in English for system stability;
 * user-facing text may be localized elsewhere.
 *
 * Mana = regenerative energy (Natural Resources + Human Capital + Action Potential).
 * No fiat, currency, or financial concepts.
 */

// ---------------------------------------------------------------------------
// Proficiency levels (must align with contract enum: Apprentice=0 … Mentor=3)
// ---------------------------------------------------------------------------

export type ProficiencyLevel = 0 | 1 | 2 | 3;

export const PROFICIENCY_LEVELS = {
  Apprentice: 0,
  Basic: 1,
  Advanced: 2,
  Mentor: 3,
} as const satisfies Record<string, ProficiencyLevel>;

// ---------------------------------------------------------------------------
// Natural Resource — physical inputs (water, wood, kWh, etc.)
// ---------------------------------------------------------------------------

export interface NaturalResource {
  /** Resource name (e.g. "Wood", "Water", "Solar kWh"). */
  name: string;
  /** Unit of measure (e.g. "kg", "L", "kWh"). */
  unit: string;
  /** Quantity required. */
  amount: number;
}

// ---------------------------------------------------------------------------
// Human Capital — skills and Mana Cycles required (no hours/time)
// ---------------------------------------------------------------------------

export interface HumanCapital {
  /** Skill category (e.g. "Carpentry", "Electrical"). */
  skillCategory: string;
  /** Required proficiency level (0=Apprentice … 3=Mentor). */
  requiredLevel: ProficiencyLevel;
  /** Number of Mana Cycles (resolutions) required; calculated by the Oracle from physical scope. */
  manaCycles: number;
}

// ---------------------------------------------------------------------------
// Proposal Resource Plan — full AI Oracle output for a proposal
// ---------------------------------------------------------------------------

export interface ProposalResourcePlan {
  /** Natural resources required for the proposal. */
  naturalResources: NaturalResource[];
  /** Human capital (skills + level + Mana Cycles) required. */
  humanCapital: HumanCapital[];
  /**
   * Abstract score representing total energy required to execute the proposal.
   * Not money; used for prioritization and Mana budgeting only.
   */
  estimatedManaEnergy: number;
}
