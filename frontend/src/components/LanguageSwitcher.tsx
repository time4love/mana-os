"use client";

import { useLocale } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/dictionaries";

const labels: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex gap-1 rounded-md border border-neutral-600 p-0.5">
      {(["he", "en"] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            locale === loc
              ? "bg-emerald-600 text-white"
              : "text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
          }`}
          aria-label={`Switch to ${labels[loc]}`}
        >
          {labels[loc]}
        </button>
      ))}
    </div>
  );
}
