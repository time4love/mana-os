"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { getRelativeHarmonicTime } from "@/lib/utils/harmonicTime";
import {
  PROPOSALS_DAO_ABI,
  PROPOSALS_DAO_ADDRESS,
} from "@/contracts/proposalsDao";
import type { ProposalRow, ProposalUpgradeRow } from "@/lib/supabase/types";
import type { ProposalResourcePlanJson } from "@/lib/supabase/types";
import { syncProposalStatusToApproved } from "@/app/actions/proposals";
import {
  getUpgradesForProposal,
  getUpgradeResonanceByWallet,
  plantUpgradeSeed,
  resonateWithUpgrade,
} from "@/app/actions/upgrades";
import { Leaf, Sparkles, Radio } from "lucide-react";

const RESONANCE_THRESHOLD = 3;
const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] };

interface LivingProposalProps {
  proposal: ProposalRow;
  onResonated?: () => void;
}

function ResourcePlanSection({
  plan,
  naturalResourcesLabel,
  humanCapitalLabel,
  manaCyclesUnit,
}: {
  plan: ProposalResourcePlanJson;
  naturalResourcesLabel: string;
  humanCapitalLabel: string;
  manaCyclesUnit: string;
}) {
  const naturalResources = plan?.naturalResources ?? [];
  const humanCapital = plan?.humanCapital ?? [];
  if (naturalResources.length === 0 && humanCapital.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
      {naturalResources.length > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {naturalResourcesLabel}
          </h3>
          <ul className="mt-1 list-none space-y-1 text-sm text-foreground">
            {naturalResources.map((r, i) => (
              <li key={i}>
                {r.resourceName}: {r.quantity} {r.unit}
              </li>
            ))}
          </ul>
        </section>
      )}
      {humanCapital.length > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {humanCapitalLabel}
          </h3>
          <ul className="mt-1 list-none space-y-1 text-sm text-foreground">
            {humanCapital.map((h, i) => (
              <li key={i}>
                {h.requiredSkillCategory} (Level {h.requiredLevel}): {h.manaCycles}{" "}
                {manaCyclesUnit}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function LivingProposal({ proposal, onResonated }: LivingProposalProps) {
  const { locale, tProposals } = useLocale();
  const { address } = useAccount();
  const [upgrades, setUpgrades] = useState<ProposalUpgradeRow[]>([]);
  const [resonatedUpgradeIds, setResonatedUpgradeIds] = useState<Set<string>>(new Set());
  const [seedInput, setSeedInput] = useState("");
  const [planting, setPlanting] = useState(false);
  const [plantError, setPlantError] = useState<string | null>(null);

  const mergedUpgrades = upgrades.filter((u) => u.status === "merged");
  const pendingUpgrades = upgrades.filter((u) => u.status === "pending");

  const loadUpgrades = useCallback(() => {
    getUpgradesForProposal(proposal.id).then((result) => {
      if (result.success) setUpgrades(result.upgrades);
    });
  }, [proposal.id]);

  useEffect(() => {
    loadUpgrades();
  }, [loadUpgrades]);

  useEffect(() => {
    if (!address || pendingUpgrades.length === 0) return;
    const ids = pendingUpgrades.map((u) => u.id);
    getUpgradeResonanceByWallet(ids, address).then((result) => {
      if (result.success)
        setResonatedUpgradeIds(new Set(result.resonatedUpgradeIds));
    });
  }, [address, pendingUpgrades.map((u) => u.id).join(",")]);

  const { data: resonanceRaw, refetch: refetchResonance } = useReadContract({
    address: PROPOSALS_DAO_ADDRESS,
    abi: PROPOSALS_DAO_ABI,
    functionName: "proposalResonance",
    args: [proposal.id],
  });

  const { data: hasResonatedRaw } = useReadContract({
    address: PROPOSALS_DAO_ADDRESS,
    abi: PROPOSALS_DAO_ABI,
    functionName: "hasResonated",
    args: address ? [proposal.id, address] : undefined,
  });

  const {
    writeContract,
    isPending: isResonating,
    error: writeError,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        refetchResonance();
        onResonated?.();
      },
    },
  });

  const resonance = typeof resonanceRaw === "bigint" ? Number(resonanceRaw) : 0;
  const hasResonated = Boolean(hasResonatedRaw);
  const isSprouted = resonance >= RESONANCE_THRESHOLD;
  const progress = Math.min(1, resonance / RESONANCE_THRESHOLD);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!isSprouted || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    syncProposalStatusToApproved(proposal.id).then((result) => {
      if (result.success && result.updated) onResonated?.();
    });
  }, [isSprouted, proposal.id, onResonated]);

  const canResonate =
    address &&
    !hasResonated &&
    !isSprouted &&
    PROPOSALS_DAO_ADDRESS !== "0x0000000000000000000000000000000000000000";

  function handleResonateWithProposal() {
    if (!canResonate || isResonating) return;
    writeContract({
      address: PROPOSALS_DAO_ADDRESS,
      abi: PROPOSALS_DAO_ABI,
      functionName: "resonate",
      args: [proposal.id],
    });
  }

  async function handleResonateWithUpgrade(upgradeId: string) {
    if (!address) return;
    setPlantError(null);
    const result = await resonateWithUpgrade(upgradeId, address);
    if (result.success) {
      setResonatedUpgradeIds((prev) => new Set(prev).add(upgradeId));
      loadUpgrades();
      onResonated?.();
    } else setPlantError(result.error);
  }

  async function handlePlantSeed() {
    const trimmed = seedInput.trim();
    if (!trimmed || !address || planting) return;
    setPlantError(null);
    setPlanting(true);
    const result = await plantUpgradeSeed(proposal.id, address, trimmed);
    setPlanting(false);
    if (result.success) {
      setSeedInput("");
      loadUpgrades();
      onResonated?.();
    } else setPlantError(result.error);
  }

  return (
    <motion.li
      layout
      className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/30 hover:shadow-soft-md"
    >
      <div className="flex flex-col gap-4">
        {/* Core: title + description + resource plan */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-medium text-foreground">{proposal.title}</h2>
          {isSprouted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Leaf className="size-3.5" aria-hidden />
              {tProposals("sproutedLabel")}
            </span>
          )}
        </div>
        {proposal.description && (
          <p className="text-sm text-muted-foreground">{proposal.description}</p>
        )}

        <ResourcePlanSection
          plan={proposal.resource_plan}
          naturalResourcesLabel={tProposals("naturalResources")}
          humanCapitalLabel={tProposals("humanCapital")}
          manaCyclesUnit={tProposals("manaCyclesUnit")}
        />

        {/* Community Wisdom: merged upgrades as golden text */}
        {mergedUpgrades.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="rounded-xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/30 p-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <Sparkles className="size-3.5" aria-hidden />
              {tProposals("communityWisdom")}
            </h3>
            <AnimatePresence mode="popLayout">
              {mergedUpgrades.map((upgrade, i) => (
                <motion.p
                  key={upgrade.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.08, ...transition }}
                  className="text-sm text-amber-800 dark:text-amber-300 [&+&]:mt-2"
                >
                  {upgrade.suggested_upgrade}
                </motion.p>
              ))}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Pending Upgrade Seeds: floating cards with Resonate */}
        {pendingUpgrades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {pendingUpgrades.map((upgrade, i) => (
                <PendingSeedCard
                  key={upgrade.id}
                  upgrade={upgrade}
                  index={i}
                  hasResonated={resonatedUpgradeIds.has(upgrade.id)}
                  canResonate={Boolean(address)}
                  onResonate={() => handleResonateWithUpgrade(upgrade.id)}
                  resonanceCountLabel={tProposals("resonanceCount")}
                  resonateLabel={tProposals("resonateWithUpgrade")}
                  alreadyResonatedLabel={tProposals("alreadyResonatedWithUpgrade")}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Main proposal: Resonate CTA first (prominent), then progress bar */}
        {!isSprouted && (
          <div className="mt-2 space-y-3">
            {hasResonated ? (
              <p className="text-sm text-muted-foreground italic">
                {tProposals("alreadyResonated")}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleResonateWithProposal}
                  disabled={!canResonate || isResonating}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResonating
                    ? (locale === "he" ? "מהדהד…" : "Resonating…")
                    : tProposals("resonateWithVision")}
                </button>
                {writeError && (
                  <p className="text-xs text-red-500" role="alert">
                    {writeError.message?.includes("NoSBT")
                      ? tProposals("needSbtToResonate")
                      : writeError.message}
                  </p>
                )}
                {address &&
                  PROPOSALS_DAO_ADDRESS === "0x0000000000000000000000000000000000000000" && (
                    <p className="text-sm text-muted-foreground">
                      {tProposals("needSbtToResonate")}
                    </p>
                  )}
              </>
            )}
          </div>
        )}

        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{tProposals("resonanceCount")}: {resonance}</span>
            {!isSprouted && (
              <span>
                {resonance}/{RESONANCE_THRESHOLD}
              </span>
            )}
          </div>
          <div
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={resonance}
            aria-valuemin={0}
            aria-valuemax={RESONANCE_THRESHOLD}
            aria-label={`Resonance ${resonance} of ${RESONANCE_THRESHOLD}`}
          >
            <motion.div
              className="h-full rounded-full bg-primary/80 shadow-[0_0_12px_rgba(34,197,94,0.5)]"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>
        </div>

        {/* Plant an Upgrade Seed */}
        {address && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
            className="mt-2 flex flex-col gap-2"
          >
            <label htmlFor={`plant-seed-${proposal.id}`} className="sr-only">
              {tProposals("plantUpgradeSeedPlaceholder")}
            </label>
            <div className="flex gap-2">
              <input
                id={`plant-seed-${proposal.id}`}
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePlantSeed();
                  }
                }}
                placeholder={tProposals("plantUpgradeSeedPlaceholder")}
                className="flex-1 rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={planting}
                aria-describedby={plantError ? `plant-error-${proposal.id}` : undefined}
              />
              <button
                type="button"
                onClick={handlePlantSeed}
                disabled={!seedInput.trim() || planting}
                className="rounded-xl border border-primary/60 bg-transparent px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {planting ? (locale === "he" ? "נוטע…" : "Planting…") : (locale === "he" ? "נטע" : "Plant")}
              </button>
            </div>
            {plantError && (
              <p id={`plant-error-${proposal.id}`} className="text-xs text-red-500" role="alert">
                {plantError}
              </p>
            )}
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground">
          {getRelativeHarmonicTime(new Date(proposal.created_at), locale)}
        </p>
      </div>
    </motion.li>
  );
}

function PendingSeedCard({
  upgrade,
  index,
  hasResonated,
  canResonate,
  onResonate,
  resonanceCountLabel,
  resonateLabel,
  alreadyResonatedLabel,
}: {
  upgrade: ProposalUpgradeRow;
  index: number;
  hasResonated: boolean;
  canResonate: boolean;
  onResonate: () => void;
  resonanceCountLabel: string;
  resonateLabel: string;
  alreadyResonatedLabel: string;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.05, ...transition }}
      className="rounded-xl border border-amber-200/50 bg-amber-50/80 px-4 py-3 shadow-soft dark:border-amber-800/30 dark:bg-amber-950/25"
    >
      <p className="text-sm text-foreground">{upgrade.suggested_upgrade}</p>
      <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {upgrade.resonance_count} {resonanceCountLabel}
        </span>
        {hasResonated ? (
          <span className="text-xs italic text-muted-foreground">
            {alreadyResonatedLabel}
          </span>
        ) : canResonate ? (
          <button
            type="button"
            onClick={onResonate}
            className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary/80 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:text-primary"
            aria-label={resonateLabel}
          >
            <Radio className="size-3.5 shrink-0" aria-hidden />
            <span>{resonateLabel}</span>
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
