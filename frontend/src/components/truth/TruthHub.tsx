"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { TruthWeaverInput } from "@/components/truth/TruthWeaverInput";
import { parseNodeContent, truncateAssertion } from "@/lib/utils/truthParser";
import type { MacroRootWithMeta } from "@/types/truth";

const TRANSITION = { duration: 0.4, ease: [0.32, 0.72, 0, 1] };
const STAGGER = 0.08;

const TITLE = {
  he: "מנוע האמת הפרקטלי",
  en: "The Fractal Truth Engine",
};

const SUBTITLE = {
  he: "היכנסו למרחב הגיון אפיסטמי ללא שיפוט, ללא צנזורה וללא 'פנייה לסמכות'. מהי אמת היסוד שתרצו לנעוץ במארג?",
  en: "Enter a space of epistemic logic—free from judgment, censorship, and the appeal to authority. What foundational premise do you wish to anchor?",
};

const CONNECT_PROMPT = {
  he: "חבר ארנק כדי לעגן טיעונים למארג האמת.",
  en: "Connect your wallet to anchor arguments to the Truth graph.",
};

const PORTALS_HEADING = {
  he: "שערים למארג האמת",
  en: "Portals to The Truth Weave",
};

const READ_PREMISE = {
  he: "היכנס להתבוננות",
  en: "Read premise",
};

const DISMANTLED_CLAIMS = {
  he: (n: number) => `פורק ל־${n} טענות`,
  en: (n: number) => `Dismantled to ${n} claims`,
};

const SEARCH_PLACEHOLDER = {
  he: "שאל את המארג הסמנטי…",
  en: "Ask the Semantic Weave…",
};

const TAB_RECENT = {
  he: "אדוות אחרונות",
  en: "Recent Horizons",
};

const TAB_FIRES = {
  he: "במוקד",
  en: "Epistemic Fires",
};

const HUB_ASSERTION_MAX_LEN = 180;

type TabId = "recent" | "fires";

interface TruthHubProps {
  macroRoots: MacroRootWithMeta[];
}

export function TruthHub({ macroRoots }: TruthHubProps) {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<TabId>("recent");
  const [searchQuery, setSearchQuery] = useState("");

  const title = locale === "he" ? TITLE.he : TITLE.en;
  const subtitle = locale === "he" ? SUBTITLE.he : SUBTITLE.en;
  const connectPrompt = locale === "he" ? CONNECT_PROMPT.he : CONNECT_PROMPT.en;
  const portalsHeading = locale === "he" ? PORTALS_HEADING.he : PORTALS_HEADING.en;
  const readPremise = locale === "he" ? READ_PREMISE.he : READ_PREMISE.en;
  const searchPlaceholder = locale === "he" ? SEARCH_PLACEHOLDER.he : SEARCH_PLACEHOLDER.en;
  const tabRecent = locale === "he" ? TAB_RECENT.he : TAB_RECENT.en;
  const tabFires = locale === "he" ? TAB_FIRES.he : TAB_FIRES.en;

  const sortedRoots = useMemo(() => {
    const list = [...macroRoots];
    if (activeTab === "recent") {
      list.sort((a, b) => new Date(b.node.created_at).getTime() - new Date(a.node.created_at).getTime());
    } else {
      list.sort((a, b) => b.claimsCount - a.claimsCount);
    }
    return list;
  }, [macroRoots, activeTab]);

  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) return sortedRoots;
    const q = searchQuery.trim().toLowerCase();
    return sortedRoots.filter(({ node }) => node.content.toLowerCase().includes(q));
  }, [sortedRoots, searchQuery]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="min-h-[calc(100vh-3.5rem)] px-4 py-12 sm:px-8 sm:py-16 md:px-12"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-12">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TRANSITION, delay: STAGGER }}
          className="text-center space-y-6"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] leading-tight">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </motion.header>

        {/* Epistemic Corridor: soft floating search */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...TRANSITION, delay: STAGGER * 1.5 }}
          className="w-full"
          aria-label="Search the weave"
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-border bg-card/80 px-4 py-3 text-foreground placeholder:text-muted-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={searchPlaceholder}
          />
        </motion.section>

        {address ? (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...TRANSITION, delay: STAGGER * 2 }}
            className="flex flex-col items-center"
          >
            <div className="w-full max-w-2xl">
              <TruthWeaverInput
                authorWallet={address}
                onAnchored={() => {}}
                onEdgeAttached={() => {}}
              />
            </div>
          </motion.section>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...TRANSITION, delay: STAGGER * 2 }}
            className="text-center text-muted-foreground text-base sm:text-lg"
          >
            {connectPrompt}
          </motion.p>
        )}

        {/* Portals: macro roots only */}
        {macroRoots.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...TRANSITION, delay: STAGGER * 3 }}
            className="space-y-6"
            aria-labelledby="portals-heading"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2
                id="portals-heading"
                className="text-lg font-medium text-foreground"
              >
                {portalsHeading}
              </h2>
              {/* Filter tabs */}
              <div
                className="flex rounded-lg border border-border bg-card/60 p-1 shadow-soft"
                role="tablist"
                aria-label="View mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "recent"}
                  onClick={() => setActiveTab("recent")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "recent"
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tabRecent}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "fires"}
                  onClick={() => setActiveTab("fires")}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "fires"
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tabFires}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRoots.map(({ node, claimsCount }, idx) => {
                const parsed = parseNodeContent(node.content);
                return (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: STAGGER * (idx % 6) }}
                  >
                    <Link
                      href={`/truth/node/${node.id}`}
                      className="group block rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                      title={readPremise}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground leading-relaxed line-clamp-4 flex-1 min-w-0">
                          {truncateAssertion(parsed.assertion, HUB_ASSERTION_MAX_LEN)}
                        </p>
                        {parsed.pulse != null && (
                          <span
                            className="shrink-0 font-mono text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"
                            aria-label={`Coherence ${parsed.pulse}`}
                          >
                            {parsed.pulse}
                          </span>
                        )}
                      </div>
                      {claimsCount > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {locale === "he" ? DISMANTLED_CLAIMS.he(claimsCount) : DISMANTLED_CLAIMS.en(claimsCount)}
                        </p>
                      )}
                      <span className="mt-3 inline-block text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        {readPremise}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {filteredRoots.length === 0 && searchQuery.trim() && (
              <p className="text-center text-sm text-muted-foreground">
                {isRtl ? "אין תוצאות למארג." : "No matches in the weave."}
              </p>
            )}
          </motion.section>
        )}
      </div>
    </motion.main>
  );
}
