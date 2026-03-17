/**
 * Semantic Peeler — unwraps backend-formatted node content into clean UI fields.
 * Supports: (1) Rosetta JSON (canonical `en` + optional `locales`, or legacy `en`+`he`),
 * (2) legacy Content/Logician's Pulse/Rationale/Scout format, (3) plain text.
 */

import {
  getRosettaBlockForUiLocale,
  normalizeTruthRosetta,
} from "@/lib/utils/truthRosetta";

export interface ParsedNodeContent {
  /** The core claim or thesis text. */
  assertion: string;
  /** Logician's coherence score 0–100, or null if not present. */
  pulse: number | null;
  /** Logician's rationale, or null. */
  rationale: string | null;
  /** Scout's assumptions + falsification block, or null. */
  scoutWarning: string | null;
}

const CONTENT_PREFIX = "Content: ";
const LOGICIAN_TAG = "[Logician's Pulse:";
const RATIONALE_PREFIX = "Rationale: ";
const SCOUT_START = "[The Scout's";

/**
 * Parses raw node content (from truth_nodes.content) into structured fields.
 * Rosetta: always canonical English internally; UI locale picks merged block (fallback: English).
 */
export function parseNodeContent(
  rawText: string,
  locale?: "he" | "en" | string
): ParsedNodeContent {
  const raw = typeof rawText === "string" ? rawText.trim() : "";
  if (!raw) {
    return { assertion: "", pulse: null, rationale: null, scoutWarning: null };
  }

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const norm = normalizeTruthRosetta(parsed);
      if (norm) {
        const ui = (locale ?? "en").toLowerCase();
        const block = getRosettaBlockForUiLocale(norm, ui);
        const assumptions = block.hiddenAssumptions?.length
          ? block.hiddenAssumptions.join("\n• ")
          : "";
        const scoutWarning =
          (assumptions ? `Hidden assumptions:\n• ${assumptions}\n\n` : "") +
          (block.challengePrompt ? `Falsification prompt: ${block.challengePrompt}` : "");
        return {
          assertion: block.assertion.trim(),
          pulse: norm.pulse,
          rationale: block.reasoning?.trim() || null,
          scoutWarning: scoutWarning.trim() || null,
        };
      }
    } catch {
      // Fall through to legacy/plain
    }
  }

  const hasFormat = raw.includes(LOGICIAN_TAG);

  if (!hasFormat) {
    return {
      assertion: raw,
      pulse: null,
      rationale: null,
      scoutWarning: null,
    };
  }

  let assertion = raw;
  if (raw.startsWith(CONTENT_PREFIX)) {
    const afterContent = raw.slice(CONTENT_PREFIX.length);
    const pulseIdx = afterContent.indexOf("\n\n" + LOGICIAN_TAG);
    assertion = (pulseIdx >= 0 ? afterContent.slice(0, pulseIdx) : afterContent).trim();
  } else {
    const pulseIdx = raw.indexOf(LOGICIAN_TAG);
    if (pulseIdx >= 0) assertion = raw.slice(0, pulseIdx).trim();
  }

  const pulseMatch = raw.match(/\[Logician's Pulse:\s*(\d{1,3})\/100\]/i);
  const pulse = pulseMatch ? Math.min(100, Math.max(0, parseInt(pulseMatch[1], 10))) : null;

  let rationale: string | null = null;
  const rationalePrefixIdx = raw.indexOf(RATIONALE_PREFIX);
  const scoutIdx = raw.indexOf(SCOUT_START);
  if (rationalePrefixIdx >= 0 && scoutIdx > rationalePrefixIdx) {
    const start = rationalePrefixIdx + RATIONALE_PREFIX.length;
    rationale = raw.slice(start, scoutIdx).trim();
    if (!rationale) rationale = null;
  }

  let scoutWarning: string | null = null;
  if (scoutIdx >= 0) {
    scoutWarning = raw.slice(scoutIdx).trim();
    if (!scoutWarning) scoutWarning = null;
  }

  return {
    assertion: assertion || raw,
    pulse,
    rationale,
    scoutWarning,
  };
}

/** Truncates text to max length with ellipsis. */
export function truncateAssertion(text: string, maxLen: number = 180): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + "…";
}

/**
 * Returns the display assertion (or full content summary) for a node's content.
 */
export function getDisplayAssertion(rawContent: string, locale: "he" | "en" | string = "en"): string {
  const parsed = parseNodeContent(rawContent, locale);
  return parsed.assertion || rawContent.slice(0, 200) + (rawContent.length > 200 ? "…" : "");
}
