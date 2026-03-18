/**
 * Rosetta Protocol V2 — canonical English + extensible locales; single display resolver.
 */

import type { RosettaBlock, TruthNodeContentV2 } from "@/types/truth";

const HEBREW_SCRIPT = /[\u0590-\u05FF]/;

/** Regex-level failsafe: LLM sometimes puts Hebrew in the "English" slot and English in the "local" slot. */
export function fixBilingualFlipping(enText: string, heText: string): { enOut: string; heOut: string } {
  const enStr = (enText ?? "").trim();
  const heStr = (heText ?? "").trim();
  const enHasHebrew = HEBREW_SCRIPT.test(enStr);
  const heHasHebrew = HEBREW_SCRIPT.test(heStr);
  if (enHasHebrew && !heHasHebrew && heStr.length > 0) {
    return { enOut: heStr, heOut: enStr };
  }
  return { enOut: enStr, heOut: heStr };
}

export function fixBilingualArrayFlipping(
  enArr: string[],
  heArr: string[]
): { enOut: string[]; heOut: string[] } {
  const safeEn = Array.isArray(enArr) ? [...enArr] : [];
  const safeHe = Array.isArray(heArr) ? [...heArr] : [];
  const enHasHebrew = safeEn.some((s) => HEBREW_SCRIPT.test((s ?? "").trim()));
  const heHasHebrew = safeHe.some((s) => HEBREW_SCRIPT.test((s ?? "").trim()));
  if (enHasHebrew && !heHasHebrew && safeHe.length > 0) {
    return { enOut: safeHe, heOut: safeEn };
  }
  return { enOut: safeEn, heOut: safeHe };
}

function primaryLine(block: RosettaBlock): string {
  const a = (block.assertion ?? "").trim();
  if (a.length > 0) return a;
  return (block.reasoning ?? "").trim();
}

/**
 * Rosetta V2 failsafe: if canonical_en reads as Hebrew and local_translation reads as Latin English, swap blocks.
 */
export function fixRosettaV2BlockFlip(
  canonical_en: RosettaBlock,
  local_translation: RosettaBlock | undefined
): { canonical_en: RosettaBlock; local_translation?: RosettaBlock } {
  if (!local_translation) {
    return { canonical_en, local_translation };
  }
  const canon = primaryLine(canonical_en);
  const local = primaryLine(local_translation);
  if (!local) {
    return { canonical_en, local_translation };
  }
  const canonHasHebrew = HEBREW_SCRIPT.test(canon);
  const localHasHebrew = HEBREW_SCRIPT.test(local);
  const localLooksLatin = /[a-zA-Z]{3,}/.test(local);
  if (canonHasHebrew && !localHasHebrew && localLooksLatin) {
    return { canonical_en: local_translation, local_translation: canonical_en };
  }
  return { canonical_en, local_translation };
}

export type DraftLikeForFlip = {
  canonical_en: RosettaBlock;
  local_translation?: RosettaBlock;
  competingTheories?: Array<{ canonical_en: RosettaBlock; local_translation?: RosettaBlock }>;
};

export function fixDraftRosettaV2Flip<T extends DraftLikeForFlip>(draft: T): T {
  const top = fixRosettaV2BlockFlip(draft.canonical_en, draft.local_translation);
  let competing = draft.competingTheories;
  if (Array.isArray(competing) && competing.length > 0) {
    competing = competing.map((ct) => {
      const f = fixRosettaV2BlockFlip(ct.canonical_en, ct.local_translation);
      return { ...ct, canonical_en: f.canonical_en, local_translation: f.local_translation };
    });
  }
  return { ...draft, ...top, competingTheories: competing };
}

function normalizeBlock(raw: unknown): RosettaBlock {
  if (!raw || typeof raw !== "object") {
    return { assertion: "" };
  }
  const o = raw as Record<string, unknown>;
  const assumptions = o.hiddenAssumptions;
  return {
    assertion: typeof o.assertion === "string" ? o.assertion : "",
    reasoning: typeof o.reasoning === "string" ? o.reasoning : undefined,
    hiddenAssumptions: Array.isArray(assumptions)
      ? assumptions.filter((x): x is string => typeof x === "string")
      : undefined,
    challengePrompt: typeof o.challengePrompt === "string" ? o.challengePrompt : undefined,
  };
}

function normalizeLocales(raw: unknown): Record<string, RosettaBlock> {
  const out: Record<string, RosettaBlock> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [code, block] of Object.entries(raw as Record<string, unknown>)) {
    const k = code.trim().toLowerCase();
    if (k) out[k] = normalizeBlock(block);
  }
  return out;
}

/** Parsed stored node content (JSONB string → object). */
export interface TruthNodeStoredV2 extends TruthNodeContentV2 {
  schemaVersion: 2;
  pulse?: number;
}

export function parseTruthNodeContentJson(raw: string): TruthNodeStoredV2 | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t.startsWith("{")) return null;
  try {
    const p = JSON.parse(t) as Record<string, unknown>;
    if (!p.canonical_en || typeof p.canonical_en !== "object") return null;
    const pulse =
      typeof p.pulse === "number" && Number.isFinite(p.pulse)
        ? Math.min(100, Math.max(0, p.pulse))
        : undefined;
    return {
      schemaVersion: 2,
      canonical_en: normalizeBlock(p.canonical_en),
      source_locale: typeof p.source_locale === "string" ? p.source_locale.trim() : "en",
      locales: normalizeLocales(p.locales),
      pulse,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the block to display for UI locale. Falls back to canonical English.
 */
export function getDisplayBlock(
  content: TruthNodeContentV2 | Record<string, unknown> | null | undefined,
  uiLocale: string
): RosettaBlock & { isFallback: boolean } {
  const code = (uiLocale || "en").trim().toLowerCase();
  if (!content || typeof content !== "object") {
    return { assertion: "Content unavailable", isFallback: true };
  }
  const c = content as Record<string, unknown>;
  const locales = c.locales as Record<string, unknown> | undefined;
  if (locales && typeof locales === "object" && !Array.isArray(locales)) {
    const block = locales[code] ?? locales[uiLocale.trim()];
    if (block && typeof block === "object") {
      const b = normalizeBlock(block);
      if (b.assertion.trim()) {
        return { ...b, isFallback: false };
      }
    }
  }
  if (c.canonical_en && typeof c.canonical_en === "object") {
    const b = normalizeBlock(c.canonical_en);
    if (b.assertion.trim()) {
      return { ...b, isFallback: code !== "en" };
    }
  }
  return { assertion: "Content unavailable", isFallback: true };
}

/** Embedding text: universal English core only. */
export function embeddingTextFromCanonical(block: RosettaBlock): string {
  const a = block.assertion.trim();
  const r = (block.reasoning ?? "").trim();
  return r ? `${a}\n${r}` : a;
}

export function truthNodeContentV2ToJson(
  body: TruthNodeContentV2 & { pulse?: number }
): string {
  return JSON.stringify({
    schemaVersion: 2,
    canonical_en: body.canonical_en,
    source_locale: body.source_locale,
    locales: body.locales,
    ...(typeof body.pulse === "number" ? { pulse: body.pulse } : {}),
  });
}

/** Stored competing theory row (metadata.competingTheories[]). */
export function competingTheoryDisplayAssertion(
  theory: { canonical_en: RosettaBlock; locales: Record<string, RosettaBlock> },
  uiLocale: string
): string {
  return getDisplayBlock(
    {
      canonical_en: theory.canonical_en,
      source_locale: "en",
      locales: theory.locales,
    },
    uiLocale
  ).assertion;
}
