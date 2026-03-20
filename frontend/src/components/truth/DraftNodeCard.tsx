"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";
import { getLocalized } from "@/components/truth/forgeChatLib";
import { getDisplayAssertion } from "@/lib/utils/truthParser";
import { EpistemicStateBadge } from "@/components/truth/EpistemicStateBadge";
import { getMoveBadge } from "@/components/truth/EpistemicMoveBadge";
import type { MatchTruthNodeResult } from "@/types/truth";
import type { DraftEpistemicNodeV2, RosettaBlock } from "@/types/truth";

const ANCHOR_CTA = {
  he: "עגן טיעון למארג",
  en: "Anchor Claim to Weave",
};

const ARENA_CTA = {
  he: "ייסד זירת דיון",
  en: "Initiate Debate Arena",
};

const MACRO_ARENA_BADGE = {
  he: "הצעת זירת-על (Root Topic)",
  en: "Macro-Arena Proposal",
};

const RATIONALE_LABEL = { he: "נימוק", en: "Rationale" };
const SCOUT_LABEL = { he: "הנחות ואתגר פיספיקציה", en: "Hidden assumptions & falsification" };

const BADGE_SUPPORTS = { he: "משמש כתומכת עמוד (Supports)", en: "Supports" };
const BADGE_CHALLENGES = { he: "מציג חזית אתגר (Challenges)", en: "Challenges" };

const SEMANTIC_WARNING = {
  he: "עין האורקל מאבחנת שכבר נעצץ שורש מהותי כמעט זהה במארג:",
  en: "Oracle detects an identical foundational premise anchored already:",
};

const FORCE_PLANT_CTA = {
  he: "לא אותו דבר — נטוע זרע חדש בכוח",
  en: "Not the same — Force plant new seed",
};

const REVIEW_EXISTING = { he: "עיין או הדהד בשורש הקיים", en: "Review or resonate with existing node" };
const DETAILS_LABEL = { he: "פרטים", en: "Details" };
const ANCHORING_LABEL = { he: "עוגן…", en: "Anchoring…" };

export type ForgeDraft = DraftEpistemicNodeV2;

function pickDisplayBlock(
  draft: DraftEpistemicNodeV2,
  locale: string
): RosettaBlock & { isFallback: boolean } {
  const isHeUi = locale === "he";
  const src = (draft.source_locale ?? "en").toLowerCase();
  const lt = draft.local_translation;
  if (isHeUi && src === "he" && lt?.assertion?.trim()) {
    return { ...lt, isFallback: false };
  }
  if (isHeUi && lt?.assertion?.trim()) {
    return { ...lt, isFallback: false };
  }
  if (isHeUi) {
    return { ...draft.canonical_en, isFallback: true };
  }
  return { ...draft.canonical_en, isFallback: false };
}

function theoryAssertion(
  t: NonNullable<DraftEpistemicNodeV2["competingTheories"]>[0],
  locale: string
): string {
  const isHe = locale === "he";
  if (isHe && t.local_translation?.assertion?.trim()) return t.local_translation.assertion;
  return t.canonical_en.assertion;
}

const PORTAL_EXISTING_CTA = {
  he: "👉 הטיעון קיים במארג - צלול לדיון",
  en: "This claim exists in the Weave — dive into discussion",
};

interface DraftNodeCardProps {
  draft: ForgeDraft;
  onAnchor: () => void;
  isAnchoring?: boolean;
  authorWallet: string;
  parentId?: string;
  relationship?: "supports" | "challenges" | "ai_analysis";
  matchedExistingNodeId?: string | null;
  semanticDuplicates?: MatchTruthNodeResult[] | null;
  onForcePlant?: () => void;
  writeTelemetry?: string[] | null;
  isArchitectMode?: boolean;
}

