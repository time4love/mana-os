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
    <div className="flex gap-1 rounded-md border border-border p-0.5">
      {(["he", "en"] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            locale === loc
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          aria-label={`Switch to ${labels[loc]}`}
        >
          {labels[loc]}
        </button>
      ))}
    </div>
  );
}
