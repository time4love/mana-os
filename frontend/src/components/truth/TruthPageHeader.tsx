"use client";

import { useLocale } from "@/lib/i18n/context";

const HEADING = {
  he: "מרחב האמת",
  en: "Truth Engine",
};

const SUBTITLE = {
  he: "זירת הגיון טהורה — ללא פנייה לסמכות, ללא צנזורה. בחרו זירת דיון והעמיקו במבנה הטענות.",
  en: "Arena of pure logic — no appeal to authority, no censorship. Choose a debate arena and deepen the structure of claims.",
};

export function TruthPageHeader() {
  const { locale } = useLocale();
  const heading = locale === "he" ? HEADING.he : HEADING.en;
  const subtitle = locale === "he" ? SUBTITLE.he : SUBTITLE.en;

  return (
    <header className="space-y-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] leading-tight">
        {heading}
      </h1>
      <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {subtitle}
      </p>
    </header>
  );
}
