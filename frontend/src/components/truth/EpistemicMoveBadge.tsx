"use client";

import { ShieldAlert, Zap, ShieldCheck, Wrench, Ban } from "lucide-react";

const MOVE_LABELS: Record<string, { he: string; en: string }> = {
  EMPIRICAL_CONTRADICTION: { he: "סתירה תצפיתית", en: "Empirical Contradiction" },
  INTERNAL_INCONSISTENCY: { he: "כשל פנימי", en: "Internal Inconsistency" },
  EMPIRICAL_VERIFICATION: { he: "ביסוס תצפיתי", en: "Empirical Verification" },
  AD_HOC_RESCUE: { he: "טלאי אד-הוק", en: "Ad-Hoc Rescue" },
  APPEAL_TO_AUTHORITY: { he: "הטיית סמכות", en: "Appeal to Authority" },
};

export function getMoveBadge(moveType?: string | null, locale: "he" | "en" = "en") {
  if (!moveType || !(moveType in MOVE_LABELS)) return null;
  const label = locale === "he" ? MOVE_LABELS[moveType].he : MOVE_LABELS[moveType].en;
  switch (moveType) {
    case "EMPIRICAL_CONTRADICTION":
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400"
          role="status"
        >
          <Zap className="size-3" /> {label}
        </span>
      );
    case "INTERNAL_INCONSISTENCY":
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/20 dark:text-orange-400"
          role="status"
        >
          <ShieldAlert className="size-3" /> {label}
        </span>
      );
    case "EMPIRICAL_VERIFICATION":
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400"
          role="status"
        >
          <ShieldCheck className="size-3" /> {label}
        </span>
      );
    case "AD_HOC_RESCUE":
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400"
          role="status"
        >
          <Wrench className="size-3" /> {label}
        </span>
      );
    case "APPEAL_TO_AUTHORITY":
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-500/10 text-stone-600 ring-1 ring-stone-500/20 dark:text-stone-400"
          role="status"
        >
          <Ban className="size-3" /> {label}
        </span>
      );
    default:
      return null;
  }
}
