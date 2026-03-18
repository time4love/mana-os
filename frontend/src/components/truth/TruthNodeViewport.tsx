"use client";

import { useMemo, useTransition, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ArrowUp, Shield, Swords, Fingerprint, Activity, Lock, Check } from "lucide-react";
import { useAccount } from "wagmi";
import { useGenesisAnchor } from "@/hooks/useGenesisAnchor";
import { CodexSheet } from "@/components/ui/CodexSheet";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent, truncateAssertion } from "@/lib/utils/truthParser";
import { competingTheoryDisplayAssertion } from "@/lib/utils/truthRosetta";
import { Button } from "@/components/ui/button";
import { SupportClaimDrawer } from "@/components/truth/SupportClaimDrawer";
import { ChallengeClaimDrawer } from "@/components/truth/ChallengeClaimDrawer";
import { SubmitClaimsDrawer } from "@/components/truth/SubmitClaimsDrawer";
import { toggleNodeResonance, checkUserResonance } from "@/app/actions/truthWeaver";
import type { TruthNodeWithRelations, TruthNode, TruthNodeMetadata, ChildrenByRelationship } from "@/types/truth";

const CHILD_ASSERTION_MAX_LEN = 180;

const BREADCRUMB = {
  he: "הנחת יסוד קודמת",
  en: "Previous Premise / Parent",
};

const SUPPORTING_LABEL = {
  he: "תומכות עמוד / השקות מחזקות",
  en: "Supporting Formations",
};

const CHALLENGES_LABEL = {
  he: "אשכולי הפורר ואיתגורים צורמים",
  en: "Direct Challenges",
};

const OBSERVATIONS_LABEL = {
  he: "זגוגית נסתרת — האורקל מניח הנחה",
  en: "Logical Observations / Hidden Premises",
};

const BACK_TO_ENGINE = {
  he: "חזרה למנוע האמת",
  en: "Back to Truth Engine",
};

const EVIDENCE_BALANCE_TIE = { he: "איזון ראיות: תיקו", en: "Evidence Balance: Tie" };

const LOGICAL_MASS_BALANCE = { he: "מאזני הכוח הלוגי", en: "Logical Mass Balance" };
const DIVE_INTO_CLAIMS = { he: "לחץ כדי לצלול לטענות 🌊", en: "Click to dive into claims 🌊" };
const CLAIMS_LABEL = { he: "טענות", en: "Claims" };
const TRUTH_SPACE = { he: "מרחב האמת", en: "Truth Space" };
const BACK_TO_ARENA = { he: "חזור לזירת הדיון", en: "Back to Arena" };
const THEORY_A_LABEL = { he: "תיאוריה א'", en: "Theory A" };
const THEORY_B_LABEL = { he: "תיאוריה ב'", en: "Theory B" };
const SUPPORTING_CLAIMS_LEVEL1 = { he: "טענות מבססות (רמה 1)", en: "Supporting Claims (Level 1)" };
const SUPPORTING_CLAIMS_COUNT = { he: "טענות תומכות", en: "Supporting Claims" };
const DIVE_INTO_CLAIM = { he: "צלול לטענה זו 🌊", en: "Dive into claim 🌊" };
const NO_CLAIMS_FOR_THEORY = { he: "טרם בוססו טענות עבור תיאוריה זו.", en: "No claims have been anchored for this theory yet." };
const RESONATE_CLAIM = { he: "הדהד טענה זו", en: "Resonate" };
const RESONATED_CLAIM = { he: "הדהדת · לחץ להסרה", en: "Resonated · Click to remove" };
const SBT_REQUIRED_TITLE = { he: "נדרש חותם מאנה (SBT) להדהוד", en: "Genesis Anchor (SBT) required to resonate" };
const LOGICAL_CLAIM = { he: "טענה לוגית", en: "Logical Claim" };
const BACK_TO_PARENT = { he: "חזור להנחת האב", en: "Back to Parent Premise" };
const TRUTH_WEAVE = { he: "מרחב האמת", en: "Truth Weave" };

/** Bubbling Algorithm: logical mass per theory (supports = A, challenges = B). */
export interface ArenaBubblingStats {
  theoryAMass: number;
  theoryBMass: number;
  theoryACount: number;
  theoryBCount: number;
  theoryAPercentage: number;
  theoryBPercentage: number;
}

