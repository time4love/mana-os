/**
 * Shared types and pure helpers for ForgeChat.
 * Keeps the UI component focused on rendering; logic and shape detection live here.
 */

export const SWARM_TELEMETRY_PREFIX = "[SWARM_TELEMETRY]:";
export const SWARM_TELEMETRY_RAG_HEADER = "[Swarm Telemetry — RAG Injection]";

export interface RagTelemetryPayload {
  source?: "rag";
  rawQuery?: string;
  query?: string;
  expandedQueryDisplay?: string;
  expandedQuery?: string;
  matchThreshold?: number;
  matchCount?: number;
  matchBreakdown?: string;
  errorMessage?: string;
  topMatches?: Array<{ id: string; similarity: number; contentPreview: string }>;
  systemPromptOverride?: boolean;
  splitterRun?: boolean;
  splitterClaims?: string[] | number;
  splitterError?: string;
  scoutMatches?: number;
  drafterProcessed?: number;
  drafterPassed?: number;
  drafterErrors?: string[];
}

/** Triage payload returned by epistemic_triage tool (server schema). */
export interface EpistemicTriagePayload {
  socraticMessage?: string;
  existingNodesToDisplay?: Array<{ id: string; assertionEn?: string; assertionHe?: string }>;
  newDrafts?: Array<Record<string, unknown>>;
}

/** Generic message part shape for tool/triage detection (AI SDK can send various shapes). */
export interface MessagePartLike {
  type?: string;
  text?: string;
  state?: string;
  errorText?: string;
  error?: string;
  output?: unknown;
  input?: unknown;
  args?: unknown;
  toolName?: string;
  toolInvocation?: {
    toolName?: string;
    result?: unknown;
    args?: unknown;
    state?: string;
    errorText?: string;
    error?: string;
  };
}

const EPISTEMIC_TOOL_NAME = "epistemic_triage";

function hasTriageShape(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return "triage" in o || "socraticMessage" in o || "newDrafts" in o;
}

/** Whether the part is an epistemic_triage tool (any SDK variant). */
export function isEpistemicTriagePart(part: MessagePartLike): boolean {
  const type = part.type;
  if (type === "tool-epistemic_triage") return true;
  if (type === "dynamic-tool" && part.toolName === EPISTEMIC_TOOL_NAME) return true;
  if (type === "tool-invocation" && part.toolInvocation?.toolName === EPISTEMIC_TOOL_NAME) return true;
  if (typeof type === "string" && type.startsWith("tool-")) {
    const out = part.output as Record<string, unknown> | undefined;
    const inp = part.input as Record<string, unknown> | undefined;
    return (!!out && hasTriageShape(out)) || (!!inp && ("socraticMessage" in inp || "newDrafts" in inp));
  }
  return false;
}

/** Extract triage payload from a message part (tool-invocation, tool-epistemic_triage, or dynamic-tool). */
export function getTriageFromPart(part: MessagePartLike): EpistemicTriagePayload | null {
  const inv = part.toolInvocation;
  const isInvocation = part.type === "tool-invocation" && inv?.toolName === EPISTEMIC_TOOL_NAME;

  const rawOutput = isInvocation ? inv.result : part.output;
  const rawInput = isInvocation ? inv.args : part.input;

  const out = rawOutput as { triage?: EpistemicTriagePayload; socraticMessage?: string } | undefined;
  const triage =
    out?.triage ??
    (rawOutput && hasTriageShape(rawOutput) ? (rawOutput as EpistemicTriagePayload) : null) ??
    (rawInput as EpistemicTriagePayload | null) ??
    null;

  return triage;
}

/** Get tool part state and error for UI (pending, error, etc.). */
export function getToolPartState(part: MessagePartLike): {
  state: string | undefined;
  isPending: boolean;
  isError: boolean;
  errorText: string | undefined;
} {
  const inv = part.toolInvocation;
  const state = inv?.state ?? part.state;
  const isPending =
    !state ||
    state === "partial-call" ||
    state === "call" ||
    state === "input-streaming" ||
    state === "input-available";
  const isError = state === "output-error" || state === "error";
  const errorText = inv?.errorText ?? inv?.error ?? part.errorText ?? part.error;
  return { state, isPending, isError, errorText: errorText != null ? String(errorText) : undefined };
}

/**
 * Parse [SWARM_TELEMETRY]:{...} JSON from text and strip it for display.
 * Supports both legacy RAG and pipeline Swarm payloads.
 */
