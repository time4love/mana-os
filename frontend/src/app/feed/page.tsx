"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { getProposalsForFeed } from "@/app/actions/proposals";
import type { ProposalRow } from "@/lib/supabase/types";
import { LivingProposal } from "@/components/proposals/LivingProposal";
import { CodexSheet } from "@/components/ui/CodexSheet";

const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };

export default function FeedPage() {
  const { locale, tProposals } = useLocale();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [codexProposal, setCodexProposal] = useState<ProposalRow | null>(null);
  /** When Codex closes, trigger the proposal that was open to refetch upgrades (e.g. after Oracle plants a seed). */
  const [upgradeRefreshTrigger, setUpgradeRefreshTrigger] = useState<{ proposalId: string; at: number } | null>(null);
  const isRtl = locale === "he";

  const handleConsultOracle = useCallback((proposal: ProposalRow) => {
    setCodexProposal(proposal);
    setCodexOpen(true);
    setUpgradeRefreshTrigger(null);
  }, []);

  const handleCodexOpenChange = useCallback((open: boolean) => {
    if (!open && codexProposal) {
      setUpgradeRefreshTrigger({ proposalId: codexProposal.id, at: Date.now() });
    }
    setCodexOpen(open);
    if (!open) setCodexProposal(null);
  }, [codexProposal]);

  const loadProposals = useCallback(() => {
    getProposalsForFeed().then((result) => {
      if (result.success) setProposals(result.proposals);
      else setError(result.error ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getProposalsForFeed().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) setProposals(result.proposals);
      else setError(result.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      className="min-h-[calc(100vh-3.5rem)] px-4 py-8 sm:px-6 sm:py-10"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-2xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {tProposals("feedTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {locale === "he"
              ? "הצעות ממתינות להדהוד הקהילה"
              : "Proposals awaiting community resonance"}
          </p>
        </motion.header>

        {loading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground"
          >
            …
          </motion.p>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-red-500"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        {!loading && !error && proposals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="rounded-2xl border border-border/60 bg-card/60 px-6 py-12 text-center shadow-soft"
          >
            <p className="text-muted-foreground">{tProposals("feedEmpty")}</p>
          </motion.div>
        )}

        {!loading && !error && proposals.length > 0 && (
          <ul className="space-y-4">
            {proposals.map((proposal, index) => (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.35, ease: [0.32, 0.72, 0, 1] as const }}
              >
                <LivingProposal
                  proposal={proposal}
                  onResonated={loadProposals}
                  onConsultOracle={handleConsultOracle}
                  upgradeRefreshTrigger={
                    upgradeRefreshTrigger?.proposalId === proposal.id ? upgradeRefreshTrigger.at : undefined
                  }
                />
              </motion.div>
            ))}
          </ul>
        )}
      </div>

      <CodexSheet
        open={codexOpen}
        onOpenChange={handleCodexOpenChange}
        mode="proposal"
        contextData={
          codexProposal
            ? {
                proposal: {
                  id: codexProposal.id,
                  title: codexProposal.title,
                  description: codexProposal.description,
                  resource_plan: codexProposal.resource_plan,
                  oracle_insight: codexProposal.oracle_insight ?? undefined,
                },
              }
            : undefined
        }
      />
    </main>
  );
}
