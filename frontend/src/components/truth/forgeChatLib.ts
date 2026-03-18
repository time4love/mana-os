/**
 * Shared types and pure helpers for ForgeChat.
 */

import type { DraftEpistemicNodeV2, RosettaBlock } from "@/types/truth";

export const SWARM_TELEMETRY_PREFIX = "[SWARM_TELEMETRY]:";
export const SWARM_TELEMETRY_RAG_HEADER = "[Swarm Telemetry — RAG Injection]";

export interface RagTelemetryPayload {
  source?: "rag";
  intent?: "EXPLORE" | "DRAFT_REQUEST" | "CHAT";
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
  targetClaimToDraft?: string;
}

/** Weave portal: English + Hebrew preview lines (Rosetta V2 display). */
export interface WeavePortalPreview {
  id: string;
  enLine: string;
  heLine: string;
}

export interface EpistemicTriagePayload {
  socraticMessage?: string;
  existingNodesToDisplay?: WeavePortalPreview[];
  newDrafts?: Array<Record<string, unknown>>;
}

export interface MessagePartLike {
  type?: string;
  text?: string;
  state?: string;
  errorText?: string;
  error?: string;
  output?: unknown;
  input?: unknown;
  args?: unknown;
  result?: unknown;
  toolName?: string;
  toolCallId?: string;
  toolInvocation?: {
    toolName?: string;
    result?: unknown;
    args?: unknown;
    input?: unknown;
    output?: unknown;
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

export function isEpistemicTriagePart(part: MessagePartLike): boolean {
  const type = part.type;
  if (type === "tool-epistemic_triage") return true;
  if (type === "dynamic-tool" && part.toolName === EPISTEMIC_TOOL_NAME) return true;
  if (type === "tool-invocation" && part.toolInvocation?.toolName === EPISTEMIC_TOOL_NAME)
    return true;
  if (typeof type === "string" && type.startsWith("tool-")) {
    const out = part.output as Record<string, unknown> | undefined;
    const inp = part.input as Record<string, unknown> | undefined;
    return (!!out && hasTriageShape(out)) || (!!inp && ("socraticMessage" in inp || "newDrafts" in inp));
  }
  return false;
}

export function getTriageFromPart(part: MessagePartLike): EpistemicTriagePayload | null {
  const inv = part.toolInvocation;
  const isInvocation = part.type === "tool-invocation" && inv?.toolName === EPISTEMIC_TOOL_NAME;

  const rawInput = isInvocation ? inv.args ?? inv.input : part.input ?? part.args;
  const rawOutput = isInvocation ? inv.result ?? inv.output : part.output ?? part.result;

  const out = rawOutput as { triage?: EpistemicTriagePayload; socraticMessage?: string } | undefined;
  const triage =
    out?.triage ??
    (rawOutput && hasTriageShape(rawOutput) ? (rawOutput as EpistemicTriagePayload) : null) ??
    (rawInput && hasTriageShape(rawInput) ? (rawInput as EpistemicTriagePayload) : null) ??
    (rawInput as EpistemicTriagePayload | null) ??
    null;

  return triage;
}

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
      /* ignore */
    }
  }

  const visibleText = stripTelemetryBlockFromText(text, headerIdx, jsonIdx);
  return { telemetry, visibleText: visibleText.trim() };
}

function getTelemetryBlockEnd(text: string, jsonIdx: number): number {
  const payloadStart = jsonIdx + SWARM_TELEMETRY_PREFIX.length;
  const after = text.slice(payloadStart);
  const endMatch = after.match(/\n\n/);
  return endMatch
    ? jsonIdx + SWARM_TELEMETRY_PREFIX.length + (endMatch.index ?? 0) + (endMatch[0].length ?? 0)
    : text.length;
}

function stripTelemetryBlockFromText(text: string, headerIdx: number, jsonIdx: number): string {
  if (headerIdx !== -1) {
    if (jsonIdx !== -1) {
      const endCut = getTelemetryBlockEnd(text, jsonIdx);
      return text.slice(0, headerIdx) + text.slice(endCut);
    }
    const nextDoubleNewline = text.indexOf("\n\n", headerIdx);
    return text.slice(0, headerIdx) + (nextDoubleNewline !== -1 ? text.slice(nextDoubleNewline + 2) : "");
  }
  if (jsonIdx !== -1) {
    const endCut = getTelemetryBlockEnd(text, jsonIdx);
    return text.slice(0, jsonIdx) + text.slice(endCut);
  }
  return text;
}

export function getLocalized<T extends { he: string; en: string }>(labels: T, locale: "he" | "en"): string {
  return locale === "he" ? labels.he : labels.en;
}

function asRosettaBlock(raw: unknown): RosettaBlock {
  if (!raw || typeof raw !== "object") return { assertion: "" };
  const o = raw as Record<string, unknown>;
  const ha = o.hiddenAssumptions;
  return {
    assertion: typeof o.assertion === "string" ? o.assertion : "",
    reasoning: typeof o.reasoning === "string" ? o.reasoning : undefined,
    hiddenAssumptions: Array.isArray(ha) ? ha.filter((x): x is string => typeof x === "string") : undefined,
    challengePrompt: typeof o.challengePrompt === "string" ? o.challengePrompt : undefined,
  };
}

function normalizeCompetingDraft(raw: unknown): DraftEpistemicNodeV2["competingTheories"] {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const out: NonNullable<DraftEpistemicNodeV2["competingTheories"]> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return undefined;
    const rec = item as Record<string, unknown>;
    const ce = rec.canonical_en;
    if (!ce || typeof ce !== "object") return undefined;
    out.push({
      canonical_en: asRosettaBlock(ce),
      local_translation: rec.local_translation
        ? asRosettaBlock(rec.local_translation)
        : undefined,
    });
  }
  return out;
}

/** Normalized draft for UI (Rosetta V2). */
export type NormalizedForgeDraft = DraftEpistemicNodeV2 & {
  matchedExistingNodeId: string | null;
  relationshipToContext: "supports" | "challenges";
};

export function normalizeRawDraft(c: Record<string, unknown>): NormalizedForgeDraft {
  const ce = c.canonical_en;
  const canonical_en =
    ce && typeof ce === "object"
      ? asRosettaBlock(ce)
      : { assertion: "", reasoning: "" };

  return {
    canonical_en,
    source_locale: typeof c.source_locale === "string" ? c.source_locale : "en",
    local_translation: c.local_translation ? asRosettaBlock(c.local_translation) : undefined,
    logicalCoherenceScore: typeof c.logicalCoherenceScore === "number" ? c.logicalCoherenceScore : 0,
    supportedTheory: c.supportedTheory as DraftEpistemicNodeV2["supportedTheory"],
    thematicTags: Array.isArray(c.thematicTags) ? (c.thematicTags as string[]) : [],
    matchedExistingNodeId:
      typeof c.matchedExistingNodeId === "string" ? c.matchedExistingNodeId : null,
    relationshipToContext: (c.relationshipToContext as "supports" | "challenges") ?? "supports",
    competingTheories: normalizeCompetingDraft(c.competingTheories),
  };
}

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
      const filtered = (triage.newDrafts as Array<Record<string, unknown>>).filter((d) => {
        const block = d?.canonical_en as Record<string, unknown> | undefined;
        return block && typeof block.assertion === "string" && (block.assertion as string).trim();
      });
      if (filtered.length === 0) continue;
      return filtered.map(normalizeRawDraft);
    }
  }
  return [];
}
