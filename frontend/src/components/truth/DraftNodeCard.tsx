"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";
import { getDisplayAssertion } from "@/lib/utils/truthParser";
import type { MatchTruthNodeResult } from "@/types/truth";
import type { ForgeDraftBilingual } from "@/types/truth";

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

/** Bilingual Forge draft (Rosetta): display uses locale; vector uses assertionEn. */
export type ForgeDraft = ForgeDraftBilingual;

const PORTAL_EXISTING_CTA = {
  he: "👉 הטיעון קיים במארג - צלול לדיון",
  en: "This claim exists in the Weave — dive into discussion",
};

const SOVEREIGN_LOW_SCORE_WARNING = {
  he: "האורקל מצביע על פערים לוגיים מהותיים בטיוטה זו. זכותך הריבונית לעגן אותה כפי שהיא, אך מומלץ להיעזר בשאלות ההפרכה כדי ללטש אותה.",
  en: "The Oracle indicates significant logical gaps in this draft. It is your sovereign right to anchor it as is, but refining it via the challenge prompts is recommended.",
};

interface DraftNodeCardProps {
  draft: ForgeDraft;
  onAnchor: () => void;
  isAnchoring?: boolean;
  authorWallet: string;
  parentId?: string;
  relationship?: "supports" | "challenges" | "ai_analysis";
  /** When set (Epistemic Triage): this claim matches an existing node; show portal link and hide Anchor. */
  matchedExistingNodeId?: string | null;
  /** When set, anchor was blocked by semantic dedup; show warning + links and force-plant option. */
  semanticDuplicates?: MatchTruthNodeResult[] | null;
  /** Call to anchor with forceBypass (plant new seed despite similar existing nodes). */
  onForcePlant?: () => void;
  /** Backend write pipeline telemetry (anchor steps); shown in Architect mode or when present. */
  writeTelemetry?: string[] | null;
  /** When true, show write telemetry terminal even if only for dev visibility. */
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

  const assertion = (locale === "he" && (draft.assertionHe ?? "").trim()) ? (draft.assertionHe ?? "").trim() : (draft.assertionEn ?? "").trim();
  const reasoning = (locale === "he" && (draft.reasoningHe ?? "").trim()) ? (draft.reasoningHe ?? "").trim() : (draft.reasoningEn ?? "").trim();
  const hiddenAssumptions = (locale === "he" && (draft.hiddenAssumptionsHe ?? []).length > 0) ? (draft.hiddenAssumptionsHe ?? []) : (draft.hiddenAssumptionsEn ?? []);
  const challengePrompt = (locale === "he" && (draft.challengePromptHe ?? "").trim()) ? (draft.challengePromptHe ?? "").trim() : (draft.challengePromptEn ?? "").trim();
  const hasDetails = reasoning || (hiddenAssumptions?.length ?? 0) > 0 || challengePrompt;

  const anchorLabel = isMacroArena
    ? (locale === "he" ? ARENA_CTA.he : ARENA_CTA.en)
    : (locale === "he" ? ANCHOR_CTA.he : ANCHOR_CTA.en);
  const macroArenaBadgeLabel = locale === "he" ? MACRO_ARENA_BADGE.he : MACRO_ARENA_BADGE.en;
  const rationaleLabel = locale === "he" ? RATIONALE_LABEL.he : RATIONALE_LABEL.en;
  const scoutLabel = locale === "he" ? SCOUT_LABEL.he : SCOUT_LABEL.en;

  const pulse = Math.min(100, Math.max(0, draft.logicalCoherenceScore));
  const isBelowAnchoringThreshold = pulse < 40;
  const portalLabel = locale === "he" ? PORTAL_EXISTING_CTA.he : PORTAL_EXISTING_CTA.en;
  const sovereignWarningLabel = locale === "he" ? SOVEREIGN_LOW_SCORE_WARNING.he : SOVEREIGN_LOW_SCORE_WARNING.en;

  const rel = draft.relationshipToContext;
  const supportsLabel = locale === "he" ? BADGE_SUPPORTS.he : BADGE_SUPPORTS.en;
  const challengesLabel = locale === "he" ? BADGE_CHALLENGES.he : BADGE_CHALLENGES.en;

  const showSemanticBlock = resonanceBlock.isBlocked && resonanceBlock.duplicates.length > 0;
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
        <p className="text-lg font-medium text-foreground leading-relaxed">
          {assertion}
        </p>
        <div className="flex items-center gap-2">
          {!isMacroArena && (
            <span
              className="font-mono text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"
              aria-label={`Coherence ${pulse}`}
            >
              {pulse}/100
            </span>
          )}
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
            {reasoning && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {rationaleLabel}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{reasoning}</p>
              </div>
            )}
            {(hiddenAssumptions?.length > 0 || challengePrompt) && (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {scoutLabel}
                </p>
                {hiddenAssumptions?.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-amber-900/90 dark:text-amber-100/90 mb-1">
                    {hiddenAssumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
                {challengePrompt && (
                  <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
                    {challengePrompt}
                  </p>
                )}
              </div>
            )}
          </motion.div>
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
                const display = getDisplayAssertion(dup.content, locale);
                return (
                <li key={dup.id}>
                  <Link
                    href={`/truth/node/${dup.id}`}
                    className="text-sm text-primary hover:underline font-medium block"
                  >
                    {display.slice(0, 120)}
                    {display.length > 120 ? "…" : ""}
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
                {isAnchoring ? (locale === "he" ? "עוגן…" : "Anchoring…") : forcePlantLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isBelowAnchoringThreshold && (
              <div
                className="rounded-lg border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2.5 text-start"
                role="status"
              >
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {sovereignWarningLabel}
                </p>
              </div>
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
        )}
        {Array.isArray(writeTelemetry) && writeTelemetry.length > 0 && (isArchitectMode || writeTelemetry.some((l) => l.startsWith("[CRITICAL]"))) && (
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTelemetryOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/90 text-zinc-400 font-mono text-xs text-start hover:bg-zinc-800/90"
              aria-expanded={telemetryOpen}
            >
              <span className="text-emerald-400/90 font-semibold">
                [Write Telemetry] {writeTelemetry.length} line(s)
              </span>
              <span aria-hidden>{telemetryOpen ? "−" : "+"}</span>
            </button>
            {telemetryOpen && (
              <pre
                className="p-3 bg-black text-emerald-400 font-mono text-xs leading-relaxed overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words"
                role="log"
                aria-label="Backend anchor pipeline telemetry"
              >
                {writeTelemetry.map((line, i) => (
                  <span key={i} className={line.startsWith("[CRITICAL]") ? "text-red-400" : undefined}>
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
