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
