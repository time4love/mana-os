/**
 * Mana OS — Rosetta Protocol V2 Zod schemas.
 * Hebrew locale: strict bilingual (no optional local_translation / no empty reasoning) — anti LLM lazy-token.
 */
import { z } from "zod";

/** Storage / generic block. */
export const RosettaBlockSchema = z.object({
  assertion: z.string().min(1),
  reasoning: z.string().optional(),
  hiddenAssumptions: z.array(z.string()).optional(),
  challengePrompt: z.string().optional(),
});

/** English slot — permissive (English UI / legacy). */
export const CanonicalRosettaBlockSchema = z.object({
  assertion: z
    .string()
    .min(1)
    .describe("MUST be PURE ENGLISH (Latin). NEVER Hebrew."),
  reasoning: z
    .string()
    .optional()
    .describe("MUST be PURE ENGLISH when provided."),
  hiddenAssumptions: z.array(z.string()).optional().describe("English only."),
  challengePrompt: z.string().optional().describe("MUST be PURE ENGLISH when provided."),
});

/**
 * Strict English block for Hebrew-locale pipelines — model cannot omit reasoning/challenge.
 */
export const CanonicalRosettaBlockStrictSchema = z.object({
  assertion: z.string().min(1).describe("MUST be PURE ENGLISH. Core logical premise."),
  reasoning: z
    .string()
    .min(1)
    .describe("MUST be PURE ENGLISH. Full logical explanation — REQUIRED, never empty."),
  hiddenAssumptions: z.array(z.string()).default([]),
  challengePrompt: z
    .string()
    .min(1)
    .describe("MUST be PURE ENGLISH. Falsification / challenge — REQUIRED."),
});

/** Local mirror — permissive. */
export const LocalRosettaBlockSchema = z.object({
  assertion: z.string().min(1),
  reasoning: z.string().optional(),
  hiddenAssumptions: z.array(z.string()).optional(),
  challengePrompt: z.string().optional(),
});

/**
 * Strict Hebrew mirror — REQUIRED fields; stops Gemini skipping Hebrew to save tokens.
 */
export const LocalRosettaBlockStrictSchema = z.object({
  assertion: z.string().min(1).describe("MUST be PURE HEBREW. Exact translation of canonical_en.assertion."),
  reasoning: z
    .string()
    .min(1)
    .describe("MUST be PURE HEBREW. Full mirror of canonical_en.reasoning — REQUIRED."),
  hiddenAssumptions: z.array(z.string()).default([]),
  challengePrompt: z
    .string()
    .min(1)
    .describe("MUST be PURE HEBREW. Mirror of canonical_en.challengePrompt — REQUIRED."),
});

export const CompetingTheoryDraftSchema = z.object({
  canonical_en: CanonicalRosettaBlockSchema,
  local_translation: LocalRosettaBlockSchema.optional(),
});

/** Macro-arena theory pair when UI locale is Hebrew — both blocks complete. */
export const CompetingTheoryStrictSchema = z.object({
  canonical_en: CanonicalRosettaBlockStrictSchema,
  local_translation: LocalRosettaBlockStrictSchema,
});

const EpistemicStateSchema = z.enum(["SOLID", "CONTESTED", "SHATTERED"]).optional();

const EpistemicMoveTypeSchema = z
  .enum([
    "EMPIRICAL_CONTRADICTION",
    "INTERNAL_INCONSISTENCY",
    "EMPIRICAL_VERIFICATION",
    "AD_HOC_RESCUE",
    "APPEAL_TO_AUTHORITY",
  ])
  .describe(
    "Categorize the core tactical nature of this claim. Is it a direct empirical verification? An ad-hoc rescue of a flawed theory? An empirical contradiction?"
  );

/** Hebrew Forge / single-claim draft — local_translation is mandatory. */
export const DraftEpistemicNodeV2HeForgeSchema = z.object({
  canonical_en: CanonicalRosettaBlockStrictSchema,
  source_locale: z.literal("he"),
  local_translation: LocalRosettaBlockStrictSchema,
  epistemicState: EpistemicStateSchema,
  epistemicMoveType: EpistemicMoveTypeSchema.optional(),
  supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]).optional(),
  thematicTags: z.array(z.string()).max(10).optional(),
  matchedExistingNodeId: z.string().nullable().optional(),
  relationshipToContext: z.enum(["supports", "challenges"]).optional(),
  competingTheories: z.array(CompetingTheoryStrictSchema).max(2).optional(),
});

/** Hebrew macro-arena — root + two theories, all bilingual strict. */
export const DraftEpistemicNodeV2HeArenaSchema = z.object({
  canonical_en: CanonicalRosettaBlockStrictSchema,
  source_locale: z.literal("he"),
  local_translation: LocalRosettaBlockStrictSchema,
  epistemicState: EpistemicStateSchema,
  thematicTags: z.array(z.string()).max(10),
  relationshipToContext: z.literal("supports"),
  competingTheories: z.array(CompetingTheoryStrictSchema).length(2),
  matchedExistingNodeId: z.string().nullable().optional(),
});

/** English / loose — optional local_translation; .catch for streaming resilience. */
export const DraftEpistemicNodeV2LooseSchema = z.object({
  canonical_en: z
    .object({
      assertion: z.string().min(1).catch("Assertion unavailable"),
      reasoning: z.string().optional().catch(""),
      hiddenAssumptions: z.array(z.string()).optional().catch([]),
      challengePrompt: z.string().optional().catch(""),
    })
    .catch({ assertion: "Assertion unavailable", reasoning: "" }),
  source_locale: z.string().catch("en"),
  local_translation: LocalRosettaBlockSchema.optional(),
  epistemicState: EpistemicStateSchema,
  epistemicMoveType: EpistemicMoveTypeSchema.optional(),
  supportedTheory: z.enum(["THEORY_A", "THEORY_B", "NEUTRAL"]).optional(),
  thematicTags: z.array(z.string()).max(10).optional().catch([]),
  matchedExistingNodeId: z.string().nullable().optional().catch(null),
  relationshipToContext: z.enum(["supports", "challenges"]).optional().catch("supports"),
  competingTheories: z.array(CompetingTheoryDraftSchema).max(2).optional(),
}).refine((d) => d.source_locale.trim().toLowerCase() !== "he", {
  message: "source_locale he must use DraftEpistemicNodeV2HeForgeSchema (strict bilingual)",
  path: ["source_locale"],
});

/** Anchor: Hebrew → strict schema; otherwise loose. */
export function parseForgeDraftForAnchor(draft: unknown) {
  const sl =
    typeof draft === "object" &&
    draft !== null &&
    typeof (draft as { source_locale?: unknown }).source_locale === "string"
      ? (draft as { source_locale: string }).source_locale.trim().toLowerCase()
      : "";
  if (sl === "he") {
    return DraftEpistemicNodeV2HeForgeSchema.safeParse(draft);
  }
  return DraftEpistemicNodeV2LooseSchema.safeParse(draft);
}

export type AnchorableForgeDraftHe = z.infer<typeof DraftEpistemicNodeV2HeForgeSchema>;
export type AnchorableForgeDraftLoose = z.infer<typeof DraftEpistemicNodeV2LooseSchema>;
export type AnchorableForgeDraft = AnchorableForgeDraftHe | AnchorableForgeDraftLoose;

/** @deprecated Use parseForgeDraftForAnchor */
export const DraftEpistemicNodeV2Schema = z.union([
  DraftEpistemicNodeV2HeForgeSchema,
  DraftEpistemicNodeV2LooseSchema,
]);

export type DraftEpistemicNodeV2Inferred = AnchorableForgeDraft;
