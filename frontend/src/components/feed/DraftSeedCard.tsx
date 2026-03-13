"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { plantUpgradeSeed } from "@/app/actions/upgrades";
import { ORACLE_SEED_AUTHOR } from "@/lib/oracle/constants";
import type { PhysicsForecastDeltaJson } from "@/lib/supabase/types";
import { Leaf } from "lucide-react";

const transition = { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };

export interface DraftSeedCardProps {
  proposalId: string;
  suggestedUpgrade: string;
  physicsForecast: PhysicsForecastDeltaJson[];
  approvePlantLabel: string;
  plantedSuccessLabel: string;
  physicsForecastLabel: string;
  onPlanted?: () => void;
}

export function DraftSeedCard({
  proposalId,
  suggestedUpgrade,
  physicsForecast,
  approvePlantLabel,
  plantedSuccessLabel,
  physicsForecastLabel,
  onPlanted,
}: DraftSeedCardProps) {
  const [status, setStatus] = useState<"idle" | "planting" | "planted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleApprovePlant() {
    if (status !== "idle") return;
    setErrorMessage(null);
    setStatus("planting");
    const result = await plantUpgradeSeed(
      proposalId,
      ORACLE_SEED_AUTHOR,
      suggestedUpgrade,
      physicsForecast.length > 0 ? physicsForecast : null
    );
    if (result.success) {
      setStatus("planted");
      onPlanted?.();
    } else {
      setStatus("error");
      setErrorMessage(result.error);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-soft dark:border-emerald-400/25 dark:bg-emerald-950/30"
    >
      <div className="px-4 py-3">
        <p className="mb-1.5 text-xs font-medium text-emerald-700/90 dark:text-emerald-300/90" aria-hidden>
          🌱 {physicsForecastLabel}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{suggestedUpgrade}</p>
        {physicsForecast.length > 0 && (
          <div
            className="mt-2.5 rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
            role="region"
            aria-label={physicsForecastLabel}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              {physicsForecastLabel}:
            </p>
            <ul className="list-none space-y-0.5 text-xs text-foreground/90">
              {physicsForecast.map((delta, i) => (
                <li key={i}>
                  {delta.change} {delta.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status === "idle" && (
            <motion.button
              type="button"
              onClick={handleApprovePlant}
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              aria-label={approvePlantLabel}
            >
              <Leaf className="size-3.5 shrink-0" aria-hidden />
              <span>{approvePlantLabel}</span>
            </motion.button>
          )}
          {status === "planting" && (
            <span className="text-sm text-muted-foreground italic" role="status">
              …
            </span>
          )}
          {status === "planted" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition}
              className="text-sm font-medium text-primary flex items-center gap-1.5"
            >
              <Leaf className="size-4 shrink-0" aria-hidden />
              {plantedSuccessLabel}
            </motion.p>
          )}
          {status === "error" && errorMessage && (
            <p className="text-xs text-red-500" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
