"use client";

import type { RagTelemetryPayload } from "./forgeChatLib";

interface ForgeTelemetryConsoleProps {
  rawContent: string | null;
  telemetry: RagTelemetryPayload | null;
  isArchitectMode: boolean;
}

const PIPELINE_HEADER = "[Swarm Telemetry — Pipeline Execution]";
const RAG_HEADER = "[Swarm Telemetry — RAG Injection]";

function PipelineTelemetryView({ t }: { t: RagTelemetryPayload }) {
  const splitterCount =
    typeof t.splitterClaims === "number" ? t.splitterClaims : (t.splitterClaims?.length ?? 0);
  return (
    <>
      {t.intent && (
        <p className="text-emerald-300 font-medium mb-1">Intent: {t.intent}</p>
      )}
      {t.targetClaimToDraft && (
        <p className="text-zinc-500 text-xs mb-1" title={t.targetClaimToDraft}>
          Claim to draft: {t.targetClaimToDraft.slice(0, 80)}
          {t.targetClaimToDraft.length > 80 ? "…" : ""}
        </p>
      )}
      <p className="text-zinc-400">1. Scout (RAG): Found {t.scoutMatches ?? 0} matches.</p>
      <p className="text-zinc-400">2. Splitter: Extracted {splitterCount} new raw claims.</p>
      <p className="text-zinc-400">
        3. Drafter Swarm: Processed {t.drafterProcessed ?? 0} claims (scored but uncensored).
      </p>
      {t.expandedQueryDisplay && (
        <p className="text-zinc-500 mt-1">Expanded query: {t.expandedQueryDisplay}</p>
      )}
      {t.splitterError && (
        <p className="text-red-400/90 mt-1" role="alert">
          Splitter error: {t.splitterError}
        </p>
      )}
      {t.drafterErrors && t.drafterErrors.length > 0 && (
        <p className="text-red-400/90 mt-1" role="alert">
          Drafter errors: {t.drafterErrors.join("; ")}
        </p>
      )}
    </>
  );
}

function LegacyRagTelemetryView({ t }: { t: RagTelemetryPayload }) {
  const claimsArray = Array.isArray(t.splitterClaims) ? t.splitterClaims : [];
  return (
    <>
      <p className="text-zinc-400">Raw Query: &apos;{t.rawQuery ?? t.query ?? ""}&apos;</p>
      <p className="text-zinc-400">
        Expanded (AI) Vector Query: &apos;
        {t.expandedQueryDisplay ?? t.expandedQuery ?? "FAILED_TO_EXPAND_USED_RAW"}&apos;
      </p>
      <p className="text-zinc-400">Match Threshold: {(t.matchThreshold ?? 0.5).toFixed(2)}</p>
      <p className="text-zinc-400">
        Vector Search Result: Found {t.matchCount ?? 0} matching Node(s).
      </p>
      {t.matchBreakdown && (
        <pre className="text-zinc-500 text-xs mt-1 mb-1 overflow-x-auto">{t.matchBreakdown}</pre>
      )}
      {t.errorMessage && (
        <p className="text-red-400/90 mt-1" role="alert">
          {t.errorMessage}
        </p>
      )}
      {t.systemPromptOverride && (
        <p className="text-emerald-500/90 mt-1">System prompt override initiated.</p>
      )}
      {t.splitterRun && (
        <>
          <p className="text-emerald-400/90 font-semibold mt-2 mb-1">[Splitter Agent Handoff]</p>
          <p className="text-zinc-400">New Claims Extracted: {claimsArray.length}</p>
          {claimsArray.length > 0 && (
            <ul className="text-zinc-400 list-disc list-inside mt-1 space-y-0.5">
              {claimsArray.map((claim: string, i: number) => (
                <li key={i} className="truncate max-w-full" title={claim}>
                  {claim.slice(0, 80)}
                  {claim.length > 80 ? "…" : ""}
                </li>
              ))}
            </ul>
          )}
          {t.splitterError && (
            <p className="text-red-400/90 mt-1" role="alert">
              Splitter Error: {t.splitterError}
            </p>
          )}
        </>
      )}
    </>
  );
}

export function ForgeTelemetryConsole({
  rawContent,
  telemetry,
  isArchitectMode,
}: ForgeTelemetryConsoleProps) {
  if (!isArchitectMode || (!rawContent && !telemetry)) return null;

  if (rawContent && !telemetry) {
    return (
      <div
        className="self-start max-w-[90%] w-full rounded-lg border border-border bg-black/80 text-emerald-400 px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap"
        role="region"
        aria-label="Swarm Telemetry"
      >
        {rawContent}
      </div>
    );
  }

  if (!telemetry) return null;

  const isPipeline = typeof telemetry.scoutMatches === "number";
  const header = isPipeline ? PIPELINE_HEADER : RAG_HEADER;

  return (
    <div
      className="self-start max-w-[90%] w-full rounded-lg border border-border bg-black/80 text-emerald-400 px-3 py-2.5 font-mono text-xs overflow-x-auto whitespace-pre-wrap"
      role="region"
      aria-label="Swarm Telemetry"
    >
      <p className="text-amber-400/90 font-semibold mb-1.5">{header}</p>
      {isPipeline ? (
        <PipelineTelemetryView t={telemetry} />
      ) : (
        <LegacyRagTelemetryView t={telemetry} />
      )}
    </div>
  );
}
