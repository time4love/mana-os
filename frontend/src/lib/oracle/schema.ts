import { z } from "zod";

/**
 * Single natural resource requirement (e.g. wood, water, kWh).
 * All keys in English per .cursorrules (AI outputs).
 */
export const NaturalResourceItemSchema = z.object({
  resourceName: z.string().describe("Name of the physical resource, e.g. wood, water, concrete, electricity"),
  quantity: z.coerce.number().nonnegative().describe("Numeric amount required"),
  unit: z.string().describe("Unit of measure, e.g. kg, liters, kWh, cubic meters"),
});

/**
 * Human capital requirement: skill category, proficiency level, and Mana Cycles.
 * Level 0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor per Mana OS RPG model.
 * Effort is measured in Mana Cycles only—never in hours or time.
 */
export const HumanCapitalItemSchema = z.object({
  requiredSkillCategory: z.string().describe("Skill category, e.g. Agriculture, Construction, Teaching"),
  requiredLevel: z.coerce.number().int().min(0).max(3).describe("0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor"),
  manaCycles: z.coerce.number().nonnegative().describe("Number of Mana Cycles (resolutions) required for this role; you calculate this from the physical scope"),
});

/**
 * Strict schema for the AI Oracle's output: a proposal broken down into
 * physical resources and human labor only. No money, prices, or budgets.
 */
export const ProposalResourcePlanSchema = z.object({
  naturalResources: z
    .array(NaturalResourceItemSchema)
    .describe("List of physical materials and energy required"),
  humanCapital: z
    .array(HumanCapitalItemSchema)
    .describe("List of labor requirements by skill and level"),
});

/**
 * Genesis Oracle: community seed output. Minimum critical mass is calculated by the Oracle
 * based on vision scope (e.g. garden = 3, clinic = 50). No money/hours.
 */
export const CommunitySeedSchema = z.object({
  name: z.string().describe("Short name for the community"),
  vision: z.string().describe("The vision or purpose of the community"),
  requiredCriticalMass: z.coerce
    .number()
    .int()
    .min(1)
    .describe("Minimum number of people needed to sustain this vision without burnout; you calculate from scope, location, and Realms"),
});

export type NaturalResourceItem = z.infer<typeof NaturalResourceItemSchema>;
export type HumanCapitalItem = z.infer<typeof HumanCapitalItemSchema>;
export type ProposalResourcePlan = z.infer<typeof ProposalResourcePlanSchema>;
export type CommunitySeed = z.infer<typeof CommunitySeedSchema>;

/**
 * Architect Oracle: open-source feature proposal from a user.
 * philosophicalAlignment describes how the feature aligns with UBA, Resonance, trauma-informed design.
 */
export const SubmitFeatureProposalSchema = z.object({
  featureTitle: z.string().describe("Short title for the proposed feature"),
  philosophicalAlignment: z
    .string()
    .describe(
      "How this feature aligns with Mana OS philosophy: UBA, trauma-informed design, matrix-free, attraction-based resonance, etc."
    ),
  description: z.string().describe("Clear description of the feature for contributors and the roadmap"),
});

export type SubmitFeatureProposal = z.infer<typeof SubmitFeatureProposalSchema>;

/**
 * Oracle Synthesis: output when the Oracle weaves community upgrade seeds into an updated plan.
 * socraticInsight = תבוננות — short reflection on how the community organically evolved the idea.
 */
export const OracleSynthesisOutputSchema = z.object({
  updatedPlan: ProposalResourcePlanSchema.describe(
    "Updated ProposalResourcePlan recalculating Mana Cycles and Natural Resources to include all merged community upgrades"
  ),
  socraticInsight: z
    .string()
    .describe(
      "Short Socratic insight (תבוננות) reflecting on the beauty of how the community organically evolved the idea; 1–3 sentences"
    ),
});

export type OracleSynthesisOutput = z.infer<typeof OracleSynthesisOutputSchema>;

/**
 * Single delta in the Physics Forecast: added or reduced resource / Mana Cycle for an upgrade seed.
 * category: e.g. "Natural" (water, wood) or "Human" (Mana Cycles).
 * change: human-readable delta, e.g. "+50 liters", "+1", "-2 Mana Cycles".
 */
export const PhysicsForecastDeltaSchema = z.object({
  category: z.string().describe("Category of the delta, e.g. Natural (resources) or Human (Mana Cycles)"),
  name: z.string().describe("Name of the resource or role, e.g. Water, Agriculture Cycle"),
  change: z.string().describe("Human-readable change, e.g. '+50 liters', '+1', '-2 Mana Cycles'"),
});

export type PhysicsForecastDelta = z.infer<typeof PhysicsForecastDeltaSchema>;

/**
 * Proposal Oracle (Village Elder): plants the AI's insight as a pending upgrade seed for the community to resonate with.
 * physicsForecast: the physical delta (resources and Mana Cycles) this seed would add—so the community can make resonant choices.
 */
export const PlantOracleSeedSchema = z.object({
  proposalId: z.string().describe("The proposal ID (UUID) to attach this upgrade seed to"),
  suggestedUpgrade: z
    .string()
    .describe("The synthesized ecological or philosophical suggestion to add as a pending upgrade seed; write it clearly for the community"),
  physicsForecast: z
    .array(PhysicsForecastDeltaSchema)
    .describe("The physical delta: list of added or reduced resources and Mana Cycles (e.g. +50 liters Water, +1 Agriculture Cycle) so the community sees the cost before resonating"),
});

export type PlantOracleSeed = z.infer<typeof PlantOracleSeedSchema>;

/**
 * Draft Oracle Seed: generates a visual preview in chat; user approves to plant.
 * No proposalId — the client supplies it from context when calling plantUpgradeSeed.
 */
export const DraftOracleSeedSchema = z.object({
  suggestedUpgrade: z
    .string()
    .describe("The ecological or philosophical suggestion to show as a draft; write it clearly for the community"),
  physicsForecast: z
    .array(PhysicsForecastDeltaSchema)
    .describe("The physical delta: list of added or reduced resources and Mana Cycles (e.g. +50 liters Water, +1 Agriculture Cycle)"),
});

export type DraftOracleSeed = z.infer<typeof DraftOracleSeedSchema>;

/**
 * Gatekeeper Oracle: routing only. Reason is optional context for the target Oracle.
 */
export const GatekeeperRouteSchema = z.object({
  reason: z.string().optional().describe("Brief reason for this route (e.g. user wants new community)"),
});

export type GatekeeperRoute = z.infer<typeof GatekeeperRouteSchema>;
