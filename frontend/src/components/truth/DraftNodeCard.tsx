"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";
import type { MatchTruthNodeResult } from "@/types/truth";

const ANCHOR_CTA = {
  he: "עגן טיעון למארג",
  en: "Anchor Premise to Weave",
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

export interface ForgeDraft {
  assertion: string;
  logicalCoherenceScore: number;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
  /** Classified by the Logician: supports or challenges the parent premise. */
  relationshipToContext?: "supports" | "challenges";
}

interface DraftNodeCardProps {
  draft: ForgeDraft;
  onAnchor: () => void;
  isAnchoring?: boolean;
  authorWallet: string;
  parentId?: string;
  relationship?: "supports" | "challenges" | "ai_analysis";
  /** When set, anchor was blocked by semantic dedup; show warning + links and force-plant option. */
  semanticDuplicates?: MatchTruthNodeResult[] | null;
  /** Call to anchor with forceBypass (plant new seed despite similar existing nodes). */
  onForcePlant?: () => void;
}

export function DraftNodeCard({
  draft,
  onAnchor,
  isAnchoring = false,
  semanticDuplicates = null,
  onForcePlant,
}: DraftNodeCardProps) {
  const { locale } = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails = draft.reasoning || draft.hiddenAssumptions?.length > 0 || draft.challengePrompt;

  const anchorLabel = locale === "he" ? ANCHOR_CTA.he : ANCHOR_CTA.en;
  const rationaleLabel = locale === "he" ? RATIONALE_LABEL.he : RATIONALE_LABEL.en;
  const scoutLabel = locale === "he" ? SCOUT_LABEL.he : SCOUT_LABEL.en;

  const pulse = Math.min(100, Math.max(0, draft.logicalCoherenceScore));

  const rel = draft.relationshipToContext;
  const supportsLabel = locale === "he" ? BADGE_SUPPORTS.he : BADGE_SUPPORTS.en;
  const challengesLabel = locale === "he" ? BADGE_CHALLENGES.he : BADGE_CHALLENGES.en;

  const showSemanticBlock = Array.isArray(semanticDuplicates) && semanticDuplicates.length > 0;
  const semanticWarningText = locale === "he" ? SEMANTIC_WARNING.he : SEMANTIC_WARNING.en;
  const forcePlantLabel = locale === "he" ? FORCE_PLANT_CTA.he : FORCE_PLANT_CTA.en;
  const reviewLabel = locale === "he" ? REVIEW_EXISTING.he : REVIEW_EXISTING.en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-primary/30 bg-card shadow-soft-md overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {rel && (
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
        )}
        <p className="text-lg font-medium text-foreground leading-relaxed">
          {draft.assertion}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"
            aria-label={`Coherence ${pulse}`}
          >
            {pulse}/100
          </span>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {detailsOpen ? "−" : "+"} {locale === "he" ? "פרטים" : "Details"}
            </button>
          )}
        </div>
        {detailsOpen && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="space-y-3 pt-2 border-t border-border"
          >
            {draft.reasoning && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {rationaleLabel}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{draft.reasoning}</p>
              </div>
            )}
            {(draft.hiddenAssumptions?.length > 0 || draft.challengePrompt) && (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {scoutLabel}
                </p>
                {draft.hiddenAssumptions?.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-amber-900/90 dark:text-amber-100/90 mb-1">
                    {draft.hiddenAssumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                {draft.challengePrompt && (
                  <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
                    {draft.challengePrompt}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
        {showSemanticBlock ? (
          <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-3">
            <p className="text-sm text-amber-900 dark:text-amber-100 font-medium text-start">
              {semanticWarningText}
            </p>
            <ul className="space-y-2 text-start">
              {semanticDuplicates!.map((dup) => (
                <li key={dup.id}>
                  <Link
                    href={`/truth/node/${dup.id}`}
                    className="text-sm text-primary hover:underline font-medium block"
                  >
                    {dup.content.slice(0, 120)}
                    {dup.content.length > 120 ? "…" : ""}
                  </Link>
                  <span className="text-xs text-muted-foreground ms-1" title={reviewLabel}>
                    → /truth/node/{dup.id.slice(0, 8)}…
                  </span>
                </li>
              ))}
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
                {isAnchoring ? (locale === "he" ? "עוגן…" : "Anchoring…") : forcePlantLabel}
              </Button>
            )}
          </div>
        ) : (
          <Button
            type="button"
            onClick={onAnchor}
            disabled={isAnchoring}
            className="w-full sm:w-auto bg-primary text-primary-foreground shadow-soft hover:opacity-90"
          >
            {isAnchoring ? (locale === "he" ? "עוגן…" : "Anchoring…") : anchorLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