export function DraftNodeCard({
  draft,
  onAnchor,
  isAnchoring = false,
  matchedExistingNodeId = null,
  semanticDuplicates = null,
  onForcePlant,
  writeTelemetry = null,
  isArchitectMode = false,
}: DraftNodeCardProps) {
  const { locale } = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(true);
  const [resonanceBlock, setResonanceBlock] = useState<{
    isBlocked: boolean;
    duplicates: MatchTruthNodeResult[];
  }>({ isBlocked: false, duplicates: [] });

  useEffect(() => {
    const hasDuplicates = Array.isArray(semanticDuplicates) && semanticDuplicates.length > 0;
    setResonanceBlock({
      isBlocked: hasDuplicates,
      duplicates: hasDuplicates ? semanticDuplicates : [],
    });
  }, [semanticDuplicates]);

  const isMacroArena = draft.thematicTags?.includes("macro-arena");
  const display = pickDisplayBlock(draft, locale);
  const assertion = display.assertion;
  const reasoning = display.reasoning ?? "";
  const hiddenAssumptions = display.hiddenAssumptions ?? [];
  const challengePrompt = display.challengePrompt ?? "";
  const hasDetails = reasoning || hiddenAssumptions.length > 0 || challengePrompt;

  const anchorLabel = isMacroArena ? getLocalized(ARENA_CTA, locale) : getLocalized(ANCHOR_CTA, locale);
  const macroArenaBadgeLabel = getLocalized(MACRO_ARENA_BADGE, locale);
  const rationaleLabel = getLocalized(RATIONALE_LABEL, locale);
  const scoutLabel = getLocalized(SCOUT_LABEL, locale);

  const portalLabel = getLocalized(PORTAL_EXISTING_CTA, locale);
  const epistemicState = draft.epistemicState ?? "SOLID";

  const rel = draft.relationshipToContext;
  const supportsLabel = getLocalized(BADGE_SUPPORTS, locale);
  const challengesLabel = getLocalized(BADGE_CHALLENGES, locale);

  const showSemanticBlock = resonanceBlock.isBlocked && resonanceBlock.duplicates.length > 0;
  const semanticWarningText = getLocalized(SEMANTIC_WARNING, locale);
  const forcePlantLabel = getLocalized(FORCE_PLANT_CTA, locale);
  const reviewLabel = getLocalized(REVIEW_EXISTING, locale);
  const detailsLabel = getLocalized(DETAILS_LABEL, locale);
  const anchoringLabel = getLocalized(ANCHORING_LABEL, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-primary/30 bg-card shadow-soft-md overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {isMacroArena ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
            role="status"
          >
            <Sparkles className="size-3" />
            {macroArenaBadgeLabel}
          </div>
        ) : rel ? (
          <div className="flex flex-wrap gap-2">
            {rel === "supports" ? (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-700/50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                role="status"
              >
                🛡️ {supportsLabel}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/25 dark:border-amber-700/50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
                role="status"
              >
                ⚔️ {challengesLabel}
              </span>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-medium text-foreground leading-relaxed flex-1 min-w-0">
            {assertion}
          </p>
          {display.isFallback && (
            <span className="text-[10px] shrink-0 bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
              {locale === "he" ? "מוצג באנגלית" : "Shown in English"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isMacroArena && (
            <EpistemicStateBadge state={epistemicState} locale={locale} />
          )}
          {getMoveBadge(draft.epistemicMoveType ?? null, locale === "he" ? "he" : "en")}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {detailsOpen ? "−" : "+"} {detailsLabel}
            </button>
          )}
        </div>
        {detailsOpen && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="space-y-3 pt-2 border-t border-border"
          >
            {reasoning && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {rationaleLabel}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{reasoning}</p>
              </div>
            )}
            {(hiddenAssumptions.length > 0 || challengePrompt) && (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {scoutLabel}
                </p>
                {hiddenAssumptions.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-amber-900/90 dark:text-amber-100/90 mb-1">
                    {hiddenAssumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                {challengePrompt && (
                  <p className="text-xs text-amber-900/90 dark:text-amber-100/90">{challengePrompt}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
        {isMacroArena && draft.competingTheories && draft.competingTheories.length === 2 && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-4 relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-[10px] font-bold text-muted-foreground z-10 shadow-sm">
              VS
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 ring-1 ring-inset ring-border/30 text-center shadow-soft">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                {locale === "he" ? "תיאוריה א'" : "Theory A"}
              </span>
              <p className="text-sm font-medium text-foreground">
                {theoryAssertion(draft.competingTheories[0], locale)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 ring-1 ring-inset ring-border/30 text-center shadow-soft">
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                {locale === "he" ? "תיאוריה ב'" : "Theory B"}
              </span>
              <p className="text-sm font-medium text-foreground">
                {theoryAssertion(draft.competingTheories[1], locale)}
              </p>
            </div>
          </div>
        )}
        {matchedExistingNodeId ? (
          <Link
            href={`/truth/node/${matchedExistingNodeId}`}
            className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-all no-underline shadow-soft"
          >
            {portalLabel}
          </Link>
        ) : showSemanticBlock ? (
          <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-3">
            <p className="text-sm text-amber-900 dark:text-amber-100 font-medium text-start">
              {semanticWarningText}
            </p>
            <ul className="space-y-2 text-start">
              {resonanceBlock.duplicates.map((dup) => {
                const displayDup = getDisplayAssertion(dup.content, locale);
                return (
                  <li key={dup.id}>
                    <Link
                      href={`/truth/node/${dup.id}`}
                      className="text-sm text-primary hover:underline font-medium block"
                    >
                      {displayDup.slice(0, 120)}
                      {displayDup.length > 120 ? "…" : ""}
                    </Link>
                    <span className="text-xs text-muted-foreground ms-1" title={reviewLabel}>
                      → /truth/node/{dup.id.slice(0, 8)}…
                    </span>
                  </li>
                );
              })}
            </ul>
            {onForcePlant && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onForcePlant}
                disabled={isAnchoring}
                className="w-full sm:w-auto border-amber-400/60 text-amber-900 dark:text-amber-100 hover:bg-amber-100/80 dark:hover:bg-amber-900/30"
              >
                {isAnchoring ? anchoringLabel : forcePlantLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              onClick={onAnchor}
              disabled={isAnchoring}
              className="w-full sm:w-auto bg-primary text-primary-foreground shadow-soft hover:opacity-90"
            >
              {isAnchoring ? anchoringLabel : anchorLabel}
            </Button>
          </div>
        )}
        {Array.isArray(writeTelemetry) &&
          writeTelemetry.length > 0 &&
          (isArchitectMode || writeTelemetry.some((l) => l.startsWith("[CRITICAL]"))) && (
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setTelemetryOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted text-muted-foreground font-mono text-xs text-start hover:bg-muted/80"
                aria-expanded={telemetryOpen}
              >
                <span className="text-primary font-semibold">
                  [Write Telemetry] {writeTelemetry.length} line(s)
                </span>
                <span aria-hidden>{telemetryOpen ? "−" : "+"}</span>
              </button>
              {telemetryOpen && (
                <pre
                  className="p-3 bg-background text-primary font-mono text-xs leading-relaxed overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words border-t border-border"
                  role="log"
                  aria-label="Backend anchor pipeline telemetry"
                >
                  {writeTelemetry.map((line, i) => (
                    <span key={i} className={line.startsWith("[CRITICAL]") ? "text-destructive" : undefined}>
                      {line}
                      {"\n"}
                    </span>
                  ))}
                </pre>
              )}
            </div>
          )}
      </div>
    </motion.div>
  );
}