export function parseTelemetryFromText(text: string): {
  telemetry: RagTelemetryPayload | null;
  visibleText: string;
} {
  const headerIdx = text.indexOf(SWARM_TELEMETRY_RAG_HEADER);
  const jsonIdx = text.indexOf(SWARM_TELEMETRY_PREFIX);

  let telemetry: RagTelemetryPayload | null = null;

  if (jsonIdx !== -1) {
    const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
    const after = text.slice(payloadStart);
    const endMatch = after.match(/\n\n/);
    const jsonStr = (endMatch ? after.slice(0, endMatch.index) : after).trim();
    try {
      telemetry = JSON.parse(jsonStr) as RagTelemetryPayload;
    } catch {
      // invalid JSON, leave telemetry null
    }
  }

  const visibleText = stripTelemetryBlockFromText(text, headerIdx, jsonIdx);
  return { telemetry, visibleText: visibleText.trim() };
}

function stripTelemetryBlockFromText(
  text: string,
  headerIdx: number,
  jsonIdx: number
): string {
  if (headerIdx !== -1) {
    if (jsonIdx !== -1) {
      const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
      const after = text.slice(payloadStart);
      const endMatch = after.match(/\n\n/);
      const endCut = endMatch
        ? jsonIdx + SWARM_TELEMETRY_PREFIX.length + (endMatch.index ?? 0) + (endMatch[0].length ?? 0)
        : text.length;
      return text.slice(0, headerIdx) + text.slice(endCut);
    }
    const nextDoubleNewline = text.indexOf("\n\n", headerIdx);
    return text.slice(0, headerIdx) + (nextDoubleNewline !== -1 ? text.slice(nextDoubleNewline + 2) : "");
  }
  if (jsonIdx !== -1) {
    const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
    const after = text.slice(payloadStart);
    const endMatch = after.match(/\n\n/);
    const endCut = endMatch
      ? jsonIdx + SWARM_TELEMETRY_PREFIX.length + (endMatch.index ?? 0) + (endMatch[0].length ?? 0)
      : text.length;
    return text.slice(0, jsonIdx) + text.slice(endCut);
  }
  return text;
}

/** Pick localized label from { he, en }. */
export function getLocalized<T extends { he: string; en: string }>(labels: T, locale: "he" | "en"): string {
  return locale === "he" ? labels.he : labels.en;
}

/** Normalized draft shape for UI (matches ForgeDraft + matchedExistingNodeId). */
export interface NormalizedForgeDraft {
  assertionEn: string;
  assertionHe: string;
  logicalCoherenceScore: number;
  reasoningEn: string;
  reasoningHe: string;
  hiddenAssumptionsEn: string[];
  hiddenAssumptionsHe: string[];
  challengePromptEn: string;
  challengePromptHe: string;
  relationshipToContext: "supports" | "challenges";
  thematicTags: string[];
  matchedExistingNodeId: string | null;
}

function normalizeRawDraft(c: Record<string, unknown>): NormalizedForgeDraft {
  return {
    assertionEn: (c.assertionEn as string) ?? "",
    assertionHe: (c.assertionHe as string) ?? "",
    logicalCoherenceScore: typeof c.logicalCoherenceScore === "number" ? c.logicalCoherenceScore : 0,
    reasoningEn: (c.reasoningEn as string) ?? "",
    reasoningHe: (c.reasoningHe as string) ?? "",
    hiddenAssumptionsEn: Array.isArray(c.hiddenAssumptionsEn) ? (c.hiddenAssumptionsEn as string[]) : [],
    hiddenAssumptionsHe: Array.isArray(c.hiddenAssumptionsHe) ? (c.hiddenAssumptionsHe as string[]) : [],
    challengePromptEn: (c.challengePromptEn as string) ?? "",
    challengePromptHe: (c.challengePromptHe as string) ?? "",
    relationshipToContext: (c.relationshipToContext as "supports" | "challenges") ?? "supports",
    thematicTags: Array.isArray(c.thematicTags) ? (c.thematicTags as string[]) : [],
    matchedExistingNodeId: typeof c.matchedExistingNodeId === "string" ? c.matchedExistingNodeId : null,
  };
}

/**
 * Extract drafts from the latest epistemic_triage tool result in messages.
 * Walks assistant messages from newest to oldest and returns the first non-empty draft list.
 */
export function extractDraftsFromMessages(
  messages: Array<{ role?: string; parts?: unknown[] }>
): NormalizedForgeDraft[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.parts) continue;
    for (const part of msg.parts) {
      const partLike = part as MessagePartLike;
      if (!isEpistemicTriagePart(partLike)) continue;
      const triage = getTriageFromPart(partLike);
      if (!triage?.newDrafts || !Array.isArray(triage.newDrafts) || triage.newDrafts.length === 0)
        continue;
      const filtered = (triage.newDrafts as Array<Record<string, unknown>>).filter(
        (d) => d && typeof d.assertionEn === "string" && (d.assertionEn as string).trim()
      );
      if (filtered.length === 0) continue;
      return filtered.map(normalizeRawDraft);
    }
  }
  return [];
}
