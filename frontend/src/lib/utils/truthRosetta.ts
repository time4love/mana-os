/**
 * Truth Engine — multilingual Rosetta payload (canonical English + optional locale blocks).
 * Canonical `en` is required for embeddings, scoring, and cross-locale arena logic.
 * UI picks `locales[uiLocale]` merged over `en`; missing locale → show English (lingua franca).
 */

export interface RosettaClaimBlock {
  assertion: string;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
}

export interface TruthRosettaNormalized {
  schemaVersion: number;
  pulse: number | null;
  source_locale?: string;
  en: RosettaClaimBlock;
  locales: Record<string, RosettaClaimBlock>;
}

/** True when text is mostly Hebrew letters (LLM sometimes fills "English" slots with Hebrew). */
export function isPrimarilyHebrewScript(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return false;
  const he = (t.match(/[\u0590-\u05FF]/g) ?? []).length;
  const lat = (t.match(/[a-zA-Z]/g) ?? []).length;
  if (he < 8) return false;
  return he >= lat;
}

/**
 * English UI: never show Hebrew mistakenly stored in canonical `en` (rationale / scout).
 * Assertion may stay mixed until LLM always emits English in `en.assertion`.
 */
export function sanitizeCanonicalBlockForEnglishUi(block: RosettaClaimBlock): RosettaClaimBlock {
  return {
    ...block,
    reasoning: isPrimarilyHebrewScript(block.reasoning) ? "" : block.reasoning,
    challengePrompt: isPrimarilyHebrewScript(block.challengePrompt) ? "" : block.challengePrompt,
    hiddenAssumptions: block.hiddenAssumptions.filter((s) => !isPrimarilyHebrewScript(s)),
  };
}

/** Move Hebrew-only EN-slot text into HE slot so `en` stays lingua-franca clean at rest. */
export function partitionBilingualField(enVal: string, heVal: string): { enOut: string; heOut: string } {
  let e = enVal.trim();
  let h = heVal.trim();
  if (isPrimarilyHebrewScript(e)) {
    if (!h) h = e;
    e = "";
  }
  return { enOut: e, heOut: h };
}

function asBlock(raw: unknown): RosettaClaimBlock {
  if (!raw || typeof raw !== "object") {
    return { assertion: "", reasoning: "", hiddenAssumptions: [], challengePrompt: "" };
  }
  const o = raw as Record<string, unknown>;
  const assumptions = o.hiddenAssumptions;
  return {
    assertion: typeof o.assertion === "string" ? o.assertion : "",
    reasoning: typeof o.reasoning === "string" ? o.reasoning : "",
    hiddenAssumptions: Array.isArray(assumptions)
      ? assumptions.filter((x): x is string => typeof x === "string")
      : [],
    challengePrompt: typeof o.challengePrompt === "string" ? o.challengePrompt : "",
  };
}

/**
 * Accepts legacy `{ en, he }` or v2 `{ schemaVersion, en, locales, source_locale }`.
 */
export function normalizeTruthRosetta(parsed: unknown): TruthRosettaNormalized | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (!p.en || typeof p.en !== "object") return null;

  const en = asBlock(p.en);
  const locales: Record<string, RosettaClaimBlock> = {};

  if (p.locales && typeof p.locales === "object" && !Array.isArray(p.locales)) {
    for (const [code, block] of Object.entries(p.locales as Record<string, unknown>)) {
      const k = code.trim().toLowerCase();
      if (k) locales[k] = asBlock(block);
    }
  }
  if (p.he && typeof p.he === "object" && !locales.he) {
    locales.he = asBlock(p.he);
  }

  const pulse =
    typeof p.pulse === "number" && Number.isFinite(p.pulse)
      ? Math.min(100, Math.max(0, p.pulse))
      : null;
  const schemaVersion = typeof p.schemaVersion === "number" ? p.schemaVersion : 1;
  const source_locale = typeof p.source_locale === "string" ? p.source_locale.trim() : undefined;

  return { schemaVersion, pulse, source_locale, en, locales };
}

function pickField(local: string, canonical: string): string {
  const t = local.trim();
  return t.length > 0 ? t : canonical.trim();
}

/** Merge localized strings over canonical; empty local field falls back to English. */
export function mergeRosettaBlockForLocale(
  canonical: RosettaClaimBlock,
  localized: RosettaClaimBlock | undefined
): RosettaClaimBlock {
  if (!localized) return canonical;
  return {
    assertion: pickField(localized.assertion, canonical.assertion),
    reasoning: pickField(localized.reasoning, canonical.reasoning),
    hiddenAssumptions:
      localized.hiddenAssumptions.length > 0
        ? localized.hiddenAssumptions
        : canonical.hiddenAssumptions,
    challengePrompt: pickField(localized.challengePrompt, canonical.challengePrompt),
  };
}

/**
 * Block to show for UI locale. Unknown locale or missing translation → canonical English.
 */
export function getRosettaBlockForUiLocale(
  normalized: TruthRosettaNormalized,
  uiLocale: string
): RosettaClaimBlock {
  const code = uiLocale.trim().toLowerCase();
  if (code === "en" || code === "") {
    return sanitizeCanonicalBlockForEnglishUi({ ...normalized.en });
  }
  const localized = normalized.locales[code] ?? normalized.locales[uiLocale.trim()];
  return mergeRosettaBlockForLocale(normalized.en, localized);
}

/** Serialize v2 payload for truth_nodes.content (Forge anchor). */
export function buildRosettaJsonV2(input: {
  pulse: number;
  source_locale: string;
  en: RosettaClaimBlock;
  locales: Record<string, RosettaClaimBlock>;
}): string {
  return JSON.stringify({
    schemaVersion: 2,
    pulse: input.pulse,
    source_locale: input.source_locale,
    en: input.en,
    locales: input.locales,
  });
}
