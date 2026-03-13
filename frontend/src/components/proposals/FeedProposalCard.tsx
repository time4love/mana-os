"use client";

import { useEffect, useRef } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { getRelativeHarmonicTime } from "@/lib/utils/harmonicTime";
import {
  PROPOSALS_DAO_ABI,
  PROPOSALS_DAO_ADDRESS,
} from "@/contracts/proposalsDao";
import type { ProposalRow } from "@/lib/supabase/types";
import type { ProposalResourcePlanJson } from "@/lib/supabase/types";
import { syncProposalStatusToApproved } from "@/app/actions/proposals";
import { Leaf } from "lucide-react";

const RESONANCE_THRESHOLD = 3;

interface FeedProposalCardProps {
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

export function FeedProposalCard({ proposal, onResonated }: FeedProposalCardProps) {
  const { locale, tProposals } = useLocale();
  const { address } = useAccount();

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

  function handleResonate() {
    if (!canResonate || isResonating) return;
    writeContract({
      address: PROPOSALS_DAO_ADDRESS,
      abi: PROPOSALS_DAO_ABI,
      functionName: "resonate",
      args: [proposal.id],
    });
  }

  return (
    <motion.li
      layout
      className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/30 hover:shadow-soft-md"
    >
      <div className="flex flex-col gap-3">
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
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {proposal.description}
          </p>
        )}

        <ResourcePlanSection
          plan={proposal.resource_plan}
          naturalResourcesLabel={tProposals("naturalResources")}
          humanCapitalLabel={tProposals("humanCapital")}
          manaCyclesUnit={tProposals("manaCyclesUnit")}
        />

        {/* Resonance meter: glowing seed / circular progress */}
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
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] as const }}
            />
          </div>
        </div>

        {/* Resonate CTA */}
        {!isSprouted && (
          <div className="mt-2">
            {hasResonated ? (
              <p className="text-sm text-muted-foreground italic">
                {tProposals("alreadyResonated")}
              </p>
            ) : canResonate ? (
              <>
                <button
                  type="button"
                  onClick={handleResonate}
                  disabled={isResonating}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {isResonating
                    ? (locale === "he" ? "מהדהד…" : "Resonating…")
                    : tProposals("resonateWithVision")}
                </button>
                {writeError && (
                  <p className="mt-2 text-xs text-red-500" role="alert">
                    {writeError.message?.includes("NoSBT")
                      ? tProposals("needSbtToResonate")
                      : writeError.message}
                  </p>
                )}
              </>
            ) : (
              address &&
              PROPOSALS_DAO_ADDRESS !== "0x0000000000000000000000000000000000000000" && (
                <p className="text-sm text-muted-foreground">
                  {tProposals("needSbtToResonate")}
                </p>
              )
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {getRelativeHarmonicTime(
            new Date(proposal.created_at),
            locale
          )}
        </p>
      </div>
    </motion.li>
  );
}
