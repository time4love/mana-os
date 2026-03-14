/**
 * Semantic Peeler — unwraps backend-formatted node content into clean UI fields.
 * Supports: (1) Rosetta bilingual JSON { en, he, pulse }, (2) legacy Content/Logician's Pulse/Rationale/Scout format, (3) plain text.
 */

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

/** Stored Rosetta shape includes optional top-level pulse. */
interface StoredRosettaContent {
  en: { assertion: string; reasoning: string; hiddenAssumptions: string[]; challengePrompt: string };
  he: { assertion: string; reasoning: string; hiddenAssumptions: string[]; challengePrompt: string };
  pulse?: number;
}

const CONTENT_PREFIX = "Content: ";
const LOGICIAN_TAG = "[Logician's Pulse:";
const RATIONALE_PREFIX = "Rationale: ";
const SCOUT_START = "[The Scout's";

/**
 * Parses raw node content (from truth_nodes.content) into structured fields.
 * If locale is provided and content is Rosetta JSON, returns the block for that locale (fallback to en).
 */
export function parseNodeContent(rawText: string, locale?: "he" | "en"): ParsedNodeContent {
  const raw = typeof rawText === "string" ? rawText.trim() : "";
  if (!raw) {
    return { assertion: "", pulse: null, rationale: null, scoutWarning: null };
  }

  // Universal Rosetta: bilingual JSON — pick block by locale with fallback to en
  if (raw.startsWith("{") && raw.includes('"en"') && raw.includes('"he"')) {
    try {
      const parsed = JSON.parse(raw) as StoredRosettaContent;
      if (parsed?.en && parsed?.he) {
        const block = locale === "he" ? parsed.he : parsed.en;
        const assumptions = block.hiddenAssumptions?.length
          ? block.hiddenAssumptions.join("\n• ")
          : "";
        const scoutWarning =
          (assumptions ? `Hidden assumptions:\n• ${assumptions}\n\n` : "") +
          (block.challengePrompt ? `Falsification prompt: ${block.challengePrompt}` : "");
        return {
          assertion: block.assertion ?? "",
          pulse: typeof parsed.pulse === "number" ? Math.min(100, Math.max(0, parsed.pulse)) : null,
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

  // Assertion: after "Content: " and before "\n\n[Logician's Pulse:"
  let assertion = raw;
  if (raw.startsWith(CONTENT_PREFIX)) {
    const afterContent = raw.slice(CONTENT_PREFIX.length);
    const pulseIdx = afterContent.indexOf("\n\n" + LOGICIAN_TAG);
    assertion = (pulseIdx >= 0 ? afterContent.slice(0, pulseIdx) : afterContent).trim();
  } else {
    const pulseIdx = raw.indexOf(LOGICIAN_TAG);
    if (pulseIdx >= 0) assertion = raw.slice(0, pulseIdx).trim();
  }

  // Pulse: \d{1,3}/100 inside [Logician's Pulse: ...]
  const pulseMatch = raw.match(/\[Logician's Pulse:\s*(\d{1,3})\/100\]/i);
  const pulse = pulseMatch ? Math.min(100, Math.max(0, parseInt(pulseMatch[1], 10))) : null;

  // Rationale: between "Rationale: " and "\n\n[The Scout's"
  let rationale: string | null = null;
  const rationalePrefixIdx = raw.indexOf(RATIONALE_PREFIX);
  const scoutIdx = raw.indexOf(SCOUT_START);
  if (rationalePrefixIdx >= 0 && scoutIdx > rationalePrefixIdx) {
    const start = rationalePrefixIdx + RATIONALE_PREFIX.length;
    rationale = raw.slice(start, scoutIdx).trim();
    if (!rationale) rationale = null;
  }

  // Scout block: from "[The Scout's" to end
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
 * Use when showing node content in lists or duplicate match previews; respects Rosetta + locale.
 */
export function getDisplayAssertion(rawContent: string, locale: "he" | "en" = "en"): string {
  const parsed = parseNodeContent(rawContent, locale);
  return parsed.assertion || rawContent.slice(0, 200) + (rawContent.length > 200 ? "…" : "");
}
