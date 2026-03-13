"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ArrowUp, PlusCircle } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { parseNodeContent, truncateAssertion } from "@/lib/utils/truthParser";
import { Button } from "@/components/ui/button";
import type { TruthNodeWithRelations, TruthNode } from "@/types/truth";

const FORGE_ENTRY = {
  he: "הוסף אתגר או תמיכה",
  en: "Add a challenge or support",
};

const STORAGE_KEY = "truthForgeContext";

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

function FocalPivot({ content }: { content: string }) {
  const parsed = parseNodeContent(content);
  const hasPulse = parsed.pulse != null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-xl border-2 border-primary/40 bg-primary/5 shadow-soft-md p-6 sm:p-8 space-y-5"
    >
      <div className="rounded-lg border border-primary/20 bg-background/80 p-5 sm:p-6 space-y-5">
        <p className="text-lg sm:text-xl text-foreground leading-relaxed font-medium">
          {parsed.assertion}
        </p>
        {hasPulse && (
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

interface TruthNodeViewportProps {
  data: TruthNodeWithRelations;
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
  const parsed = parseNodeContent(node.content);
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

export function TruthNodeViewport({ data }: TruthNodeViewportProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const isRtl = locale === "he";
  const { node, childrenByRelationship, parents } = data;
  const firstParent = parents[0] ?? null;
  const focalAssertion = parseNodeContent(node.content).assertion || node.content.slice(0, 500);

  function openForgeWithContext() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ parentId: node.id, targetNodeContext: focalAssertion })
      );
    } catch {
      // ignore
    }
    router.push("/truth");
  }

  const hasChildren =
    childrenByRelationship.supports.length > 0 ||
    childrenByRelationship.challenges.length > 0 ||
    childrenByRelationship.ai_analysis.length > 0;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 md:px-8"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header: breadcrumb / parent */}
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
          <Link
            href="/truth"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "he" ? BACK_TO_ENGINE.he : BACK_TO_ENGINE.en}
          </Link>
          {firstParent && (
            <>
              <span className="text-muted-foreground/70" aria-hidden>
                <ChevronRight className={`inline size-4 ${isRtl ? "rotate-180" : ""}`} />
              </span>
              <Link
                href={`/truth/node/${firstParent.id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ArrowUp className={`size-4 ${isRtl ? "rotate-90" : "-rotate-90"}`} aria-hidden />
                {locale === "he" ? BREADCRUMB.he : BREADCRUMB.en}
              </Link>
            </>
          )}
        </nav>

        {/* Core pivot: central node — parsed assertion, pulse bar, rationale, scout */}
        <FocalPivot content={node.content} />

        {/* Epistemic Forge entry: add challenge or support (navigate to hub with context) */}
        <motion.section
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-card/60 p-4 shadow-soft"
        >
          <Button
            type="button"
            variant="outline"
            onClick={openForgeWithContext}
            className="w-full sm:w-auto border-primary/40 text-primary hover:bg-primary/10"
          >
            <PlusCircle className="size-4 me-2 shrink-0" aria-hidden />
            {locale === "he" ? FORGE_ENTRY.he : FORGE_ENTRY.en}
          </Button>
        </motion.section>

        {/* Categorical horizons: pillars & frictions */}
        {hasChildren && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid gap-8 sm:grid-cols-1 md:grid-cols-3"
          >
            {/* Supporting Formations */}
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

            {/* Direct Challenges */}
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

            {/* Logical Observations / AI */}
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
    </motion.main>
  );
}
