"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Scale, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent, truncateAssertion } from "@/lib/utils/truthParser";
import type { MacroRootWithMeta } from "@/types/truth";

const ENTER_ARENA = {
  he: "היכנסו לזירה",
  en: "Enter Arena",
};

const ARENA_BASELINE = {
  he: "קו בסיס זירה",
  en: "Arena Baseline",
};

const SUB_CLAIMS = {
  he: (n: number) => `${n} תת־טענות`,
  en: (n: number) => `${n} sub-claims`,
};

const TITLE_MAX_LEN = 120;

interface ArenaCardProps {
  arena: MacroRootWithMeta;
  index?: number;
}

export function ArenaCard({ arena, index = 0 }: ArenaCardProps) {
  const { locale } = useLocale();
  const { node, claimsCount } = arena;
  const parsed = parseNodeContent(node.content, locale);
  const title = truncateAssertion(parsed.assertion, TITLE_MAX_LEN);
  const baseline = parsed.pulse ?? null;
  const tags =
    node.thematic_tags?.filter((t): t is string => typeof t === "string" && t.trim().length > 0) ??
    [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Link
        href={`/truth/node/${node.id}`}
        className="group block h-full rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:border-primary/30 hover:shadow-soft-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2"
        title={locale === "he" ? ENTER_ARENA.he : ENTER_ARENA.en}
      >
        {/* Thematic tags */}
        {tags.length > 0 && (
          <div
            className="mb-3 flex flex-wrap gap-1.5"
            aria-label="Thematic constellation"
          >
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Debate title */}
        <h3 className="text-base font-medium leading-snug text-foreground line-clamp-3">
          {title}
        </h3>

        {/* Arena Baseline (Logical Coherence Score) */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {baseline != null && (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
              aria-label={locale === "he" ? ARENA_BASELINE.he : ARENA_BASELINE.en}
            >
              <Scale className="size-3.5 shrink-0" aria-hidden />
              {baseline}/100
            </span>
          )}
          {claimsCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {locale === "he" ? SUB_CLAIMS.he(claimsCount) : SUB_CLAIMS.en(claimsCount)}
            </span>
          )}
        </div>

        {/* Enter CTA */}
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          {locale === "he" ? ENTER_ARENA.he : ENTER_ARENA.en}
          <ChevronRight
            className="size-3.5 shrink-0 rtl:rotate-180"
            aria-hidden
          />
        </span>
      </Link>
    </motion.article>
  );
}
