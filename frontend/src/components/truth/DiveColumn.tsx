"use client";

import { useCallback, useEffect, useState, useRef, useTransition } from "react";
import { Swords, Fingerprint, Activity, Lock, Check, History, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAccount } from "wagmi";
import { getTruthNodeWithEdges, toggleNodeResonance, checkUserResonance, type EndlessDiveInitialData, type TruthNodeRow, type TruthEdgeWithNodes } from "@/app/actions/truthWeaver";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent } from "@/lib/utils/truthParser";
import { getArenaAvatar } from "@/lib/utils/avatar";
import { competingTheoryDisplayAssertion, getDisplayBlock, parseTruthNodeContentJson } from "@/lib/utils/truthRosetta";
import { EpistemicStateBadge } from "@/components/truth/EpistemicStateBadge";
import { getMoveBadge } from "@/components/truth/EpistemicMoveBadge";
import type { CompetingTheoryV2 } from "@/types/truth";
import { SubmitClaimsDrawer } from "./SubmitClaimsDrawer";
import { TacticalMoveDrawer } from "@/components/truth/TacticalMoveDrawer";
import { SharpenClaimDrawer } from "@/components/truth/SharpenClaimDrawer";
import { CodexSheet } from "@/components/ui/CodexSheet";
import { Button } from "@/components/ui/button";
import { useGenesisAnchor } from "@/hooks/useGenesisAnchor";

const RESONATE_CLAIM = { he: "הדהד טענה זו", en: "Resonate" };
const RESONATED_CLAIM = { he: "הדהדת · לחץ להסרה", en: "Resonated · Click to remove" };
const RATIONALE_LABEL = { he: "נימוק הלוגיקן", en: "Rationale" };
const RATIONALE_LOGICAL = { he: "נימוק לוגי (Rationale)", en: "Logical Rationale" };
const READ_RATIONALE = { he: "קרא נימוק", en: "Read Rationale" };
const SCOUT_LABEL = { he: "הנחות מובלעות וזיהוי הפרכה", en: "Hidden assumptions & falsification" };
const SHOWN_IN_EN = { he: "מוצג באנגלית", en: "Shown in English" };
const RESONANCE_COUNT = { he: "הדהודים קהילתיים", en: "Community Resonances" };
const RESONATED_SUCCESS = { he: "הודהד בהצלחה", en: "Resonated" };
const SBT_REQUIRED = { he: "נדרש חותם מאנה (SBT)", en: "Genesis Anchor SBT required" };
const SHARPENING_HISTORY = { he: "היסטוריית ליטושים", en: "Sharpening history" };
const NEWER_SHARPENED_EXISTS = {
  he: "קיימת גרסה מעודכנת יותר לטענה זו.",
  en: "A newer sharpened version exists.",
};
const VERSION_CAROUSEL_PREV = { he: "גרסה קודמת", en: "Older version" };
const VERSION_CAROUSEL_NEXT = { he: "גרסה מאוחרת יותר", en: "Newer version" };

interface CompetingTheoriesMeta {
  competingTheories?: CompetingTheoryV2[];
}

interface DiveColumnProps {
  nodeId: string;
  columnIndex: number;
  onDive: (nodeId: string, colIndex: number, label: string) => void;
  /** Replace this column’s node (same Miller slot); truncates the stack after this index. */
  onReplaceColumn: (nodeId: string, colIndex: number, label: string) => void;
  isFirst?: boolean;
  initialData?: EndlessDiveInitialData;
  /** Root arena ID for Arena-Scoped Identity (stack[0]); same wallet gets same avatar per arena. */
  arenaId?: string;
  /** ID of the child that opened the next column — highlighted in this column. */
  activeChildId?: string;
  /** Report this column's label when loaded (for global breadcrumb bar). */
  onRegisterLabel?: (id: string, label: string) => void;
}

/** Normalize thematic_tags from DB (array, string, or JSONB). */
function getThematicTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string") return [raw];
  return [];
}

