"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type Locale,
  dictionaries,
  getProficiencyLabel as getProficiencyLabelI18n,
  getLevelDisplay as getLevelDisplayI18n,
  getRealmDisplay as getRealmDisplayI18n,
} from "./dictionaries";

const STORAGE_KEY = "mana-os-locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "he";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "he") return stored;
  return "he";
}

function persistLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: keyof (typeof dictionaries.he)["profile"]) => string;
  tError: (key: keyof (typeof dictionaries.he)["errorProfile"]) => string;
  tProposals: (key: keyof (typeof dictionaries.he)["proposals"]) => string;
  tCommunities: (key: keyof (typeof dictionaries.he)["communities"]) => string;
  tOnboarding: (key: keyof (typeof dictionaries.he)["onboarding"]) => string;
  tHome: (key: keyof (typeof dictionaries.he)["home"]) => string;
  tArchitect: (key: keyof (typeof dictionaries.he)["architect"]) => string;
  tMentor: (key: keyof (typeof dictionaries.he)["mentor"]) => string;
  getProficiencyLabel: (level: number) => string;
  getLevelDisplay: (level: number) => string;
  getRealmDisplay: (realmIndex: number) => string;
  replace: (template: string, vars: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("he");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const dir = locale === "he" ? "rtl" : "ltr";
    const lang = locale === "he" ? "he" : "en";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [locale, mounted]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const dict = useMemo(() => dictionaries[locale], [locale]);

  const t = useCallback(
    (key: keyof (typeof dictionaries.he)["profile"]) => dict.profile[key],
    [dict]
  );

  const tError = useCallback(
    (key: keyof (typeof dictionaries.he)["errorProfile"]) => dict.errorProfile[key],
    [dict]
  );

  const tProposals = useCallback(
    (key: keyof (typeof dictionaries.he)["proposals"]) => dict.proposals[key],
    [dict]
  );

  const tCommunities = useCallback(
    (key: keyof (typeof dictionaries.he)["communities"]) => dict.communities[key],
    [dict]
  );

  const tOnboarding = useCallback(
    (key: keyof (typeof dictionaries.he)["onboarding"]) => dict.onboarding[key],
    [dict]
  );

  const tHome = useCallback(
    (key: keyof (typeof dictionaries.he)["home"]) => dict.home[key],
    [dict]
  );

  const tArchitect = useCallback(
    (key: keyof (typeof dictionaries.he)["architect"]) => dict.architect[key],
    [dict]
  );

  const tMentor = useCallback(
    (key: keyof (typeof dictionaries.he)["mentor"]) => dict.mentor[key],
    [dict]
  );

  const getProficiencyLabel = useCallback(
    (level: number) => getProficiencyLabelI18n(locale, level),
    [locale]
  );

  const getLevelDisplay = useCallback(
    (level: number) => getLevelDisplayI18n(locale, level),
    [locale]
  );

  const getRealmDisplay = useCallback(
    (realmIndex: number) => getRealmDisplayI18n(locale, realmIndex),
    [locale]
  );

  const replace = useCallback(
    (template: string, vars: Record<string, string | number>) => {
      let out = template;
      for (const [k, v] of Object.entries(vars)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
      return out;
    },
    []
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      tError,
      tProposals,
      tCommunities,
      tOnboarding,
      tHome,
      tArchitect,
      tMentor,
      getProficiencyLabel,
      getLevelDisplay,
      getRealmDisplay,
      replace,
    }),
    [
      locale,
      setLocale,
      t,
      tError,
      tProposals,
      tCommunities,
      tOnboarding,
      tHome,
      tArchitect,
      tMentor,
      getProficiencyLabel,
      getLevelDisplay,
      getRealmDisplay,
      replace,
    ]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
