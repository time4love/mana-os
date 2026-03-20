"use client";

import type { EpistemicState } from "@/types/truth";

interface EpistemicStateBadgeProps {
  state?: EpistemicState | null;
  locale?: string;
  className?: string;
}

const STATE_LABELS = {
  SOLID: { he: "יציבה (Solid)", en: "Solid" },
  CONTESTED: { he: "מעורערת (Contested)", en: "Contested" },
  SHATTERED: { he: "הופרכה (Shattered)", en: "Shattered" },
} as const;

export function EpistemicStateBadge({ state = "SOLID", locale = "en", className = "" }: EpistemicStateBadgeProps) {
  const s = state === "SOLID" || state === "CONTESTED" || state === "SHATTERED" ? state : "SOLID";
  const label = locale === "he" ? STATE_LABELS[s].he : STATE_LABELS[s].en;

  switch (s) {
    case "SHATTERED":
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20 ${className}`}
          role="status"
        >
          🔴 {label}
        </span>
      );
    case "CONTESTED":
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400 ${className}`}
          role="status"
        >
          🟡 {label}
        </span>
      );
    case "SOLID":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 ${className}`}
          role="status"
        >
          🟢 {label}
        </span>
      );
  }
}
