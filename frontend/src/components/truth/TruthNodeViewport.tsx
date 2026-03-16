"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ArrowUp, Feather } from "lucide-react";
import { useAccount } from "wagmi";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent, truncateAssertion } from "@/lib/utils/truthParser";
import { Button } from "@/components/ui/button";
import { ForgeSheet } from "@/components/truth/ForgeSheet";
import { SubmitClaimsDrawer } from "@/components/truth/SubmitClaimsDrawer";
import type { TruthNodeWithRelations, TruthNode, TruthNodeMetadata, ChildrenByRelationship } from "@/types/truth";

const FORGE_ENTRY = {
  he: "לטש תובנה במארג…",
  en: "Refine an insight in the Weave…",
};

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

function FocalPivot({
  content,
  thematicTags,
  locale,
  metadata,
  arenaBubbling,
  arenaNodeId,
}: {
  content: string;
  thematicTags?: string[];
  locale: "he" | "en";
  metadata?: TruthNodeMetadata;
  arenaBubbling?: ArenaBubblingStats;
  arenaNodeId?: string;
}) {
  const parsed = parseNodeContent(content, locale);
  const isMacroArena = thematicTags?.includes("macro-arena");
  const competingTheories = metadata?.competingTheories;
  const hasPulse = !isMacroArena && parsed.pulse != null;
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
            <div className="relative w-full h-3 rounded-full overflow-hidden bg-secondary/30 flex" role="img" aria-label={locale === "he" ? LOGICAL_MASS_BALANCE.he : LOGICAL_MASS_BALANCE.en}>
              <div className="h-full bg-amber-500/60 transition-all duration-1000" style={{ width: `${theoryBPct}%` }} />
              <div className="h-full bg-emerald-500/60 transition-all duration-1000" style={{ width: `${theoryAPct}%` }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-5 bg-border rounded-full z-10" aria-hidden />
            </div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground mt-1 px-1">
              <span>{theoryBPct}%</span>
              <span>{locale === "he" ? LOGICAL_MASS_BALANCE.he : LOGICAL_MASS_BALANCE.en}</span>
              <span>{theoryAPct}%</span>
            </div>
            {competingTheories && competingTheories.length === 2 && basePath && (
              <div className="mt-2 grid grid-cols-2 gap-4 relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-[10px] font-bold text-muted-foreground z-10 shadow-sm">
                  VS
                </div>
                <Link
                  href={`${basePath}?theory=THEORY_A`}
                  className="group relative rounded-xl bg-secondary/10 p-5 pt-6 border border-border/50 flex flex-col justify-center text-center hover:bg-secondary/20 hover:border-primary/50 transition-all cursor-pointer mt-2 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={locale === "he" ? `תיאוריה א', ${theoryACount} טענות` : `Theory A, ${theoryACount} claims`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-border text-[10px] font-bold rounded-full px-3 py-1 shadow-sm text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                    {locale === "he" ? `${theoryACount} ${CLAIMS_LABEL.he}` : `${theoryACount} ${CLAIMS_LABEL.en}`}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    {locale === "he" ? THEORY_A_LABEL.he : THEORY_A_LABEL.en}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {locale === "he" ? competingTheories[0].assertionHe : competingTheories[0].assertionEn}
                  </p>
                  <div className="mt-3 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {locale === "he" ? DIVE_INTO_CLAIMS.he : DIVE_INTO_CLAIMS.en}
                  </div>
                </Link>
                <Link
                  href={`${basePath}?theory=THEORY_B`}
                  className="group relative rounded-xl bg-secondary/10 p-5 pt-6 border border-border/50 flex flex-col justify-center text-center hover:bg-secondary/20 hover:border-primary/50 transition-all cursor-pointer mt-2 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={locale === "he" ? `תיאוריה ב', ${theoryBCount} טענות` : `Theory B, ${theoryBCount} claims`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background border border-border text-[10px] font-bold rounded-full px-3 py-1 shadow-sm text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                    {locale === "he" ? `${theoryBCount} ${CLAIMS_LABEL.he}` : `${theoryBCount} ${CLAIMS_LABEL.en}`}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    {locale === "he" ? THEORY_B_LABEL.he : THEORY_B_LABEL.en}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {locale === "he" ? competingTheories[1].assertionHe : competingTheories[1].assertionEn}
                  </p>
                  <div className="mt-3 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {locale === "he" ? DIVE_INTO_CLAIMS.he : DIVE_INTO_CLAIMS.en}
                  </div>
                </Link>
              </div>
            )}
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

function computeArenaBubbling(
  childrenByRelationship: ChildrenByRelationship,
  locale: "he" | "en"
): ArenaBubblingStats {
  let theoryAMass = 0;
  let theoryBMass = 0;
  const theoryACount = childrenByRelationship.supports.length;
  const theoryBCount = childrenByRelationship.challenges.length;

  childrenByRelationship.supports.forEach((child) => {
    const parsed = parseNodeContent(child.content, locale);
    theoryAMass += parsed.pulse ?? 0;
  });
  childrenByRelationship.challenges.forEach((child) => {
    const parsed = parseNodeContent(child.content, locale);
    theoryBMass += parsed.pulse ?? 0;
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
  const { locale } = useLocale();
  const { address } = useAccount();
  const isRtl = locale === "he";
  const { node, childrenByRelationship, parents } = data;
  const firstParent = parents[0] ?? null;
  const focalAssertion = parseNodeContent(node.content, locale).assertion || node.content.slice(0, 500);
  const isMacroArena = node.thematic_tags?.includes("macro-arena");
  const arenaBubbling = isMacroArena ? computeArenaBubbling(childrenByRelationship, locale) : undefined;

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
    theoryTitle = locale === "he" ? (theoryObj.assertionHe ?? theoryObj.assertionEn) : theoryObj.assertionEn;
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

  const [forgeOpen, setForgeOpen] = useState(false);

  function openForge() {
    setForgeOpen(true);
  }

  const hasChildren =
    childrenByRelationship.supports.length > 0 ||
    childrenByRelationship.challenges.length > 0 ||
    childrenByRelationship.ai_analysis.length > 0;

  // Level 1: Theory Dive view — breadcrumbs, theory header, list of supporting claims
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
              {locale === "he" ? activeTheoryObj?.assertionHe : activeTheoryObj?.assertionEn}
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
            {theoryClaims.length > 0 ? (
              <ul className="space-y-3">
                {theoryClaims.map((child) => {
                  const parsed = parseNodeContent(child.content, locale);
                  return (
                    <li key={child.id}>
                      <Link
                        href={`/truth/node/${child.id}`}
                        className="block group p-4 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:shadow-soft transition-all no-underline"
                      >
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {parsed.assertion}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          {parsed.pulse != null && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground"
                              aria-label={`Coherence ${parsed.pulse}`}
                            >
                              {parsed.pulse}/100
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {locale === "he" ? DIVE_INTO_CLAIM.he : DIVE_INTO_CLAIM.en}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
              theoryAEn={node.metadata.competingTheories[0].assertionEn}
              theoryAHe={node.metadata.competingTheories[0].assertionHe ?? node.metadata.competingTheories[0].assertionEn}
              theoryBEn={node.metadata.competingTheories[1].assertionEn}
              theoryBHe={node.metadata.competingTheories[1].assertionHe ?? node.metadata.competingTheories[1].assertionEn}
            />
          </div>
        )}
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
        />

        {/* Macro-Arena: no inline Submit Claims here; it lives in the sticky bottom bar below */}

        {/* Epistemic Forge + flat child list: only for non-Arena nodes (micro-claims) */}
        {!isMacroArena && (
          <div className="flex flex-col gap-6 mt-8">
            {address && (
              <motion.section
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-border bg-card/60 p-4 shadow-soft"
              >
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openForge}
                    className="border-primary/40 text-primary hover:bg-primary/10 focus-visible:ring-primary/40"
                    aria-label={locale === "he" ? FORGE_ENTRY.he : FORGE_ENTRY.en}
                  >
                    <Feather className="size-4 me-2 shrink-0 opacity-90" aria-hidden />
                    {locale === "he" ? FORGE_ENTRY.he : FORGE_ENTRY.en}
                  </Button>
                </div>
              </motion.section>
            )}

            {address && (
              <ForgeSheet
                isOpen={forgeOpen}
                onOpenChange={setForgeOpen}
                targetNodeContext={focalAssertion}
                mode="branch"
                authorWallet={address}
                parentId={node.id}
                onAnchored={() => setForgeOpen(false)}
              />
            )}

            {/* Categorical horizons: pillars & frictions — hidden on Arena, shown when diving into theory later */}
            {hasChildren && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid gap-8 sm:grid-cols-1 md:grid-cols-3"
              >
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    {locale === "he" ? SUPPORTING_LABEL.he : SUPPORTING_LABEL.en}
                  </h2>
                  <ul className="space-y-3">
                    {childrenByRelationship.supports.map((child) => (
                      <li key={child.id}>
                        <ChildCard node={child} relationship="supports" locale={locale} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">
                    {locale === "he" ? CHALLENGES_LABEL.he : CHALLENGES_LABEL.en}
                  </h2>
                  <ul className="space-y-3">
                    {childrenByRelationship.challenges.map((child) => (
                      <li key={child.id}>
                        <ChildCard node={child} relationship="challenges" locale={locale} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {locale === "he" ? OBSERVATIONS_LABEL.he : OBSERVATIONS_LABEL.en}
                  </h2>
                  <ul className="space-y-3">
                    {childrenByRelationship.ai_analysis.map((child) => (
                      <li key={child.id}>
                        <ChildCard node={child} relationship="ai_analysis" locale={locale} />
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.section>
            )}

            {!hasChildren && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center text-sm text-muted-foreground"
              >
                {isRtl ? "אין צמתים מקושרים מתחת לצומת זה." : "No linked nodes below this node."}
              </motion.p>
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
              theoryAEn={node.metadata.competingTheories[0].assertionEn}
              theoryAHe={node.metadata.competingTheories[0].assertionHe ?? node.metadata.competingTheories[0].assertionEn}
              theoryBEn={node.metadata.competingTheories[1].assertionEn}
              theoryBHe={node.metadata.competingTheories[1].assertionHe ?? node.metadata.competingTheories[1].assertionEn}
            />
          </div>
        )}
    </motion.main>
  );
}
