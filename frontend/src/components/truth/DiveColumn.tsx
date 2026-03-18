"use client";

import { useCallback, useEffect, useState, useRef, useTransition } from "react";
import { Shield, Swords, Fingerprint, Activity, Lock, Check } from "lucide-react";
import { useAccount } from "wagmi";
import { getTruthNodeWithEdges, toggleNodeResonance, checkUserResonance, type EndlessDiveInitialData, type TruthNodeRow } from "@/app/actions/truthWeaver";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent } from "@/lib/utils/truthParser";
import { competingTheoryDisplayAssertion } from "@/lib/utils/truthRosetta";
import type { CompetingTheoryV2 } from "@/types/truth";
import { SupportClaimDrawer } from "./SupportClaimDrawer";
import { ChallengeClaimDrawer } from "./ChallengeClaimDrawer";
import { SubmitClaimsDrawer } from "./SubmitClaimsDrawer";
import { CodexSheet } from "@/components/ui/CodexSheet";
import { Button } from "@/components/ui/button";
import { useGenesisAnchor } from "@/hooks/useGenesisAnchor";

const RESONATE_CLAIM = { he: "הדהד טענה זו", en: "Resonate" };
const RESONATED_CLAIM = { he: "הדהדת · לחץ להסרה", en: "Resonated · Click to remove" };
const RATIONALE_LABEL = { he: "נימוק הלוגיקן", en: "Rationale" };
const SCOUT_LABEL = { he: "הנחות מובלעות וזיהוי הפרכה", en: "Hidden assumptions & falsification" };
const SCORE_LABEL = { he: "ציון לוגי", en: "Score" };

interface CompetingTheoriesMeta {
  competingTheories?: CompetingTheoryV2[];
}

