"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { getRelativeHarmonicTime } from "@/lib/utils/harmonicTime";
import { getSeedDiscourse, shareSeedWisdom } from "@/app/actions/upgrades";
import { ORACLE_SEED_AUTHOR } from "@/lib/oracle/constants";
import type { ProposalUpgradeRow, SeedDiscourseRow } from "@/lib/supabase/types";
import { ChevronDown, ChevronUp, Radio } from "lucide-react";

const transition = { duration: 0.3, ease: [0.32, 0.72, 0, 1] };

export interface UpgradeSeedCardProps {
  upgrade: ProposalUpgradeRow;
  index: number;
  hasResonated: boolean;
  canResonate: boolean;
  onResonate: () => void;
  resonanceCountLabel: string;
  resonateLabel: string;
  alreadyResonatedLabel: string;
  needSbtLabel?: string;
  shareWisdomPlaceholder: string;
  /** When the seed is from the Village Elder (ORACLE), show this label instead of a wallet. E.g. "🌱 Oracle Insight" / "🌱 חוכמת זקן הכפר" */
  oracleSeedAuthorLabel?: string;
  locale: "he" | "en";
  onDiscourseUpdated?: () => void;
}

export function UpgradeSeedCard({
  upgrade,
  index,
  hasResonated,
  canResonate,
  onResonate,
  resonanceCountLabel,
  resonateLabel,
  alreadyResonatedLabel,
  needSbtLabel,
  shareWisdomPlaceholder,
  oracleSeedAuthorLabel,
  locale,
  onDiscourseUpdated,
}: UpgradeSeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isOracleSeed = upgrade.author_wallet === ORACLE_SEED_AUTHOR;
  const cardClassName = isOracleSeed
    ? "overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-soft dark:border-emerald-400/25 dark:bg-emerald-950/30"
    : "overflow-hidden rounded-xl border border-amber-200/50 bg-amber-50/80 shadow-soft dark:border-amber-800/30 dark:bg-amber-950/25";
  const borderExpandClassName = isOracleSeed
    ? "border-t border-emerald-500/30 bg-muted/30 dark:border-emerald-400/25 dark:bg-muted/20"
    : "border-t border-amber-200/50 bg-muted/30 dark:border-amber-800/30 dark:bg-muted/20";
  const [discourse, setDiscourse] = useState<SeedDiscourseRow[]>([]);
  const [wisdomInput, setWisdomInput] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const { address } = useAccount();

  const loadDiscourse = useCallback(() => {
    if (!isExpanded) return;
    getSeedDiscourse(upgrade.id).then((result) => {
      if (result.success) setDiscourse(result.discourse);
    });
  }, [upgrade.id, isExpanded]);

  useEffect(() => {
    loadDiscourse();
  }, [loadDiscourse]);

  async function handleShareWisdom() {
    const trimmed = wisdomInput.trim();
    if (!trimmed || sharing || !address) return;
    setShareError(null);
    setSharing(true);
    const result = await shareSeedWisdom(upgrade.id, address, trimmed);
    setSharing(false);
    if (result.success) {
      setWisdomInput("");
      loadDiscourse();
      onDiscourseUpdated?.();
    } else setShareError(result.error);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.05, ...transition }}
      className={cardClassName}
    >
      {/* Top level: suggestion (clickable to expand) + resonance + Resonate button + expand trigger */}
      <div className="px-4 py-3">
        {isOracleSeed && oracleSeedAuthorLabel && (
          <p className="mb-1.5 text-xs font-medium text-emerald-700/90 dark:text-emerald-300/90" aria-label="Author">
            {oracleSeedAuthorLabel}
          </p>
        )}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full touch-manipulation text-start text-sm text-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse discussion" : "Expand discussion"}
        >
          {upgrade.suggested_upgrade}
        </button>
        <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {upgrade.resonance_count} {resonanceCountLabel}
          </span>
          <div className="flex items-center gap-2">
            {hasResonated ? (
              <span className="text-xs italic text-muted-foreground">
                {alreadyResonatedLabel}
              </span>
            ) : address && !canResonate && needSbtLabel ? (
              <span className="text-xs text-muted-foreground">
                {needSbtLabel}
              </span>
            ) : canResonate ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResonate();
                }}
                className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary/80 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:text-primary"
                aria-label={resonateLabel}
              >
                <Radio className="size-3.5 shrink-0" aria-hidden />
                <span>{resonateLabel}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((prev) => !prev);
              }}
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition hover:bg-amber-100/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-900/20"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse discussion" : "Expand discussion"}
            >
              {isExpanded ? (
                <ChevronUp className="size-4" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Micro-Circle: flat discourse + share wisdom input */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className={borderExpandClassName}
          >
            <div className="px-4 py-3">
              {discourse.length > 0 && (
                <ul className="space-y-2 pb-3" role="list">
                  {discourse.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg bg-background/60 px-3 py-2 text-sm text-foreground shadow-soft"
                    >
                      <p>{item.wisdom}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getRelativeHarmonicTime(new Date(item.created_at), locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {address && (
                <div className="flex flex-col gap-2">
                  <label htmlFor={`seed-wisdom-${upgrade.id}`} className="sr-only">
                    {shareWisdomPlaceholder}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`seed-wisdom-${upgrade.id}`}
                      type="text"
                      value={wisdomInput}
                      onChange={(e) => setWisdomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleShareWisdom();
                        }
                      }}
                      placeholder={shareWisdomPlaceholder}
                      className="flex-1 rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      disabled={sharing}
                      aria-describedby={shareError ? `seed-wisdom-error-${upgrade.id}` : undefined}
                    />
                    <button
                      type="button"
                      onClick={handleShareWisdom}
                      disabled={!wisdomInput.trim() || sharing}
                      className="rounded-lg border border-primary/60 bg-transparent px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {sharing ? (locale === "he" ? "שיתוף…" : "Sharing…") : (locale === "he" ? "שתף" : "Share")}
                    </button>
                  </div>
                  {shareError && (
                    <p
                      id={`seed-wisdom-error-${upgrade.id}`}
                      className="text-xs text-red-500"
                      role="alert"
                    >
                      {shareError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
