"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";

const ANCHOR_CTA = {
  he: "עגן טיעון למארג",
  en: "Anchor Premise to Weave",
};

const RATIONALE_LABEL = { he: "נימוק", en: "Rationale" };
const SCOUT_LABEL = { he: "הנחות ואתגר פיספיקציה", en: "Hidden assumptions & falsification" };

export interface ForgeDraft {
  assertion: string;
  logicalCoherenceScore: number;
  reasoning: string;
  hiddenAssumptions: string[];
  challengePrompt: string;
}

interface DraftNodeCardProps {
  draft: ForgeDraft;
  onAnchor: () => void;
  isAnchoring?: boolean;
  authorWallet: string;
  parentId?: string;
  relationship?: "supports" | "challenges" | "ai_analysis";
}

export function DraftNodeCard({
  draft,
  onAnchor,
  isAnchoring = false,
}: DraftNodeCardProps) {
  const { locale } = useLocale();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasDetails = draft.reasoning || draft.hiddenAssumptions?.length > 0 || draft.challengePrompt;

  const anchorLabel = locale === "he" ? ANCHOR_CTA.he : ANCHOR_CTA.en;
  const rationaleLabel = locale === "he" ? RATIONALE_LABEL.he : RATIONALE_LABEL.en;
  const scoutLabel = locale === "he" ? SCOUT_LABEL.he : SCOUT_LABEL.en;

  const pulse = Math.min(100, Math.max(0, draft.logicalCoherenceScore));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-primary/30 bg-card shadow-soft-md overflow-hidden"
    >
      <div className="p-5 space-y-4">
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
        <Button
          type="button"
          onClick={onAnchor}
          disabled={isAnchoring}
          className="w-full sm:w-auto bg-primary text-primary-foreground shadow-soft hover:opacity-90"
        >
          {isAnchoring ? (locale === "he" ? "עוגן…" : "Anchoring…") : anchorLabel}
        </Button>
      </div>
    </motion.div>
  );
}
