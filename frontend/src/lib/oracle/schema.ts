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
 * Human capital requirement: skill category, proficiency level, and time.
 * Level 0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor per Mana OS RPG model.
 */
export const HumanCapitalItemSchema = z.object({
  requiredSkillCategory: z.string().describe("Skill category, e.g. Agriculture, Construction, Teaching"),
  requiredLevel: z.coerce.number().int().min(0).max(3).describe("0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor"),
  estimatedHours: z.coerce.number().nonnegative().describe("Estimated person-hours of labor"),
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

export type NaturalResourceItem = z.infer<typeof NaturalResourceItemSchema>;
export type HumanCapitalItem = z.infer<typeof HumanCapitalItemSchema>;
export type ProposalResourcePlan = z.infer<typeof ProposalResourcePlanSchema>;