interface DiveColumnProps {
  nodeId: string;
  columnIndex: number;
  onDive: (nodeId: string, colIndex: number, label: string) => void;
  isFirst?: boolean;
  initialData?: EndlessDiveInitialData;
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

/** Bubbling: mass = baseScore * (1 + resonance * 0.2). */
function childMass(node: TruthNodeRow, lang: "he" | "en"): number {
  const base = parseNodeContent(node.content, lang).pulse ?? 0;
  const resonance = node.resonance_count ?? 0;
  return Math.round(base * (1 + resonance * 0.2));
}

export function DiveColumn({
  nodeId,
  columnIndex,
  onDive,
  isFirst,
  initialData,
  activeChildId,
  onRegisterLabel,
}: DiveColumnProps) {
  const { locale } = useLocale();
  const { address } = useAccount();
  const { hasGenesisAnchor, walletAddress } = useGenesisAnchor();
  const [isPending, startTransition] = useTransition();
  const [hasResonated, setHasResonated] = useState(false);
  const [sbtCodexOpen, setSbtCodexOpen] = useState(false);
  const authorWallet = address ?? walletAddress ?? "";

  // Synthetic ID: "arenaId::THEORY_A" or "arenaId::THEORY_B" → open a dedicated theory column
  const [actualNodeId, theoryKey] = nodeId.includes("::") ? nodeId.split("::") : [nodeId, ""];
  const isTheoryView = theoryKey === "THEORY_A" || theoryKey === "THEORY_B";

  const [data, setData] = useState<EndlessDiveInitialData | null>(
    initialData && !nodeId.includes("::") ? initialData : null
  );
  const [loading, setLoading] = useState(!initialData || !!nodeId.includes("::"));
  const onRegisterLabelRef = useRef(onRegisterLabel);
  const lastReportedRef = useRef<{ id: string; label: string } | null>(null);
  onRegisterLabelRef.current = onRegisterLabel;

  useEffect(() => {
    if (initialData && !isTheoryView) return;
    setLoading(true);
    getTruthNodeWithEdges(actualNodeId).then((res) => {
      if (res.success) setData({ node: res.node, edges: res.edges });
      setLoading(false);
    });
  }, [actualNodeId, initialData, isTheoryView]);

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
    let label: string;
    if (isTheoryView) {
      const meta = data.node.metadata as CompetingTheoriesMeta | undefined;
      const theories = meta?.competingTheories ?? [];
      const obj = theoryKey === "THEORY_A" ? theories[0] : theories[1];
      label = obj
        ? competingTheoryDisplayAssertion(obj, lang)
        : locale === "he"
          ? `תיאוריה ${theoryKey === "THEORY_A" ? "א'" : "ב'"}`
          : `Theory ${theoryKey === "THEORY_A" ? "A" : "B"}`;
    } else {
      label = parseNodeContent(data.node.content, lang).assertion || "";
    }
    if (!label) return;
    if (lastReportedRef.current?.id === nodeId && lastReportedRef.current?.label === label) return;
    lastReportedRef.current = { id: nodeId, label };
    onRegisterLabelRef.current?.(nodeId, label);
  }, [nodeId, data, locale, isTheoryView, theoryKey]);

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
  const score = parsed.pulse ?? null;
  const assertionText = parsed.assertion || "";

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

  // Sort by strength (pulse/score descending): strongest claim first
  const pulseFor = (node: TruthNodeRow) => parseNodeContent(node.content, lang).pulse ?? -1;
  const sortedSupportingEdges = [...supportingEdges].sort((a, b) => {
    const pa = a.target_node ? pulseFor(a.target_node) : -1;
    const pb = b.target_node ? pulseFor(b.target_node) : -1;
    return pb - pa;
  });
  const sortedChallengingEdges = [...challengingEdges].sort((a, b) => {
    const pa = a.target_node ? pulseFor(a.target_node) : -1;
    const pb = b.target_node ? pulseFor(b.target_node) : -1;
    return pb - pa;
  });

  // Theory column: filter edges by theory and cluster by first thematic tag
  const theoryEdges = theoryKey === "THEORY_A" ? supportingEdges : theoryKey === "THEORY_B" ? challengingEdges : [];
  const clusteredByTag = theoryEdges.reduce<Record<string, typeof theoryEdges>>((acc, edge) => {
    const tags = edge.target_node ? getThematicTags(edge.target_node.thematic_tags) : [];
    const primaryTag = tags.length > 0 ? tags[0] : (locale === "he" ? "כללי" : "General");
    const normalized = primaryTag.charAt(0).toUpperCase() + primaryTag.slice(1).toLowerCase();
    if (!acc[normalized]) acc[normalized] = [];
    acc[normalized].push(edge);
    return acc;
  }, {});
  const sortedClusters = Object.entries(clusteredByTag).sort((a, b) => b[1].length - a[1].length);

  // Bubbling: Arena = supports → Theory A, challenges → Theory B
  let theoryAMass = 0;
  let theoryBMass = 0;
  supportingEdges.forEach((e) => {
    if (e.target_node) theoryAMass += childMass(e.target_node, lang);
  });
  challengingEdges.forEach((e) => {
    if (e.target_node) theoryBMass += childMass(e.target_node, lang);
  });
  const totalArenaMass = theoryAMass + theoryBMass;
  const theoryAPercentage = totalArenaMass === 0 ? 50 : Math.round((theoryAMass / totalArenaMass) * 100);
  const theoryBPercentage = totalArenaMass === 0 ? 50 : Math.round((theoryBMass / totalArenaMass) * 100);

  // Claim: validity = base + supportMass - challengeMass
  const baseScore = parsed.pulse ?? 0;
  let supportMass = 0;
  let challengeMass = 0;
  supportingEdges.forEach((e) => {
    if (e.target_node) supportMass += childMass(e.target_node, lang);
  });
  challengingEdges.forEach((e) => {
    if (e.target_node) challengeMass += childMass(e.target_node, lang);
  });
  const currentValidity = Math.max(0, Math.min(100, baseScore + supportMass - challengeMass));

  return (
    <div className="w-[90vw] md:w-[450px] max-h-full shrink-0 bg-card rounded-3xl border border-border/50 shadow-soft-md min-h-[320px] flex flex-col snap-center relative overflow-hidden transition-all duration-300">
      {/* 1. ARENA ROOT: clean lobby — question, scales, theory doors (open new column), Submit. No list. */}
      {isMacroArena && hasArenaTheories && !isTheoryView && (
        <>
          <div className="p-6 border-b border-border/50 bg-secondary/5 shrink-0">
            <h2 className="font-bold text-foreground text-lg leading-relaxed">{assertionText}</h2>
            <div
              className="relative w-full h-3 rounded-full overflow-hidden bg-secondary/30 flex flex-row mt-6"
              role="img"
              aria-label={locale === "he" ? "מאזני כוח" : "Mass Balance"}
            >
              <div className="h-full bg-sky-500/60 transition-all duration-1000 ease-out" style={{ width: `${theoryAPercentage}%` }} />
              <div className="h-full bg-amber-500/60 transition-all duration-1000 ease-out" style={{ width: `${theoryBPercentage}%` }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-background/80 z-10" aria-hidden />
            </div>
            <div className="flex justify-between text-xs font-bold mt-1 px-1">
              <span className="text-sky-600 dark:text-sky-400">{theoryAPercentage}%</span>
              <span className="text-muted-foreground font-medium">{locale === "he" ? "מאזני כוח" : "Mass Balance"}</span>
              <span className="text-amber-600 dark:text-amber-400">{theoryBPercentage}%</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => onDive(`${actualNodeId}::THEORY_A`, columnIndex, theoryALabel)}
                className={`relative rounded-xl p-3 border-2 transition-all flex flex-col justify-center text-center bg-secondary/5 border-sky-500/10 hover:bg-sky-500/5 hover:border-sky-500/40 ${
                  activeChildId === `${actualNodeId}::THEORY_A` ? "ring-2 ring-sky-500/50 border-sky-500/40" : ""
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-sky-500/30 text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm text-sky-600 whitespace-nowrap">
                  {supportingEdges.length}
                </div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1">{locale === "he" ? "תיאוריה א'" : "Theory A"}</span>
                <p className="text-sm font-medium text-foreground line-clamp-2">{theoryALabel}</p>
              </button>
              <button
                type="button"
                onClick={() => onDive(`${actualNodeId}::THEORY_B`, columnIndex, theoryBLabel)}
                className={`relative rounded-xl p-3 border-2 transition-all flex flex-col justify-center text-center bg-secondary/5 border-amber-500/10 hover:bg-amber-500/5 hover:border-amber-500/40 ${
                  activeChildId === `${actualNodeId}::THEORY_B` ? "ring-2 ring-amber-500/50 border-amber-500/40" : ""
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-amber-500/30 text-[10px] font-bold rounded-full px-2 py-0.5 shadow-sm text-amber-600 whitespace-nowrap">
                  {challengingEdges.length}
                </div>
                <span className="text-xs font-semibold text-muted-foreground block mb-1">{locale === "he" ? "תיאוריה ב'" : "Theory B"}</span>
                <p className="text-sm font-medium text-foreground line-clamp-2">{theoryBLabel}</p>
              </button>
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
        </>
      )}

      {/* 2. THEORY DIVE: claims clustered by thematic tag (theory name is in breadcrumbs / column context) */}
      {isMacroArena && isTheoryView && (
        <>
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-24 pt-4">
            <div className="flex flex-col gap-6 shrink-0 min-h-min">
              {sortedClusters.map(([tagName, edges]) => {
                const sortedByPulse = [...edges].sort((a, b) => {
                  const pa = a.target_node ? pulseFor(a.target_node) : -1;
                  const pb = b.target_node ? pulseFor(b.target_node) : -1;
                  return pb - pa;
                });
                return (
                  <div key={tagName} className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">{tagName}</h3>
                    {sortedByPulse.map((edge) => {
                      const child = edge.target_node;
                      if (!child) return null;
                      const childParsed = parseNodeContent(child.content, lang);
                      const isActive = child.id === activeChildId;
                      const score = childParsed.pulse;
                      return (
                        <button
                          key={edge.id}
                          type="button"
                          onClick={() => onDive(child.id, columnIndex, childParsed.assertion || "")}
                          className={`text-start p-4 rounded-xl border transition-all group relative overflow-hidden shrink-0 flex flex-col gap-2 ${
                            isActive ? "border-primary bg-primary/5 shadow-soft" : "border-border/50 bg-background hover:border-primary/50 hover:shadow-soft"
                          }`}
                        >
                          <div className={`absolute top-0 start-0 w-1 h-full transition-colors rounded-s ${isActive ? "bg-primary" : "bg-primary/20 group-hover:bg-primary/60"}`} />
                          <p className={`text-sm font-medium transition-colors ps-2 ${isActive ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
                            {childParsed.assertion || ""}
                          </p>
                          {score != null && (
                            <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground ms-2">
                              {locale === "he" ? SCORE_LABEL.he : SCORE_LABEL.en}: {score}/100
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {theoryEdges.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center p-8">
                  {locale === "he" ? "טרם נטענו טענות לתיאוריה זו." : "No claims for this theory yet."}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* 3. STANDARD CLAIM: validity bar + Support/Challenge + Supports/Challenges list */}
      {!isMacroArena && (
        <>
          <div className="p-6 border-b border-border/50 bg-secondary/5 shrink-0">
            <h2 className="font-bold text-foreground text-lg leading-relaxed">{assertionText}</h2>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {locale === "he" ? "תוקף נוכחי" : "Validity"}
                </span>
                <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                  <span className="text-muted-foreground">
                    {locale === "he" ? "בסיס:" : "Base:"} {baseScore}
                  </span>
                  {(data.node.resonance_count ?? 0) > 0 && (
                    <span
                      className="flex items-center gap-1 text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full shrink-0"
                      title={locale === "he" ? "הדהוד קהילתי (מכפיל כוח)" : "Community resonance (mass multiplier)"}
                    >
                      <Fingerprint className="size-3" aria-hidden />
                      {data.node.resonance_count}
                    </span>
                  )}
                  {supportMass > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{supportMass}</span>}
                  {challengeMass > 0 && <span className="text-amber-600 dark:text-amber-400">-{challengeMass}</span>}
                  <span className="text-lg font-black text-foreground ms-1">{currentValidity}/100</span>
                </div>
              </div>
              <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden flex">
                <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${currentValidity}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <SupportClaimDrawer authorWallet={authorWallet} parentId={data.node.id} targetNodeContext={assertionText} />
                <ChallengeClaimDrawer authorWallet={authorWallet} parentId={data.node.id} targetNodeContext={assertionText} />
                {hasGenesisAnchor ? (
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResonate}
                      disabled={isPending}
                      className={`gap-2 rounded-full transition-colors border ${
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
                      {locale === "he" ? (hasResonated ? RESONATED_CLAIM.he : RESONATE_CLAIM.he) : (hasResonated ? RESONATED_CLAIM.en : RESONATE_CLAIM.en)}
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
          </div>
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-24">
            <div className="flex flex-col gap-6 shrink-0 min-h-min">
              {parsed.rationale && (
                <div className="pt-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    {locale === "he" ? RATIONALE_LABEL.he : RATIONALE_LABEL.en}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {parsed.rationale}
                  </p>
                </div>
              )}
              {parsed.scoutWarning && (
                <div
                  className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/50 px-4 py-3"
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
              {supportingEdges.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <Shield className="size-3" />
                    {locale === "he" ? "מבססים" : "Supports"} ({supportingEdges.length})
                  </h3>
                  {sortedSupportingEdges.map((edge) => {
                    const child = edge.target_node;
                    if (!child) return null;
                    const childParsed = parseNodeContent(child.content, lang);
                    const isActive = child.id === activeChildId;
                    const score = childParsed.pulse;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => onDive(child.id, columnIndex, childParsed.assertion || "")}
                        className={`text-start p-3 rounded-xl border shrink-0 flex flex-col gap-2 ${isActive ? "border-emerald-500 bg-emerald-500/5" : "border-border/50 bg-background hover:border-emerald-500/30"}`}
                      >
                        <p className="text-xs font-medium ps-1">{childParsed.assertion || ""}</p>
                        {score != null && (
                          <span
                            className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                            aria-label={locale === "he" ? `ציון לוגי ${score}` : `Coherence ${score}`}
                          >
                            {locale === "he" ? SCORE_LABEL.he : SCORE_LABEL.en}: {score}/100
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {challengingEdges.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <Swords className="size-3" />
                    {locale === "he" ? "מפריכים" : "Challenges"} ({challengingEdges.length})
                  </h3>
                  {sortedChallengingEdges.map((edge) => {
                    const child = edge.target_node;
                    if (!child) return null;
                    const childParsed = parseNodeContent(child.content, lang);
                    const isActive = child.id === activeChildId;
                    const score = childParsed.pulse;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        onClick={() => onDive(child.id, columnIndex, childParsed.assertion || "")}
                        className={`text-start p-3 rounded-xl border shrink-0 flex flex-col gap-2 ${isActive ? "border-amber-500 bg-amber-500/5" : "border-border/50 bg-background hover:border-amber-500/30"}`}
                      >
                        <p className="text-xs font-medium ps-1">{childParsed.assertion || ""}</p>
                        {score != null && (
                          <span
                            className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                            aria-label={locale === "he" ? `ציון לוגי ${score}` : `Coherence ${score}`}
                          >
                            {locale === "he" ? SCORE_LABEL.he : SCORE_LABEL.en}: {score}/100
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {childEdges.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center p-8">
                  {locale === "he" ? "קצה הענף הלוגי. טרם נטענו ראיות." : "End of branch. No evidence anchored yet."}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <CodexSheet open={sbtCodexOpen} onOpenChange={setSbtCodexOpen} chapterId="sybil-resistance" />
    </div>
  );
}