export function DiveColumn({
  nodeId,
  columnIndex,
  onDive,
  onReplaceColumn,
  isFirst,
  initialData,
  arenaId,
  activeChildId,
  onRegisterLabel,
}: DiveColumnProps) {
  const { locale } = useLocale();
  const { address } = useAccount();
  const { hasGenesisAnchor, walletAddress } = useGenesisAnchor();
  const [isPending, startTransition] = useTransition();
  const [hasResonated, setHasResonated] = useState(false);
  const [sbtCodexOpen, setSbtCodexOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"resonance" | "recent">("recent");
  const [arenaDetailsOpen, setArenaDetailsOpen] = useState(false);
  const authorWallet = address ?? walletAddress ?? "";

  const actualNodeId = nodeId.includes("::") ? nodeId.split("::")[0] ?? nodeId : nodeId;

  const [data, setData] = useState<EndlessDiveInitialData | null>(
    initialData && !nodeId.includes("::") ? initialData : null
  );
  const [loading, setLoading] = useState(!initialData || !!nodeId.includes("::"));
  /** Mobile: show only one theory column. Desktop (md+): show both. Default THEORY_A so mobile isn't stacked. */
  const [activeTheoryFilter, setActiveTheoryFilter] = useState<"THEORY_A" | "THEORY_B">("THEORY_A");
  const onRegisterLabelRef = useRef(onRegisterLabel);
  const lastReportedRef = useRef<{ id: string; label: string } | null>(null);
  onRegisterLabelRef.current = onRegisterLabel;

  const refreshCurrentColumn = useCallback(() => {
    setLoading(true);
    getTruthNodeWithEdges(actualNodeId).then((res) => {
      if (res.success) {
        setData({
          node: res.node,
          edges: res.edges,
          lineage: res.lineage,
          hasNewerVersion: res.hasNewerVersion,
        });
      }
      setLoading(false);
    });
  }, [actualNodeId]);

  useEffect(() => {
    if (initialData && !nodeId.includes("::")) return;
    refreshCurrentColumn();
  }, [actualNodeId, initialData, nodeId, refreshCurrentColumn]);

  // Initial resonance state for standard claims (non-arena)
  useEffect(() => {
    if (!data?.node?.id || !walletAddress) return;
    const tags = getThematicTags(data.node.thematic_tags);
    if (tags.includes("macro-arena")) return;
    checkUserResonance(data.node.id, walletAddress).then(setHasResonated);
  }, [data?.node?.id, walletAddress]);

  // Report this column's label once when loaded (breadcrumb)
  useEffect(() => {
    if (!data?.node) return;
    const lang = locale === "he" ? "he" : "en";
    const label = parseNodeContent(data.node.content, lang).assertion || "";
    if (!label) return;
    if (lastReportedRef.current?.id === nodeId && lastReportedRef.current?.label === label) return;
    lastReportedRef.current = { id: nodeId, label };
    onRegisterLabelRef.current?.(nodeId, label);
  }, [nodeId, data, locale]);

  const handleResonate = useCallback(() => {
    if (!walletAddress || !data?.node) return;
    const nodeIdForResonance = data.node.id;
    startTransition(async () => {
      const wasResonated = hasResonated;
      setHasResonated(!wasResonated);
      setData((prev) => {
        if (!prev?.node) return prev;
        return {
          ...prev,
          node: {
            ...prev.node,
            resonance_count: Math.max(0, (prev.node.resonance_count ?? 0) + (wasResonated ? -1 : 1)),
          },
        };
      });
      const res = await toggleNodeResonance(nodeIdForResonance, walletAddress);
      if (!res.success) {
        setHasResonated(wasResonated);
        setData((prev) => {
          if (!prev?.node) return prev;
          return {
            ...prev,
            node: {
              ...prev.node,
              resonance_count: Math.max(0, (prev.node.resonance_count ?? 0) + (wasResonated ? 1 : -1)),
            },
          };
        });
      } else if ("resonating" in res) {
        setHasResonated(res.resonating);
      }
    });
  }, [data?.node, hasResonated, walletAddress]);

  if (loading) {
    return (
      <div
        className="w-[90vw] md:w-[450px] shrink-0 bg-card rounded-3xl border border-border/50 animate-pulse p-6 min-h-[320px] snap-center"
        aria-busy
      />
    );
  }

  if (!data?.node) return null;

  const lang = locale === "he" ? "he" : "en";
  const parsed = parseNodeContent(data.node.content, lang);
  const assertionText = parsed.assertion || "";
  const nodeEpistemicState = data.node.epistemic_state ?? "SOLID";

  const tags = getThematicTags(data.node.thematic_tags);
  const isMacroArena = tags.includes("macro-arena");
  const metadata = data.node.metadata as CompetingTheoriesMeta | undefined | null;
  const competingTheories = metadata?.competingTheories ?? [];
  const hasArenaTheories = competingTheories.length >= 2;
  const theoryALabel = competingTheories[0]
    ? competingTheoryDisplayAssertion(competingTheories[0], lang)
    : locale === "he"
      ? "תיאוריה א'"
      : "Theory A";
  const theoryBLabel = competingTheories[1]
    ? competingTheoryDisplayAssertion(competingTheories[1], lang)
    : locale === "he"
      ? "תיאוריה ב'"
      : "Theory B";

  // Children = edges where this node is the source; use actualNodeId for fetch consistency
  const childEdges = data.edges.filter((e) => e.source_id === actualNodeId && e.target_node);
  const supportingEdges = childEdges.filter((e) => e.relationship === "supports");
  const challengingEdges = childEdges.filter((e) => e.relationship === "challenges");

  function sortEdges(edgesToSort: TruthEdgeWithNodes[], parentId: string): TruthEdgeWithNodes[] {
    return [...edgesToSort].sort((a, b) => {
      const childA = a.source_id === parentId ? a.target_node : a.source_node;
      const childB = b.source_id === parentId ? b.target_node : b.source_node;
      if (sortMode === "resonance") {
        const rA = childA?.resonance_count ?? 0;
        const rB = childB?.resonance_count ?? 0;
        return rB - rA;
      }
      const dateA = new Date(childA?.created_at ?? 0).getTime();
      const dateB = new Date(childB?.created_at ?? 0).getTime();
      return dateB - dateA;
    });
  }

  const sortedSupportingEdges = sortEdges(supportingEdges, actualNodeId);
  const sortedChallengingEdges = sortEdges(challengingEdges, actualNodeId);

  // War Room: Theory A = supports, Theory B = challenges (flattened Crossfire view)
  const theoryAEdges = sortedSupportingEdges;
  const theoryBEdges = sortedChallengingEdges;

  const arenaV2 = parseTruthNodeContentJson(data.node.content);
  const arenaDisplayBlock = arenaV2
    ? getDisplayBlock(arenaV2, lang)
    : { assertion: assertionText, reasoning: parsed.rationale ?? "", hiddenAssumptions: [], isFallback: false };
  const arenaHiddenAssumptions = arenaDisplayBlock.hiddenAssumptions ?? [];
  const hasArenaDetails = Boolean(
    (arenaDisplayBlock.reasoning && arenaDisplayBlock.reasoning.trim().length > 0) ||
      arenaHiddenAssumptions.length > 0
  );

  // War Room gets a wide panorama on desktop; standard columns stay narrow. Mobile always 90vw.
  const isWarRoomView = isMacroArena && hasArenaTheories;
  const columnWidthClass = isWarRoomView
    ? "w-[90vw] md:w-[800px] xl:w-[1000px]"
    : "w-[90vw] md:w-[450px]";

  return (
    <div className={`${columnWidthClass} max-h-full shrink-0 bg-card rounded-3xl border border-border/50 shadow-soft-md min-h-[320px] flex flex-col snap-center relative overflow-hidden transition-all duration-300`}>
      {/* THE CROSSFIRE WAR ROOM: Arena root — flattened two columns, no claim dive. */}
      {isMacroArena && hasArenaTheories && (
        <>
          <div className="p-6 border-b border-border/50 bg-secondary/5 shrink-0">
            <h2 className="font-bold text-foreground text-xl leading-relaxed text-center">
              {arenaDisplayBlock.assertion || assertionText}
            </h2>
            {hasArenaDetails && (
              <div className="mt-3 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setArenaDetailsOpen((v) => !v)}
                  className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {arenaDetailsOpen
                    ? locale === "he"
                      ? "− הסתר פרטים"
                      : "− Hide details"
                    : locale === "he"
                      ? "+ פרטים והקשר לוגי"
                      : "+ Details & context"}
                </button>
                {arenaDetailsOpen && (
                  <div className="mt-3 bg-background border border-border/50 rounded-xl p-4 text-start shadow-sm w-full text-sm text-foreground leading-relaxed">
                    {arenaDisplayBlock.reasoning?.trim() && <p>{arenaDisplayBlock.reasoning}</p>}
                    {arenaHiddenAssumptions.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mt-3">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block mb-1">
                          {locale === "he" ? "הנחות מובלעות:" : "Hidden assumptions:"}
                        </span>
                        <ul className="list-disc list-inside text-xs text-amber-900/80 dark:text-amber-100/80">
                          {arenaHiddenAssumptions.map((a, i) => (
                            <li key={`${i}-${a.slice(0, 16)}`}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background p-1">
                <button
                  type="button"
                  onClick={() => setSortMode("recent")}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    sortMode === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {locale === "he" ? "חדשים" : "Newest"}
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("resonance")}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    sortMode === "resonance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {locale === "he" ? "הדהוד" : "Resonance"}
                </button>
              </div>
            </div>
            {isFirst && (
              <div className="mt-6">
                <SubmitClaimsDrawer
                  arenaId={data.node.id}
                  theoryAEn={competingTheoryDisplayAssertion(competingTheories[0], "en")}
                  theoryAHe={competingTheoryDisplayAssertion(competingTheories[0], "he")}
                  theoryBEn={competingTheoryDisplayAssertion(competingTheories[1], "en")}
                  theoryBHe={competingTheoryDisplayAssertion(competingTheories[1], "he")}
                  hasGenesisAnchor={hasGenesisAnchor}
                  onLockedClick={() => setSbtCodexOpen(true)}
                />
              </div>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar pb-24 min-h-0">
            {/* Mobile: filter toggle (Theory A / Theory B). Hidden on md+. */}
            {/* Mobile: tab toggle (only one theory visible). Desktop (md+): hidden, both columns visible. */}
            <div className="md:hidden flex bg-secondary/20 p-1 rounded-xl mb-4 border border-border/50">
              <button
                type="button"
                onClick={() => setActiveTheoryFilter("THEORY_A")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTheoryFilter === "THEORY_A" ? "bg-background shadow-sm text-sky-600 dark:text-sky-400" : "text-muted-foreground"}`}
              >
                {locale === "he" ? "תיאוריה א'" : "Theory A"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTheoryFilter("THEORY_B")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTheoryFilter === "THEORY_B" ? "bg-background shadow-sm text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
              >
                {locale === "he" ? "תיאוריה ב'" : "Theory B"}
              </button>
            </div>

            {/* Desktop: 2 columns side-by-side. Mobile: 1 column — pure CSS hides inactive tab. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start">
              {/* THEORY A COLUMN: on mobile hidden when THEORY_B selected; on md+ always visible */}
              <div
                className={`flex flex-col gap-4 border-t-4 border-sky-500/50 pt-4 rounded-xl bg-sky-500/5 p-2 md:p-4 ${activeTheoryFilter === "THEORY_B" ? "hidden md:flex" : "flex"}`}
              >
                <h3 className="text-sm font-black text-sky-700 dark:text-sky-400 text-center mb-2">
                  {theoryALabel}{" "}
                  <span className="text-[11px] font-semibold text-muted-foreground">({theoryAEdges.length})</span>
                </h3>
                {theoryAEdges.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    {locale === "he" ? "טרם נטענו טענות לתיאוריה א'." : "No claims for Theory A yet."}
                  </p>
                ) : (
                  theoryAEdges.map((edge) => {
                    const child = edge.target_node;
                    if (!child) return null;
                    const childAssertion = parseNodeContent(child.content, lang).assertion || "";
                    const isActive = child.id === activeChildId;
                    return (
                      <div
                        key={edge.id}
                        className={`w-full rounded-xl border transition-all group relative overflow-hidden flex flex-col shadow-sm ${
                          isActive
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 bg-card hover:border-primary/40 hover:shadow-soft"
                        }`}
                      >
                        <div className={`absolute top-0 start-0 w-1 h-full transition-colors ${isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/30"}`} aria-hidden />
                        <button
                          type="button"
                          onClick={() => onDive(child.id, columnIndex, childAssertion.slice(0, 200) + (childAssertion.length > 200 ? "…" : ""))}
                          className="text-start p-4 pb-2 flex flex-col gap-2 w-full bg-transparent border-none cursor-pointer font-inherit"
                          aria-label={locale === "he" ? "צלול לטענה" : "Dive to claim"}
                        >
                          <p className={`text-sm font-medium transition-colors ps-2 ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                            {childAssertion}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center justify-between border-t border-border/30 pt-3 gap-2 w-full px-4 pb-4 ps-6">
                          <div className="flex items-center gap-2">
                            <EpistemicStateBadge state={child.epistemic_state ?? "SOLID"} locale={locale} />
                            {getMoveBadge(child.epistemic_move ?? null, lang)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <SharpenClaimDrawer
                              targetNodeId={child.id}
                              targetAssertion={childAssertion}
                              authorWallet={authorWallet}
                              hasGenesisAnchor={hasGenesisAnchor}
                              onLockedClick={() => setSbtCodexOpen(true)}
                            />
                            <TacticalMoveDrawer
                              targetNodeId={child.id}
                              targetAssertion={childAssertion}
                              arenaId={arenaId ?? actualNodeId}
                              tacticalSupportedTheoryHint="THEORY_B"
                              authorWallet={authorWallet}
                              hasGenesisAnchor={hasGenesisAnchor}
                              onLockedClick={() => setSbtCodexOpen(true)}
                              onAnchored={refreshCurrentColumn}
                            />
                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                              {locale === "he" ? READ_RATIONALE.he + " ←" : READ_RATIONALE.en + " →"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* THEORY B COLUMN: on mobile hidden when THEORY_A selected; on md+ always visible */}
              <div
                className={`flex flex-col gap-4 border-t-4 border-amber-500/50 pt-4 rounded-xl bg-amber-500/5 p-2 md:p-4 ${activeTheoryFilter === "THEORY_A" ? "hidden md:flex" : "flex"}`}
              >
                <h3 className="text-sm font-black text-amber-700 dark:text-amber-400 text-center mb-2">
                  {theoryBLabel}{" "}
                  <span className="text-[11px] font-semibold text-muted-foreground">({theoryBEdges.length})</span>
                </h3>
                {theoryBEdges.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    {locale === "he" ? "טרם נטענו טענות לתיאוריה ב'." : "No claims for Theory B yet."}
                  </p>
                ) : (
                  theoryBEdges.map((edge) => {
                    const child = edge.target_node;
                    if (!child) return null;
                    const childAssertion = parseNodeContent(child.content, lang).assertion || "";
                    const isActive = child.id === activeChildId;
                    return (
                      <div
                        key={edge.id}
                        className={`w-full rounded-xl border transition-all group relative overflow-hidden flex flex-col shadow-sm ${
                          isActive
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 bg-card hover:border-primary/40 hover:shadow-soft"
                        }`}
                      >
                        <div className={`absolute top-0 start-0 w-1 h-full transition-colors ${isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/30"}`} aria-hidden />
                        <button
                          type="button"
                          onClick={() => onDive(child.id, columnIndex, childAssertion.slice(0, 200) + (childAssertion.length > 200 ? "…" : ""))}
                          className="text-start p-4 pb-2 flex flex-col gap-2 w-full bg-transparent border-none cursor-pointer font-inherit"
                          aria-label={locale === "he" ? "צלול לטענה" : "Dive to claim"}
                        >
                          <p className={`text-sm font-medium transition-colors ps-2 ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                            {childAssertion}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center justify-between border-t border-border/30 pt-3 gap-2 w-full px-4 pb-4 ps-6">
                          <div className="flex items-center gap-2">
                            <EpistemicStateBadge state={child.epistemic_state ?? "SOLID"} locale={locale} />
                            {getMoveBadge(child.epistemic_move ?? null, lang)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <SharpenClaimDrawer
                              targetNodeId={child.id}
                              targetAssertion={childAssertion}
                              authorWallet={authorWallet}
                              hasGenesisAnchor={hasGenesisAnchor}
                              onLockedClick={() => setSbtCodexOpen(true)}
                            />
                            <TacticalMoveDrawer
                              targetNodeId={child.id}
                              targetAssertion={childAssertion}
                              arenaId={arenaId ?? actualNodeId}
                              tacticalSupportedTheoryHint="THEORY_A"
                              authorWallet={authorWallet}
                              hasGenesisAnchor={hasGenesisAnchor}
                              onLockedClick={() => setSbtCodexOpen(true)}
                              onAnchored={refreshCurrentColumn}
                            />
                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                              {locale === "he" ? READ_RATIONALE.he + " ←" : READ_RATIONALE.en + " →"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* STANDARD CLAIM VIEW: dive target — assertion, rationale box, resonate. */}
      {!isMacroArena && (() => {
        const v2 = parseTruthNodeContentJson(data.node.content);
        const displayBlock = v2 ? getDisplayBlock(v2, lang) : { assertion: parsed.assertion, reasoning: parsed.rationale ?? "", isFallback: false };
        const rationaleText = displayBlock.reasoning?.trim() ?? parsed.rationale ?? "";
        const lineage = data.lineage?.length ? data.lineage : [data.node];
        const isOutdated = data.hasNewerVersion;
        const versionIndex = Math.max(0, lineage.findIndex((v) => v.id === data.node.id));
        const totalVersions = lineage.length;
        const attackingTargetEdges = data.edges.filter((e) => {
          if (e.target_id !== data.node.id || e.relationship !== "challenges" || !e.source_node) {
            return false;
          }
          // Exclude arena/theory-level placement edges (macro root), keep only claim-to-claim attacks.
          return !getThematicTags(e.source_node.thematic_tags).includes("macro-arena");
        });
        const goVersion = (row: TruthNodeRow) => {
          const assertionFromRow = parseNodeContent(row.content, lang).assertion || "";
          const label =
            assertionFromRow.slice(0, 200) + (assertionFromRow.length > 200 ? "…" : "");
          onReplaceColumn(row.id, columnIndex, label);
        };

        return (
          <div className="p-6 h-full flex flex-col overflow-y-auto custom-scrollbar pb-24 min-h-0">
            {(totalVersions > 1 || isOutdated) && (
              <div className="mb-4 flex flex-col gap-2">
                {isOutdated && (
                  <div
                    className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"
                    role="status"
                  >
                    <AlertTriangle className="size-3 shrink-0" aria-hidden />
                    {locale === "he" ? NEWER_SHARPENED_EXISTS.he : NEWER_SHARPENED_EXISTS.en}
                  </div>
                )}
                {totalVersions > 1 && (
                  <div
                    className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground bg-secondary/20 w-fit max-w-full px-3 py-1.5 rounded-full border border-border/50"
                    dir="ltr"
                  >
                    <History className="size-3 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">
                      {locale === "he" ? SHARPENING_HISTORY.he : SHARPENING_HISTORY.en}:
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => versionIndex > 0 && goVersion(lineage[versionIndex - 1])}
                        disabled={versionIndex <= 0}
                        className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={locale === "he" ? VERSION_CAROUSEL_PREV.he : VERSION_CAROUSEL_PREV.en}
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </button>
                      <div className="flex flex-wrap items-center gap-1 px-0.5">
                        {lineage.map((v, i) => {
                          const isActive = v.id === data.node.id;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() => goVersion(v)}
                              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                                isActive
                                  ? "bg-primary text-primary-foreground font-bold"
                                  : "hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              v1.{i}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          versionIndex < totalVersions - 1 && goVersion(lineage[versionIndex + 1])
                        }
                        disabled={versionIndex >= totalVersions - 1}
                        className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={locale === "he" ? VERSION_CAROUSEL_NEXT.he : VERSION_CAROUSEL_NEXT.en}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <EpistemicStateBadge state={nodeEpistemicState} locale={locale} />
              {getMoveBadge(data.node.epistemic_move ?? null, lang)}
              {"isFallback" in displayBlock && displayBlock.isFallback && (
                <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                  {locale === "he" ? SHOWN_IN_EN.he : SHOWN_IN_EN.en}
                </span>
              )}
              {(data.node.resonance_count ?? 0) > 0 && (
                <span
                  className="flex items-center gap-1 text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full shrink-0 text-xs font-medium"
                  title={locale === "he" ? "הדהוד קהילתי" : "Community resonance"}
                >
                  <Fingerprint className="size-3" aria-hidden />
                  {data.node.resonance_count}
                </span>
              )}
            </div>
            {attackingTargetEdges.length > 0 && (
              <div className="mt-1 mb-4 flex flex-col gap-2">
                {attackingTargetEdges.map((edge) => {
                  const targetNode = edge.source_node;
                  if (!targetNode) return null;
                  const targetV2 = parseTruthNodeContentJson(targetNode.content);
                  const targetAssertion = targetV2
                    ? getDisplayBlock(targetV2, lang).assertion
                    : parseNodeContent(targetNode.content, lang).assertion || "";
                  const targetLabel =
                    targetAssertion.slice(0, 200) + (targetAssertion.length > 200 ? "…" : "");
                  return (
                    <button
                      type="button"
                      key={edge.id}
                      onClick={() => onReplaceColumn(targetNode.id, columnIndex, targetLabel)}
                      className="w-full text-start flex items-start justify-between gap-3 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg shadow-sm hover:bg-rose-500/15 transition-colors"
                      aria-label={locale === "he" ? "מעבר לטענת היעד המותקפת" : "Open attacked target claim"}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-xl leading-none">🎯</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                            {locale === "he" ? "תוקף את הטענה:" : "Attacks claim:"}
                          </span>
                          <p className="text-xs font-medium text-foreground line-clamp-2 mt-0.5">
                            {targetAssertion}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 shrink-0 self-center">
                        {locale === "he" ? "מעבר" : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <h2 className="font-bold text-foreground text-xl leading-relaxed mb-6">
              {displayBlock.assertion || assertionText}
            </h2>

            {rationaleText && (
              <div className="rounded-xl bg-secondary/10 border border-border/50 p-5 mb-6 shadow-sm">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {locale === "he" ? RATIONALE_LOGICAL.he : RATIONALE_LOGICAL.en}
                </h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {rationaleText}
                </p>
              </div>
            )}
            {parsed.scoutWarning && (
              <div
                className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/50 px-4 py-3 mb-6"
                role="region"
                aria-label={locale === "he" ? SCOUT_LABEL.he : SCOUT_LABEL.en}
              >
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {locale === "he" ? SCOUT_LABEL.he : SCOUT_LABEL.en}
                </p>
                <p className="text-sm text-amber-900/90 dark:text-amber-100/90 leading-relaxed whitespace-pre-wrap">
                  {parsed.scoutWarning}
                </p>
              </div>
            )}
            {challengingEdges.length > 0 && (
              <div className="flex flex-col gap-2 mb-6">
                <h3 className="text-xs font-bold text-amber-600 flex items-center gap-1">
                  <Swords className="size-3" />
                  {locale === "he" ? "מפריכים" : "Challenges"} ({challengingEdges.length})
                </h3>
                {sortedChallengingEdges.map((edge) => {
                  const child = edge.target_node;
                  if (!child) return null;
                  const childParsed = parseNodeContent(child.content, lang);
                  const avatar = getArenaAvatar(child.author_wallet, arenaId ?? "");
                  const childLabel =
                    (childParsed.assertion || "").slice(0, 200) +
                    ((childParsed.assertion || "").length > 200 ? "…" : "");
                  return (
                    <button
                      type="button"
                      key={edge.id}
                      onClick={() => onDive(child.id, columnIndex, childLabel)}
                      className="w-full text-start p-3 rounded-xl border border-border/50 bg-background shrink-0 flex flex-col gap-2 hover:border-primary/40 hover:shadow-soft transition-all"
                      aria-label={locale === "he" ? "צלול לטענה מערערת" : "Dive to challenging claim"}
                    >
                      <p className="text-xs font-medium ps-1">{childParsed.assertion || ""}</p>
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/30">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <EpistemicStateBadge state={child.epistemic_state ?? "SOLID"} locale={locale} />
                          {getMoveBadge(child.epistemic_move, lang)}
                        </div>
                        <div
                          className="flex items-center justify-center size-6 rounded-full shadow-sm border shrink-0"
                          style={{ background: avatar.background, borderColor: avatar.borderColor }}
                          title={locale === "he" ? "זהות אפימרית בזירה זו" : "Ephemeral Arena Identity"}
                        >
                          <span className="text-[10px] leading-none">{avatar.emoji}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {challengingEdges.length === 0 && !rationaleText && !parsed.scoutWarning && (
              <p className="text-sm text-muted-foreground italic text-center p-8">
                {locale === "he" ? "קצה הענף הלוגי. טרם נטענו הפרכות." : "End of branch. No refutations anchored yet."}
              </p>
            )}

            <div className="mt-auto border-t border-border/50 pt-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Fingerprint className="size-3" aria-hidden />
                  {locale === "he"
                    ? `${data.node.resonance_count ?? 0} ${RESONANCE_COUNT.he}`
                    : `${data.node.resonance_count ?? 0} ${RESONANCE_COUNT.en}`}
                </span>
                <SharpenClaimDrawer
                  targetNodeId={actualNodeId}
                  targetAssertion={displayBlock.assertion || assertionText}
                  authorWallet={authorWallet}
                  hasGenesisAnchor={hasGenesisAnchor}
                  onLockedClick={() => setSbtCodexOpen(true)}
                />
                <TacticalMoveDrawer
                  targetNodeId={actualNodeId}
                  targetAssertion={displayBlock.assertion || assertionText}
                  arenaId={arenaId ?? actualNodeId}
                  authorWallet={authorWallet}
                  hasGenesisAnchor={hasGenesisAnchor}
                  onLockedClick={() => setSbtCodexOpen(true)}
                  onAnchored={refreshCurrentColumn}
                />
              </div>
              {hasGenesisAnchor ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResonate}
                  disabled={isPending}
                  className={`gap-2 rounded-full transition-colors border text-sm font-bold ${
                    hasResonated
                      ? "!bg-emerald-600 !text-white border-emerald-600 hover:!bg-emerald-700 hover:!text-white shadow-sm font-medium"
                      : "text-primary hover:bg-primary/10 border-primary/20"
                  }`}
                  title={locale === "he" ? "הדהד טענה זו" : "Resonate with this claim"}
                >
                  {hasResonated ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <Activity className={`size-4 shrink-0 ${isPending ? "animate-pulse" : ""}`} aria-hidden />
                  )}
                  {locale === "he" ? (hasResonated ? RESONATED_SUCCESS.he : RESONATE_CLAIM.he) : (hasResonated ? RESONATED_SUCCESS.en : RESONATE_CLAIM.en)}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSbtCodexOpen(true)}
                  className="gap-2 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50 cursor-not-allowed opacity-80"
                  aria-label={locale === "he" ? "הדהד (נעול)" : "Resonate (locked)"}
                  title={locale === "he" ? "נדרש חותם מאנה (SBT) להדהוד" : "Genesis Anchor (SBT) required to resonate"}
                >
                  <Lock className="size-4" aria-hidden />
                  {locale === "he" ? RESONATE_CLAIM.he : RESONATE_CLAIM.en}
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      <CodexSheet open={sbtCodexOpen} onOpenChange={setSbtCodexOpen} chapterId="sybil-resistance" />
    </div>
  );
}
