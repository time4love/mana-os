"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ExtractedClaim } from "@/types/truth";
import { EpistemicStateBadge } from "@/components/truth/EpistemicStateBadge";

const REASONING_LABEL = { he: "נימוק", en: "Rationale" };
const ASSUMPTIONS_LABEL = { he: "הנחות מובלעות", en: "Hidden assumptions" };
const CHALLENGE_LABEL = { he: "אתגר לקהילה", en: "Challenge for the community" };

interface ClaimEvaluationCardProps {
  claim: ExtractedClaim;
  index: number;
  locale: "he" | "en";
}

export function ClaimEvaluationCard({
  claim,
  index,
  locale,
}: ClaimEvaluationCardProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const t = locale === "he" ? "he" : "en";
  const reasoningLabel = t === "he" ? REASONING_LABEL.he : REASONING_LABEL.en;
  const assumptionsLabel = t === "he" ? ASSUMPTIONS_LABEL.he : ASSUMPTIONS_LABEL.en;
  const challengeLabel = t === "he" ? CHALLENGE_LABEL.he : CHALLENGE_LABEL.en;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="list-none"
    >
      <Card className="overflow-hidden border border-border bg-card/95 shadow-soft-md">
        <CardContent className="p-4 space-y-4">
          {/* The Claim */}
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {claim.assertion}
          </p>

          <EpistemicStateBadge state="SOLID" locale={locale} />

          {/* Accordion: Rationale (Logician reasoning) */}
          <div>
            <button
              type="button"
              onClick={() => setRationaleOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-start text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-expanded={rationaleOpen}
            >
              <span>{reasoningLabel}</span>
              {rationaleOpen ? (
                <ChevronUp className="size-4 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              )}
            </button>
            <AnimatePresence initial={false}>
              {rationaleOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="pt-2 text-xs text-foreground leading-relaxed border-t border-border/60 mt-1">
                    {claim.reasoning}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Warning area: hidden assumptions + challenge prompt */}
          {(claim.hiddenAssumptions.length > 0 || claim.challengePrompt) && (
            <div
              className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/50 px-3 py-2.5 space-y-2"
              role="region"
              aria-label={assumptionsLabel}
            >
              {claim.hiddenAssumptions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                    {assumptionsLabel}
                  </p>
                  <ul className="list-disc list-inside text-xs text-amber-900/90 dark:text-amber-100/90 space-y-0.5">
                    {claim.hiddenAssumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {claim.challengePrompt && (
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-0.5">
                    {challengeLabel}
                  </p>
                  <p className="text-xs text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
                    {claim.challengePrompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.li>
  );
}