/** Dynamic validity bar for standard claims (Bubbling Algorithm). */
export interface ValidityBarData {
  baseScore: number;
  supportMass: number;
  challengeMass: number;
  currentValidity: number;
}

function FocalPivot({
  content,
  thematicTags,
  locale,
  metadata,
  arenaBubbling,
  arenaNodeId,
  validityBar,
  resonanceCount,
}: {
  content: string;
  thematicTags?: string[];
  locale: "he" | "en";
  metadata?: TruthNodeMetadata;
  arenaBubbling?: ArenaBubblingStats;
  arenaNodeId?: string;
  /** When set, standard claim shows dynamic Validity Health Bar instead of static pulse. */
  validityBar?: ValidityBarData;
  /** Epistemic Resonance votes (community overrule multiplier). */
  resonanceCount?: number;
}) {
  const parsed = parseNodeContent(content, locale);
  const isMacroArena = thematicTags?.includes("macro-arena");
  const competingTheories = metadata?.competingTheories;
  const hasPulse = !isMacroArena && parsed.pulse != null && validityBar == null;
  const tags = thematicTags?.filter((t): t is string => typeof t === "string" && t.trim().length > 0) ?? [];

  const theoryAPct = arenaBubbling?.theoryAPercentage ?? 50;
  const theoryBPct = arenaBubbling?.theoryBPercentage ?? 50;
  const theoryACount = arenaBubbling?.theoryACount ?? 0;
  const theoryBCount = arenaBubbling?.theoryBCount ?? 0;
  const basePath = arenaNodeId ? `/truth/node/${arenaNodeId}` : "";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-xl border-2 border-primary/40 bg-primary/5 shadow-soft-md p-6 sm:p-8 space-y-5"
    >
      <div className="rounded-lg border border-primary/20 bg-background/80 p-5 sm:p-6 space-y-5">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Thematic constellation">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="text-lg sm:text-xl text-foreground leading-relaxed font-medium">
          {parsed.assertion}
        </p>
        {isMacroArena ? (
          <div className="mt-6 flex flex-col gap-4">
            {/* Tug-of-War: Sky (Theory A) vs Amber (Theory B); bar order matches boxes (RTL: A=start, B=end) */}
            <div
              className="relative w-full h-3 rounded-full overflow-hidden bg-secondary/30 flex flex-row"
              role="img"
              aria-label={locale === "he" ? LOGICAL_MASS_BALANCE.he : LOGICAL_MASS_BALANCE.en}
            >
              <div
                className="h-full bg-sky-500/60 transition-all duration-1000 ease-out"
                style={{ width: `${theoryAPct}%` }}
              />
              <div
                className="h-full bg-amber-500/60 transition-all duration-1000 ease-out"
                style={{ width: `${theoryBPct}%` }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-background/80 z-10" aria-hidden />
            </div>
            <div className="flex justify-between text-xs font-bold mt-2 px-1">
              <span className="text-sky-600 dark:text-sky-400">{theoryAPct}%</span>
              <span className="text-muted-foreground font-medium">
                {locale === "he" ? LOGICAL_MASS_BALANCE.he : LOGICAL_MASS_BALANCE.en}
              </span>
              <span className="text-amber-600 dark:text-amber-400">{theoryBPct}%</span>
            </div>
            {competingTheories && competingTheories.length === 2 && basePath && (
              <div className="mt-2 grid grid-cols-2 gap-4 relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-[10px] font-bold text-muted-foreground z-10 shadow-sm">
                  VS
                </div>
                <Link
                  href={`${basePath}?theory=THEORY_A`}
                  className="group relative rounded-xl bg-secondary/5 p-5 pt-6 border-2 border-sky-500/20 hover:bg-sky-500/5 hover:border-sky-500/40 transition-all cursor-pointer mt-2 no-underline flex flex-col justify-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                  aria-label={locale === "he" ? `תיאוריה א', ${theoryACount} טענות` : `Theory A, ${theoryACount} claims`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-sky-500/30 text-[10px] font-bold rounded-full px-3 py-1 shadow-sm text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    {locale === "he" ? `${theoryACount} ${CLAIMS_LABEL.he}` : `${theoryACount} ${CLAIMS_LABEL.en}`}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    {locale === "he" ? THEORY_A_LABEL.he : THEORY_A_LABEL.en}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {competingTheoryDisplayAssertion(competingTheories[0], locale === "he" ? "he" : "en")}
                  </p>
                  <div className="mt-3 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {locale === "he" ? DIVE_INTO_CLAIMS.he : DIVE_INTO_CLAIMS.en}
                  </div>
                </Link>
                <Link
                  href={`${basePath}?theory=THEORY_B`}
                  className="group relative rounded-xl bg-secondary/5 p-5 pt-6 border-2 border-amber-500/20 hover:bg-amber-500/5 hover:border-amber-500/40 transition-all cursor-pointer mt-2 no-underline flex flex-col justify-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  aria-label={locale === "he" ? `תיאוריה ב', ${theoryBCount} טענות` : `Theory B, ${theoryBCount} claims`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-amber-500/30 text-[10px] font-bold rounded-full px-3 py-1 shadow-sm text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {locale === "he" ? `${theoryBCount} ${CLAIMS_LABEL.he}` : `${theoryBCount} ${CLAIMS_LABEL.en}`}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    {locale === "he" ? THEORY_B_LABEL.he : THEORY_B_LABEL.en}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {competingTheoryDisplayAssertion(competingTheories[1], locale === "he" ? "he" : "en")}
                  </p>
                  <div className="mt-3 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {locale === "he" ? DIVE_INTO_CLAIMS.he : DIVE_INTO_CLAIMS.en}
                  </div>
                </Link>
              </div>
            )}
          </div>
        ) : validityBar ? (
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {locale === "he" ? "תוקף לוגי נוכחי" : "Current Validity"}
              </span>
              <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                <span className="text-muted-foreground" title="Base Score">
                  {locale === "he" ? "בסיס" : "Base"}: {validityBar.baseScore}
                </span>
                {(resonanceCount ?? 0) > 0 && (
                  <span
                    className="flex items-center gap-1 text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full"
                    title={locale === "he" ? "הדהוד קהילתי (מכפיל כוח)" : "Community resonance (mass multiplier)"}
                  >
                    <Fingerprint className="size-3" aria-hidden />
                    {resonanceCount}
                  </span>
                )}
                {validityBar.supportMass > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">+{validityBar.supportMass}</span>
                )}
                {validityBar.challengeMass > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">-{validityBar.challengeMass}</span>
                )}
                <span className="text-lg font-black text-foreground ms-2">
                  {validityBar.currentValidity}/100
                </span>
              </div>
            </div>
            <div
              role="progressbar"
              aria-valuenow={validityBar.currentValidity}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 w-full bg-secondary/30 rounded-full overflow-hidden flex"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${validityBar.currentValidity}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </div>
        ) : (
          hasPulse && (
            <div className="space-y-1.5">
              <div
                role="progressbar"
                aria-valuenow={parsed.pulse ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <motion.div
                  initial={{ inlineSize: 0 }}
                  animate={{ inlineSize: `${parsed.pulse ?? 0}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full bg-emerald-500"
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Logician&apos;s Pulse: {parsed.pulse}/100
              </p>
            </div>
          )
        )}
        {parsed.rationale && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Rationale
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
            aria-label="Scout's edge"
          >
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
              Hidden assumptions & falsification
            </p>
            <p className="text-sm text-amber-900/90 dark:text-amber-100/90 leading-relaxed whitespace-pre-wrap">
              {parsed.scoutWarning}
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

type CurrentTheoryParam = "THEORY_A" | "THEORY_B";

interface TruthNodeViewportProps {
  data: TruthNodeWithRelations;
  /** When present on a macro-arena, shows Level 1 Theory Dive view (claims for that theory). */
  currentTheory?: CurrentTheoryParam;
}

function ChildCard({
  node,
  relationship,
  locale,
}: {
  node: TruthNode;
  relationship: "supports" | "challenges" | "ai_analysis";
  locale: "he" | "en";
}) {
  const parsed = parseNodeContent(node.content, locale);
  const isRtl = locale === "he";

  const variant =
    relationship === "supports"
      ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/60"
      : relationship === "challenges"
        ? "bg-stone-100/80 dark:bg-stone-900/30 border-stone-300/50"
        : "bg-amber-50/80 dark:bg-amber-950/25 border-amber-300/50";

  return (
    <Link
      href={`/truth/node/${node.id}`}
      className={`block rounded-lg border p-4 text-start shadow-soft transition-shadow hover:shadow-soft-md ${variant}`}
    >
      <p className="text-sm text-foreground leading-relaxed line-clamp-3">
        {truncateAssertion(parsed.assertion, CHILD_ASSERTION_MAX_LEN)}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {isRtl ? "היכנס לצומת" : "Enter node"}
          <ChevronRight className={`size-3.5 ${isRtl ? "rotate-180" : ""}`} aria-hidden />
        </span>
        {parsed.pulse != null && (
          <span
            className="font-mono text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0"
            aria-label={`Coherence ${parsed.pulse}`}
          >
            {parsed.pulse}
          </span>
        )}
      </div>
    </Link>
  );
}

function childMassForBubbling(child: TruthNode, locale: "he" | "en"): number {
  const base = parseNodeContent(child.content, locale).pulse ?? 0;
  const resonance = child.resonance_count ?? 0;
  return Math.round(base * (1 + resonance * 0.2));
}

function computeArenaBubbling(
  childrenByRelationship: ChildrenByRelationship,
  locale: "he" | "en"
): ArenaBubblingStats {
  let theoryAMass = 0;
  let theoryBMass = 0;
  const theoryACount = childrenByRelationship.supports.length;
  const theoryBCount = childrenByRelationship.challenges.length;

  childrenByRelationship.supports.forEach((child) => {
    theoryAMass += childMassForBubbling(child, locale);
  });
  childrenByRelationship.challenges.forEach((child) => {
    theoryBMass += childMassForBubbling(child, locale);
  });

  const totalMass = theoryAMass + theoryBMass;
  const theoryAPercentage = totalMass === 0 ? 50 : Math.round((theoryAMass / totalMass) * 100);
  const theoryBPercentage = totalMass === 0 ? 50 : Math.round((theoryBMass / totalMass) * 100);

  return {
    theoryAMass,
    theoryBMass,
    theoryACount,
    theoryBCount,
    theoryAPercentage,
    theoryBPercentage,
  };
}

export function TruthNodeViewport({ data, currentTheory }: TruthNodeViewportProps) {
  const { node, childrenByRelationship, parents } = data;
  const { locale } = useLocale();
  const { address } = useAccount();
  const { hasGenesisAnchor } = useGenesisAnchor();
  const router = useRouter();
  const [isResonating, startTransition] = useTransition();
  const [sbtCodexOpen, setSbtCodexOpen] = useState(false);
  const [hasResonated, setHasResonated] = useState(false);
  const isRtl = locale === "he";

  useEffect(() => {
    if (address && node.id) {
      checkUserResonance(node.id, address).then(setHasResonated);
    }
  }, [node.id, address]);
  const firstParent = parents[0] ?? null;
  const parsedFocal = parseNodeContent(node.content, locale);
  const focalAssertion = parsedFocal.assertion || node.content.slice(0, 500);
  const isMacroArena = node.thematic_tags?.includes("macro-arena");

  // Rich context for Support/Challenge drawers: assertion + score + rationale so Socrates can explain and defend
  const richContextForDrawer =
    locale === "he"
      ? `טענה: ${parsedFocal.assertion}\nציון לוגי נוכחי: ${parsedFocal.pulse ?? "—"}/100\nנימוק הציון (Rationale): ${parsedFocal.rationale ?? "לא סופק נימוק."}`
      : `Claim: ${parsedFocal.assertion}\nCurrent Logical Score: ${parsedFocal.pulse ?? "—"}/100\nScore Rationale: ${parsedFocal.rationale ?? "No rationale provided."}`;
  const arenaBubbling = isMacroArena ? computeArenaBubbling(childrenByRelationship, locale) : undefined;

  // Bubbling Algorithm: Node Mass = Base Score * (1 + resonance_count * 0.2) — community overrule
  const supportingChildren = childrenByRelationship.supports;
  const challengingChildren = childrenByRelationship.challenges;
  const baseScore = !isMacroArena
    ? parseNodeContent(node.content, locale).pulse ?? 0
    : 0;
  const supportMass = supportingChildren.reduce((sum, child) => sum + childMassForBubbling(child, locale), 0);
  const challengeMass = challengingChildren.reduce((sum, child) => sum + childMassForBubbling(child, locale), 0);
  const currentValidity = Math.max(
    0,
    Math.min(100, baseScore + supportMass - challengeMass)
  );
  const validityBar: ValidityBarData | undefined =
    !isMacroArena
      ? { baseScore, supportMass, challengeMass, currentValidity }
      : undefined;

  // For claims under a Macro-Arena: detect arena parent and theory for context-aware breadcrumbs
  const connectedArena = !isMacroArena
    ? parents.find((p) => p.node.thematic_tags?.includes("macro-arena"))
    : null;
  const supportedTheoryKey =
    connectedArena?.relationship === "supports"
      ? "THEORY_A"
      : connectedArena?.relationship === "challenges"
        ? "THEORY_B"
        : null;
  let theoryTitle = "";
  if (
    connectedArena?.node.metadata?.competingTheories &&
    supportedTheoryKey &&
    connectedArena.node.metadata.competingTheories.length >= 2
  ) {
    const theoryIdx = supportedTheoryKey === "THEORY_A" ? 0 : 1;
    const theoryObj = connectedArena.node.metadata.competingTheories[theoryIdx];
    theoryTitle = competingTheoryDisplayAssertion(theoryObj, locale === "he" ? "he" : "en");
  }
  const arenaTitle =
    connectedArena?.node.content != null
      ? parseNodeContent(connectedArena.node.content, locale).assertion || connectedArena.node.content.slice(0, 120)
      : "";

  const isTheoryDive = isMacroArena && (currentTheory === "THEORY_A" || currentTheory === "THEORY_B");
  const competingTheories = node.metadata?.competingTheories;
  const activeTheoryObj =
    isTheoryDive && competingTheories?.length === 2
      ? currentTheory === "THEORY_A"
        ? competingTheories[0]
        : competingTheories[1]
      : null;
  const theoryClaims =
    currentTheory === "THEORY_A"
      ? childrenByRelationship.supports
      : currentTheory === "THEORY_B"
        ? childrenByRelationship.challenges
        : [];

  // Cluster claims by primary thematic tag for Theory Dive (epistemic hierarchy, avoid flat feed)
  const clusteredClaims = useMemo(() => {
    const groups: Record<string, TruthNode[]> = {};
    theoryClaims.forEach((child) => {
      const rawTags = child.thematic_tags ?? [];
      const primaryTag =
        rawTags.length > 0 ? rawTags[0] : (locale === "he" ? "כללי" : "General");
      const normalizedTag =
        primaryTag.charAt(0).toUpperCase() + primaryTag.slice(1).toLowerCase();
      if (!groups[normalizedTag]) groups[normalizedTag] = [];
      groups[normalizedTag].push(child);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [theoryClaims, locale]);

  // Level 1: Theory Dive view — breadcrumbs, theory header, list of supporting claims (clustered by theme)
  if (isTheoryDive) {
    const theoryLabel =
      currentTheory === "THEORY_A"
        ? (locale === "he" ? THEORY_A_LABEL.he : THEORY_A_LABEL.en)
        : (locale === "he" ? THEORY_B_LABEL.he : THEORY_B_LABEL.en);
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 md:px-8 pb-24`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-4xl flex flex-col gap-6">
          <nav
            className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link href="/truth" className="hover:text-primary transition-colors">
              {locale === "he" ? TRUTH_SPACE.he : TRUTH_SPACE.en}
            </Link>
            <span className="opacity-50" aria-hidden>
              /
            </span>
            <Link href={`/truth/node/${node.id}`} className="hover:text-primary transition-colors truncate max-w-[12rem]">
              {focalAssertion.length > 24 ? focalAssertion.slice(0, 24).trim() + "…" : focalAssertion}
            </Link>
            <span className="opacity-50" aria-hidden>
              /
            </span>
            <span className="text-foreground truncate">{theoryLabel}</span>
          </nav>

          <div className="rounded-2xl bg-secondary/10 p-6 border border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-primary/40" aria-hidden />
            <h2 className="text-lg md:text-xl font-bold text-foreground leading-relaxed">
              {activeTheoryObj
                ? competingTheoryDisplayAssertion(activeTheoryObj, locale === "he" ? "he" : "en")
                : ""}
            </h2>
            <div className="mt-4 inline-flex items-center gap-2 bg-background border border-border text-xs rounded-full px-3 py-1 shadow-sm text-muted-foreground">
              <span>
                {locale === "he"
                  ? `${theoryClaims.length} ${SUPPORTING_CLAIMS_COUNT.he}`
                  : `${theoryClaims.length} ${SUPPORTING_CLAIMS_COUNT.en}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {locale === "he" ? SUPPORTING_CLAIMS_LEVEL1.he : SUPPORTING_CLAIMS_LEVEL1.en}
            </h3>
            {clusteredClaims.length > 0 ? (
              <div className="flex flex-col gap-8 mt-6">
                {clusteredClaims.map(([tag, claimsInGroup]) => (
                  <div key={tag} className="flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border/50 pb-2">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                        {claimsInGroup.length}
                      </span>
                      {tag}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {claimsInGroup.map((child) => {
                        const parsed = parseNodeContent(child.content, locale);
                        return (
                          <Link
                            key={child.id}
                            href={`/truth/node/${child.id}`}
                            className="block group no-underline"
                          >
                            <div className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:shadow-soft transition-all h-full flex flex-col">
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                                {parsed.assertion}
                              </p>
                              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                                {parsed.pulse != null ? (
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                                    aria-label={`Coherence ${parsed.pulse}`}
                                  >
                                    {locale === "he" ? "ציון לוגי:" : "Score:"} {parsed.pulse}/100
                                  </span>
                                ) : (
                                  <span />
                                )}
                                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  {locale === "he" ? "צלול לטענה זו" : "Dive into claim"} →
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                {locale === "he" ? NO_CLAIMS_FOR_THEORY.he : NO_CLAIMS_FOR_THEORY.en}
              </p>
            )}
          </div>
        </div>

        {node.metadata?.competingTheories && node.metadata.competingTheories.length >= 2 && (
          <div
            className="fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur-md border-t border-border z-40 flex justify-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <SubmitClaimsDrawer
              arenaId={node.id}
              theoryAEn={competingTheoryDisplayAssertion(node.metadata.competingTheories[0], "en")}
              theoryAHe={competingTheoryDisplayAssertion(node.metadata.competingTheories[0], "he")}
              theoryBEn={competingTheoryDisplayAssertion(node.metadata.competingTheories[1], "en")}
              theoryBHe={competingTheoryDisplayAssertion(node.metadata.competingTheories[1], "he")}
              hasGenesisAnchor={hasGenesisAnchor}
              onLockedClick={() => setSbtCodexOpen(true)}
            />
          </div>
        )}
        <CodexSheet
          open={sbtCodexOpen}
          onOpenChange={setSbtCodexOpen}
          chapterId="sybil-resistance"
        />
      </motion.main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={`min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 md:px-8 ${isMacroArena ? "pb-24" : ""}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Breadcrumbs: Arena-aware for claims; simple for arena root */}
        {isMacroArena ? (
          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link href="/truth" className="text-muted-foreground hover:text-foreground transition-colors">
              {locale === "he" ? TRUTH_SPACE.he : TRUTH_SPACE.en}
            </Link>
            <span className="text-muted-foreground/70" aria-hidden>
              <ChevronRight className={`inline size-4 ${isRtl ? "rotate-180" : ""}`} />
            </span>
            <span className="text-foreground font-medium truncate max-w-[min(100%,20rem)]" title={focalAssertion}>
              {focalAssertion.length > 48 ? focalAssertion.slice(0, 48).trim() + "…" : focalAssertion}
            </span>
          </nav>
        ) : (
          <nav
            className="flex flex-wrap items-center text-xs sm:text-sm font-medium text-muted-foreground mb-6 gap-2"
            aria-label="Breadcrumb"
          >
            <Link href="/truth" className="hover:text-primary transition-colors whitespace-nowrap">
              {locale === "he" ? TRUTH_WEAVE.he : TRUTH_WEAVE.en}
            </Link>
            {connectedArena ? (
              <>
                <span className="opacity-50" aria-hidden>
                  /
                </span>
                <Link
                  href={`/truth/node/${connectedArena.node.id}`}
                  className="hover:text-primary transition-colors max-w-[150px] sm:max-w-[200px] truncate block"
                  title={arenaTitle}
                >
                  {arenaTitle.length > 28 ? arenaTitle.slice(0, 28).trim() + "…" : arenaTitle}
                </Link>
                {theoryTitle && supportedTheoryKey && (
                  <>
                    <span className="opacity-50" aria-hidden>
                      /
                    </span>
                    <Link
                      href={`/truth/node/${connectedArena.node.id}?theory=${supportedTheoryKey}`}
                      className="hover:text-primary transition-colors max-w-[150px] sm:max-w-[200px] truncate block"
                      title={theoryTitle}
                    >
                      {theoryTitle.length > 28 ? theoryTitle.slice(0, 28).trim() + "…" : theoryTitle}
                    </Link>
                  </>
                )}
              </>
            ) : (
              firstParent && (
                <>
                  <span className="opacity-50" aria-hidden>
                    /
                  </span>
                  <Link
                    href={`/truth/node/${firstParent.node.id}`}
                    className="hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowUp className={`size-4 ${isRtl ? "rotate-90" : "-rotate-90"}`} aria-hidden />
                    {locale === "he" ? BACK_TO_PARENT.he : BACK_TO_PARENT.en}
                  </Link>
                </>
              )
            )}
            <span className="opacity-50" aria-hidden>
              /
            </span>
            <span className="text-foreground whitespace-nowrap">
              {locale === "he" ? LOGICAL_CLAIM.he : LOGICAL_CLAIM.en}
            </span>
          </nav>
        )}

        {/* Core pivot: central node — thematic tags, parsed assertion, pulse bar or arena balance, rationale, scout */}
        <FocalPivot
          content={node.content}
          thematicTags={node.thematic_tags}
          locale={locale}
          metadata={node.metadata}
          arenaBubbling={arenaBubbling}
          arenaNodeId={isMacroArena ? node.id : undefined}
          validityBar={validityBar}
          resonanceCount={node.resonance_count}
        />

        {/* Macro-Arena: no inline Submit Claims here; it lives in the sticky bottom bar below */}

        {/* Mini-Arena: tactical Support / Challenge + two-column debate layout (standard claims only) */}
        {!isMacroArena && (
          <div className="flex flex-col gap-6 mt-8">
            {address && (
              <div className="flex flex-wrap items-center gap-3 mt-8 border-t border-border/50 pt-6">
                {hasGenesisAnchor ? (
                  <>
                    <SupportClaimDrawer
                      authorWallet={address}
                      parentId={node.id}
                      targetNodeContext={richContextForDrawer}
                    />
                    <ChallengeClaimDrawer
                      authorWallet={address}
                      parentId={node.id}
                      targetNodeContext={richContextForDrawer}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1 text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full text-xs font-medium"
                        title={locale === "he" ? "הדהוד קהילתי (מכפיל כוח)" : "Community resonance (mass multiplier)"}
                      >
                        <Fingerprint className="size-3" aria-hidden />
                        {node.resonance_count ?? 0}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          startTransition(async () => {
                            const prev = hasResonated;
                            setHasResonated(!prev);
                            const res = await toggleNodeResonance(node.id, address);
                            if (!res.success) {
                              setHasResonated(prev);
                            } else if ("resonating" in res) {
                              setHasResonated(res.resonating);
                            }
                            router.refresh();
                          });
                        }}
                        disabled={isResonating}
                        className={`gap-2 rounded-full transition-colors border ${
                          hasResonated
                            ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white shadow-sm font-medium"
                            : "text-primary hover:bg-primary/10 border-primary/20"
                        }`}
                      >
                        {hasResonated ? (
                          <Check className="size-4 shrink-0" aria-hidden />
                        ) : (
                          <Activity className={`size-4 shrink-0 ${isResonating ? "animate-pulse" : ""}`} aria-hidden />
                        )}
                        {locale === "he" ? (hasResonated ? RESONATED_CLAIM.he : RESONATE_CLAIM.he) : (hasResonated ? RESONATED_CLAIM.en : RESONATE_CLAIM.en)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSbtCodexOpen(true)}
                      className="gap-2 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50 cursor-not-allowed opacity-80"
                      aria-label={locale === "he" ? "בסס טענה זו (נעול)" : "Support Claim (locked)"}
                      title={locale === "he" ? "נדרש חותם מאנה (SBT)" : "Genesis Anchor (SBT) required"}
                    >
                      <Lock className="size-4" aria-hidden />
                      {locale === "he" ? "בסס טענה זו" : "Support Claim"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSbtCodexOpen(true)}
                      className="gap-2 rounded-full border-border/50 text-muted-foreground hover:bg-muted/50 cursor-not-allowed opacity-80"
                      aria-label={locale === "he" ? "הפרך טענה זו (נעול)" : "Challenge Claim (locked)"}
                      title={locale === "he" ? "נדרש חותם מאנה (SBT)" : "Genesis Anchor (SBT) required"}
                    >
                      <Lock className="size-4" aria-hidden />
                      {locale === "he" ? "הפרך טענה זו" : "Challenge Claim"}
                    </Button>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1 text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full text-xs font-medium"
                        title={locale === "he" ? "הדהוד קהילתי (מכפיל כוח)" : "Community resonance (mass multiplier)"}
                      >
                        <Fingerprint className="size-3" aria-hidden />
                        {node.resonance_count ?? 0}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSbtCodexOpen(true)}
                        className="gap-2 rounded-full text-muted-foreground border border-border/50 opacity-70 hover:bg-muted/50 transition-colors cursor-not-allowed"
                        title={locale === "he" ? SBT_REQUIRED_TITLE.he : SBT_REQUIRED_TITLE.en}
                      >
                        <Lock className="size-4" aria-hidden />
                        {locale === "he" ? RESONATE_CLAIM.he : RESONATE_CLAIM.en}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            <CodexSheet
              open={sbtCodexOpen}
              onOpenChange={setSbtCodexOpen}
              chapterId="sybil-resistance"
            />

            {/* Two-column tactical debate: Supports vs Challenges */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12"
            >
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b border-border/50 pb-2">
                  <Shield className="size-4" aria-hidden />
                  {locale === "he"
                    ? `מבססים (${supportingChildren.length})`
                    : `Supports (${supportingChildren.length})`}
                </h3>
                {supportingChildren.length > 0 ? (
                  <ul className="space-y-3">
                    {supportingChildren.map((child) => (
                      <li key={child.id}>
                        <ChildCard node={child} relationship="supports" locale={locale} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4">
                    {locale === "he" ? "אין טענות מבססות עדיין." : "No supporting claims yet."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2 border-b border-border/50 pb-2">
                  <Swords className="size-4" aria-hidden />
                  {locale === "he"
                    ? `מפריכים (${challengingChildren.length})`
                    : `Challenges (${challengingChildren.length})`}
                </h3>
                {challengingChildren.length > 0 ? (
                  <ul className="space-y-3">
                    {challengingChildren.map((child) => (
                      <li key={child.id}>
                        <ChildCard node={child} relationship="challenges" locale={locale} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4">
                    {locale === "he" ? "אין טענות מפריכות עדיין." : "No challenging claims yet."}
                  </p>
                )}
              </div>
            </motion.section>

            {/* Observations (ai_analysis) — compact row when present */}
            {childrenByRelationship.ai_analysis.length > 0 && (
              <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-border/50">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {locale === "he" ? OBSERVATIONS_LABEL.he : OBSERVATIONS_LABEL.en}
                </h3>
                <ul className="space-y-3">
                  {childrenByRelationship.ai_analysis.map((child) => (
                    <li key={child.id}>
                      <ChildCard node={child} relationship="ai_analysis" locale={locale} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar: Submit Claims only on Macro-Arena */}
      {isMacroArena &&
        node.metadata?.competingTheories &&
        node.metadata.competingTheories.length >= 2 && (
          <div
            className="fixed bottom-0 inset-x-0 p-4 bg-background/80 backdrop-blur-md border-t border-border z-40 flex justify-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <SubmitClaimsDrawer
              arenaId={node.id}
              theoryAEn={competingTheoryDisplayAssertion(node.metadata.competingTheories[0], "en")}
              theoryAHe={competingTheoryDisplayAssertion(node.metadata.competingTheories[0], "he")}
              theoryBEn={competingTheoryDisplayAssertion(node.metadata.competingTheories[1], "en")}
              theoryBHe={competingTheoryDisplayAssertion(node.metadata.competingTheories[1], "he")}
              hasGenesisAnchor={hasGenesisAnchor}
              onLockedClick={() => setSbtCodexOpen(true)}
            />
          </div>
        )}
      <CodexSheet
        open={sbtCodexOpen}
        onOpenChange={setSbtCodexOpen}
        chapterId="sybil-resistance"
      />
    </motion.main>
  );
}
