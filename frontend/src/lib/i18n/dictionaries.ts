/**
 * i18n dictionaries for Mana OS. Keys in English; values localized per locale.
 * Supports he (Hebrew, RTL) and en (English, LTR).
 */

export type Locale = "he" | "en";

export const dictionaries: Record<
  Locale,
  {
    profile: {
      title: string;
      navHome: string;
      disconnect: string;
      connectPrompt: string;
      connectWith: string;
      connecting: string;
      loadingSkills: string;
      loadingRecord: string;
      errorLoadSkills: string;
      welcomeTitle: string;
      welcomeBody: string;
      startJourney: string;
      startJourneyHint: string;
      skillLevel: string;
      proficiencyLabel: string;
      contributionHours: string;
      wrongChain: string;
      wrongChainRpc: string;
      fallbackHint: string;
      debugTitle: string;
      debugConnected: string;
      debugAddress: string;
      debugNetwork: string;
      debugTokens: string;
      debugShowing: string;
      yes: string;
      no: string;
    };
    proficiency: {
      apprentice: string;
      basic: string;
      advanced: string;
      mentor: string;
    };
    errorProfile: {
      title: string;
      message: string;
      tryAgain: string;
      goHome: string;
    };
    common: {
      level: string;
    };
  }
> = {
  he: {
    profile: {
      title: "פרופיל המאנה שלי",
      navHome: "← ראשי",
      disconnect: "התנתק",
      connectPrompt: "התחבר עם הארנק שלך (Anvil) כדי לראות את כישורי המאנה שלך.",
      connectWith: "התחבר עם",
      connecting: "מתחבר…",
      loadingSkills: "טוען כישורים…",
      loadingRecord: "טוען רשומת מיומנות…",
      errorLoadSkills:
        "לא ניתן לטעון כישורים. ודא שאתה ברשת Anvil (Chain ID 31337) ושהוגדר חוזה ManaSkills ב-NEXT_PUBLIC_MANA_SKILLS_ADDRESS.",
      welcomeTitle: "ברוך הבא",
      welcomeBody:
        "עדיין אין לך כישורי מאנה רשומים. התחל את המסע שלך על ידי השגת אסימון שוליה (Apprentice) — תוכל לצבור שעות ולעלות רמה דרך תרומה לקהילה.",
      startJourney: "התחל את מסע המאנה שלך",
      startJourneyHint:
        "כרגע: הרץ את סקריפט ה-CLI כדי להנפיק אסימון בדיקה (למשל Agriculture, בסיסי). בהמשך אפשר לחבר כפתור זה לפעולת mint מתוך הממשק.",
      skillLevel: "רמת מיומנות",
      proficiencyLabel: "רמת מיומנות",
      contributionHours: "שעות תרומה",
      wrongChain:
        "הארנק מחובר לרשת אחרת. עבור לרשת Anvil (Chain ID {chainId}) כדי לראות את כישורי המאנה שלך.",
      wrongChainRpc: "ברשת הנכונה: RPC http://127.0.0.1:8545 (או הערך ב-NEXT_PUBLIC_RPC_URL)",
      fallbackHint:
        "אם הדף נשאר ריק, ודא ש-NEXT_PUBLIC_MANA_SKILLS_ADDRESS מצביע על החוזה הנכון ושהאסימון הונפק לכתובת הארנק שלך (סקריפט ה-mint מנגיש ל-0xf39Fd…).",
      debugTitle: "לוג דיבוג (בקונסול: [Mana Profile])",
      debugConnected: "מחובר",
      debugAddress: "כתובת",
      debugNetwork: "רשת ארנק",
      debugTokens: "טוקנים",
      debugShowing: "מציג",
      yes: "כן",
      no: "לא",
    },
    proficiency: {
      apprentice: "שוליה",
      basic: "בסיסי",
      advanced: "מתקדם",
      mentor: "מנחה",
    },
    errorProfile: {
      title: "שגיאה בטעינת הפרופיל",
      message:
        "משהו השתבש. נסה לרענן או לחזור לדף הראשי. אם הבעיה נמשכת, ודא שאתה ברשת הנכונה (Anvil, Chain ID 31337) וש-NEXT_PUBLIC_MANA_SKILLS_ADDRESS מצביע על חוזה ManaSkills תקף.",
      tryAgain: "נסה שוב",
      goHome: "לדף הראשי",
    },
    common: {
      level: "רמה",
    },
  },
  en: {
    profile: {
      title: "My Mana Profile",
      navHome: "← Home",
      disconnect: "Disconnect",
      connectPrompt: "Connect your wallet (Anvil) to see your Mana skills.",
      connectWith: "Connect with",
      connecting: "Connecting…",
      loadingSkills: "Loading skills…",
      loadingRecord: "Loading skill record…",
      errorLoadSkills:
        "Could not load skills. Ensure you are on Anvil (Chain ID 31337) and NEXT_PUBLIC_MANA_SKILLS_ADDRESS is set.",
      welcomeTitle: "Welcome",
      welcomeBody:
        "You have no Mana skills yet. Start your journey by earning an Apprentice token — you can earn hours and level up through community contribution.",
      startJourney: "Start your Mana journey",
      startJourneyHint:
        "For now: run the CLI mint script to mint a test token (e.g. Agriculture, Basic). Later this button can trigger mint from the UI.",
      skillLevel: "Skill level",
      proficiencyLabel: "Proficiency",
      contributionHours: "Contribution hours",
      wrongChain:
        "Wallet is on a different network. Switch to Anvil (Chain ID {chainId}) to view your Mana skills.",
      wrongChainRpc: "Correct network RPC: http://127.0.0.1:8545 (or set NEXT_PUBLIC_RPC_URL)",
      fallbackHint:
        "If the page stays blank, ensure NEXT_PUBLIC_MANA_SKILLS_ADDRESS points to the contract and the token was minted to your wallet (mint script uses 0xf39Fd…).",
      debugTitle: "Debug log (console: [Mana Profile])",
      debugConnected: "Connected",
      debugAddress: "Address",
      debugNetwork: "Wallet network",
      debugTokens: "Tokens",
      debugShowing: "Showing",
      yes: "Yes",
      no: "No",
    },
    proficiency: {
      apprentice: "Apprentice",
      basic: "Basic",
      advanced: "Advanced",
      mentor: "Mentor",
    },
    errorProfile: {
      title: "Profile load error",
      message:
        "Something went wrong. Try refreshing or going back home. If it persists, ensure you are on the correct network (Anvil, Chain ID 31337) and NEXT_PUBLIC_MANA_SKILLS_ADDRESS points to a valid ManaSkills contract.",
      tryAgain: "Try again",
      goHome: "Go home",
    },
    common: {
      level: "Level",
    },
  },
};

export function getProficiencyLabel(locale: Locale, level: number): string {
  const key = (["apprentice", "basic", "advanced", "mentor"] as const)[
    Math.max(0, Math.min(level, 3))
  ];
  return dictionaries[locale].proficiency[key] ?? "—";
}

export function getLevelDisplay(locale: Locale, level: number): string {
  const label = getProficiencyLabel(locale, level);
  const levelNum = Math.max(0, Math.min(level, 3));
  return `${dictionaries[locale].common.level} ${levelNum}: ${label}`;
}
