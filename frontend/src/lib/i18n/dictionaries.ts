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
      manaCycles: string;
      realmLabel: string;
      realmMaterial: string;
      realmEnergetic: string;
      realmKnowledge: string;
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
      soulContractTitle: string;
      currentSeasonLabel: string;
      resonatingRealmsLabel: string;
      genesisQrDescription: string;
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
    proposals: {
      title: string;
      navHome: string;
      navProfile: string;
      navNewProposal: string;
      navFeed: string;
      placeholder: string;
      visionTitleLabel: string;
      visionTitlePlaceholder: string;
      resonateButtonLabel: string;
      visionSproutingMessage: string;
      feedTitle: string;
      feedEmpty: string;
      getResourcePlan: string;
      loading: string;
      error: string;
      resultTitle: string;
      naturalResources: string;
      humanCapital: string;
      manaCyclesUnit: string;
      chatPlaceholder: string;
      chatSend: string;
      oracleLabel: string;
      youLabel: string;
      resonateWithVision: string;
      resonanceCount: string;
      sproutedLabel: string;
      needSbtToResonate: string;
      alreadyResonated: string;
      plantUpgradeSeedPlaceholder: string;
      communityWisdom: string;
      resonateWithUpgrade: string;
      alreadyResonatedWithUpgrade: string;
      shareSeedWisdomPlaceholder: string;
      seekOracleSynthesis: string;
      synthesisLoading: string;
      oracleInsightLabel: string;
      consultOracleLabel: string;
    };
    communities: {
      genesisTitle: string;
      genesisPlaceholder: string;
      seedManifestedMessage: string;
      nurseryTitle: string;
      nurserySubtitle: string;
      nurseryEmpty: string;
      waterTheSeed: string;
      alreadyJoined: string;
      criticalMass: string;
      navSeeds: string;
      navGenesis: string;
    };
    home: {
      welcomeTitle: string;
      welcomeSubtitle: string;
      awakenButton: string;
      welcomeBack: string;
      oracleCardTitle: string;
      oracleCardDescription: string;
      consultOracle: string;
      seasonLabel: string;
      manaCyclesLabel: string;
    };
    architect: {
      navArchitect: string;
      title: string;
      header: string;
      placeholder: string;
      chatPlaceholder: string;
      chatSend: string;
      oracleLabel: string;
      youLabel: string;
      successTitle: string;
      successMessage: string;
    };
    mentor: {
      accessDeniedTitle: string;
      accessDeniedMessage: string;
      grantGenesisResonance: string;
      confirmGrantPrompt: string;
      scanOrPastePlaceholder: string;
      openCamera: string;
      grantedTitle: string;
      grantedMessage: string;
    };
    onboarding: {
      welcomeHome: string;
      tapToContinue: string;
      seasonQuestion: string;
      seasonWinter: string;
      seasonSpring: string;
      seasonSummer: string;
      seasonAutumn: string;
      realmQuestion: string;
      realmQuestionPrefix: string;
      realmQuestionSuffix: string;
      manaTerm: string;
      realmMaterialLabel: string;
      realmEnergeticLabel: string;
      realmKnowledgeLabel: string;
      manaWhisperDefinition: string;
      genesisText: string;
      readyLabel: string;
      genesisAnchorButton: string;
      genesisAnchoring: string;
      genesisConnectWallet: string;
      navHome: string;
      codexTriggerLabel: string;
      codexSoulContractTriggerLabel: string;
      noWalletHint: string;
      noWalletError: string;
    };
  }
> = {
  he: {
    home: {
      welcomeTitle: "ברוך הבא ל-Mana OS",
      welcomeSubtitle: "מערכת ההפעלה המרפאת.",
      awakenButton: "התעורר (חבר ארנק)",
      welcomeBack: "ברוך שובך. הקהילה מהדהדת.",
      oracleCardTitle: "חזון חדש לקהילה",
      oracleCardDescription: "יש לך רעיון לפרויקט? דבר עם האורקל הסוקרטי כדי לארוג תוכנית משאבי מאנה.",
      consultOracle: "היוועץ באורקל",
      seasonLabel: "עונה נוכחית",
      manaCyclesLabel: "מעגלי מאנה",
    },
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
        "עדיין אין לך כישורי מאנה רשומים. התחל את המסע שלך על ידי השגת אסימון שוליה (Apprentice) — תוכל לצבור מעגלי מאנה ולעלות רמה דרך תהודה והתמסרות לקהילה.",
      startJourney: "התחל את מסע המאנה שלך",
      startJourneyHint:
        "כרגע: הרץ את סקריפט ה-CLI כדי להנפיק אסימון בדיקה (למשל Agriculture, בסיסי). בהמשך אפשר לחבר כפתור זה לפעולת mint מתוך הממשק.",
      skillLevel: "רמת מיומנות",
      proficiencyLabel: "רמת מיומנות",
      manaCycles: "מעגלי מאנה",
      realmLabel: "תדר",
      realmMaterial: "חומר",
      realmEnergetic: "אנרגיה",
      realmKnowledge: "ידע",
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
      soulContractTitle: "חוזה הנשמה הדינמי",
      currentSeasonLabel: "עונה נוכחית",
      resonatingRealmsLabel: "תדרים מהדהדים",
      genesisQrDescription:
        "הראה קוד זה למנטור בקהילה כדי לקבל את חותם המאנה הראשון שלך (עוגן הבראשית).",
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
    proposals: {
      title: "הצעה חדשה — אורקל המאנה",
      navHome: "← ראשי",
      navProfile: "פרופיל",
      navNewProposal: "הצעה חדשה",
      navFeed: "המדורה",
      placeholder: "תאר את ההצעה או הפרויקט הקהילתי שלך (טקסט חופשי)...",
      visionTitleLabel: "שם החזון",
      visionTitlePlaceholder: "כותרת קצרה לחזון",
      resonateButtonLabel: "הדהד חזון זה לקהילה",
      visionSproutingMessage: "החזון נובט בקהילה...",
      feedTitle: "המדורה",
      feedEmpty: "אין עדיין הצעות. היה/י הראשון/ה להדהד חזון.",
      getResourcePlan: "קבל תוכנית משאבים",
      loading: "האורקל מנתח...",
      error: "שגיאה ביצירת תוכנית משאבים.",
      resultTitle: "תוכנית משאבים (מאנה)",
      naturalResources: "משאבים טבעיים",
      humanCapital: "הון אנושי",
      manaCyclesUnit: "מעגלי מאנה",
      chatPlaceholder: "הקלד הודעה...",
      chatSend: "שלח",
      oracleLabel: "אורקל המאנה",
      youLabel: "את/ה",
      resonateWithVision: "הדהד עם החזון",
      resonanceCount: "הדהודים",
      sproutedLabel: "נבט — עבר לשלב ביצוע",
      needSbtToResonate: "נדרש אסימון ManaSkills (SBT) כדי להדהד.",
      alreadyResonated: "כבר הדהדת עם החזון הזה.",
      plantUpgradeSeedPlaceholder: "זרע שדרוג לחזון…",
      communityWisdom: "חכמת הקהילה",
      resonateWithUpgrade: "הדהד",
      alreadyResonatedWithUpgrade: "כבר הדהדת עם הזרע הזה.",
      shareSeedWisdomPlaceholder: "שתף חוכמה על זרע זה…",
      seekOracleSynthesis: "בקש את סינתזת האורקל",
      synthesisLoading: "האורקל טווה…",
      oracleInsightLabel: "תבוננות האורקל",
      consultOracleLabel: "היוועץ באורקל",
    },
    communities: {
      genesisTitle: "זרע קהילה חדשה",
      genesisPlaceholder: "ספר/י לאורקל הגנסיס על החזון שלך...",
      seedManifestedMessage: "הזרע נוצר. ממתין להגשמה במדור הזרעים.",
      nurseryTitle: "משתלת הזרעים",
      nurserySubtitle: "קהילות ממתינות להגשמה — השקה זרע והצטרף לחזון",
      nurseryEmpty: "אין זרעים במשתלה. צור/י זרע חדש באורקל הגנסיס.",
      waterTheSeed: "השקה את הזרע (הצטרף לחזון)",
      alreadyJoined: "כבר הצטרפת לזרע הזה.",
      criticalMass: "מסה קריטית",
      navSeeds: "הזרעים",
      navGenesis: "זרע חדש",
    },
    architect: {
      navArchitect: "חדר הארכיטקט",
      title: "חדר הארכיטקט",
      header: "קוד המקור פתוח. מפת הדרכים חיה. מה נבנה הלאה?",
      placeholder: "שאל על הפילוסופיה, המסלול או הצע רעיון לתכונה...",
      chatPlaceholder: "הקלד הודעה...",
      chatSend: "שלח",
      oracleLabel: "אורקל הארכיטקט",
      youLabel: "את/ה",
      successTitle: "החזון נחקק",
      successMessage: "הרעיון שלך נרשם ביומן הקוד הפתוח. הקהילה תשקול אותו.",
    },
    mentor: {
      accessDeniedTitle: "גישה מוגבלת — למנחים בלבד",
      accessDeniedMessage:
        "רק מחזיקי אסימון ManaSkills ברמת מנחה (Level 3) יכולים להעניק עוגן הבראשית. המשך את דרכך והגע לרמת מנחה כדי לפתוח את סורק הבראשית.",
      grantGenesisResonance: "הענק הדהוד חניכה",
      confirmGrantPrompt: "להעניק עוגן הבראשית ל-{address}?",
      scanOrPastePlaceholder: "סרוק QR או הדבק כתובת ארנק…",
      openCamera: "פתח מצלמה",
      grantedTitle: "הדהוד חניכה הוענק",
      grantedMessage: "המשתתף קיבל את אסימון השוליה (Level 0). הם יכולים כעת להדהד עם הצעות ולצבור מעגלי מאנה.",
    },
    onboarding: {
      welcomeHome:
        "ברוך הבא הביתה. כאן אין מחירים, אין חובות ואין שעונים. זכותך להתקיים אינה מותנית. קח נשימה עמוקה...",
      tapToContinue: "גע במעגל כדי להמשיך",
      seasonQuestion: "הטבע נע במעגלים. באיזה עונה פנימית אתה או את נמצאים כרגע?",
      seasonWinter: "חורף (מנוחה וריפוי)",
      seasonSpring: "אביב (למידה וצמיחה)",
      seasonSummer: "קיץ (יצירה והדהוד)",
      seasonAutumn: "סתיו (אסיף והשלה)",
      realmQuestion: "לאן המאנה שלך רוצה לזרום העונה?",
      realmQuestionPrefix: "לאן ",
      realmQuestionSuffix: " שלך רוצה לזרום העונה?",
      manaTerm: "המאנה",
      realmMaterialLabel: "תדר חומר (אדמה)",
      realmEnergeticLabel: "תדר אנרגיה (רוח)",
      realmKnowledgeLabel: "תדר ידע (נפש)",
      manaWhisperDefinition:
        "מאנה היא האנרגיה המחדשת של הטבע ושל כוונה אנושית — במקום כסף.",
      genesisText:
        "חתימת האנרגיה שלך מוכנה. כדי להעיר אותה, פגש/י מנחה קהילתי מקומי פנים אל פנים. הם ימסרו לך את התהודה הראשונה שלך.",
      readyLabel: "מוכן",
      genesisAnchorButton: "עגן את החוזה הנשמתי",
      genesisAnchoring: "מהדהד…",
      genesisConnectWallet: "התחבר עם הארנק כדי להעגן",
      navHome: "← ראשי",
      codexTriggerLabel: "למה פגישה פיזית? (ספר הידע)",
      codexSoulContractTriggerLabel: "חוזה הנשמה והעונות (ספר הידע)",
      noWalletHint: "התקן הרחבת ארנק (למשל MetaMask) כדי להמשיך.",
      noWalletError: "לא נמצא ארנק. התקן הרחבת ארנק (למשל MetaMask) וחבר את האתר.",
    },
  },
  en: {
    home: {
      welcomeTitle: "Welcome to Mana OS",
      welcomeSubtitle: "The Healing Operating System.",
      awakenButton: "Awaken (Connect Wallet)",
      welcomeBack: "Welcome back. The community is resonating.",
      oracleCardTitle: "Dream a New Reality",
      oracleCardDescription: "Have an idea for a project? Speak with the Socratic Oracle to weave a Mana Resource Plan.",
      consultOracle: "Consult the Oracle",
      seasonLabel: "Current Season",
      manaCyclesLabel: "Mana Cycles",
    },
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
        "You have no Mana skills yet. Start your journey by earning an Apprentice token — you can grow mana cycles and level up through resonance and presence in the community.",
      startJourney: "Start your Mana journey",
      startJourneyHint:
        "For now: run the CLI mint script to mint a test token (e.g. Agriculture, Basic). Later this button can trigger mint from the UI.",
      skillLevel: "Skill level",
      proficiencyLabel: "Proficiency",
      manaCycles: "Mana Cycles",
      realmLabel: "Realm",
      realmMaterial: "Material",
      realmEnergetic: "Energetic",
      realmKnowledge: "Knowledge",
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
      soulContractTitle: "Dynamic Soul Contract",
      currentSeasonLabel: "Current Season",
      resonatingRealmsLabel: "Resonating Realms",
      genesisQrDescription:
        "Show this QR to a community Mentor to receive your Genesis Anchor (SBT).",
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
    proposals: {
      title: "New Proposal — Mana Oracle",
      navHome: "← Home",
      navProfile: "Profile",
      navNewProposal: "New proposal",
      navFeed: "The Hearth",
      placeholder: "Describe your community proposal or project (free text)...",
      visionTitleLabel: "Vision Title",
      visionTitlePlaceholder: "A short title for your vision",
      resonateButtonLabel: "Resonate Vision to Community",
      visionSproutingMessage: "Vision is sprouting in the community…",
      feedTitle: "The Community Hearth",
      feedEmpty: "No proposals yet. Be the first to resonate a vision.",
      getResourcePlan: "Get resource plan",
      loading: "Oracle is analyzing...",
      error: "Failed to generate resource plan.",
      resultTitle: "Resource plan (Mana)",
      naturalResources: "Natural resources",
      humanCapital: "Human capital",
      manaCyclesUnit: "Mana Cycles",
      chatPlaceholder: "Type a message...",
      chatSend: "Send",
      oracleLabel: "Mana Oracle",
      youLabel: "You",
      resonateWithVision: "Resonate with Vision",
      resonanceCount: "Resonance",
      sproutedLabel: "Sprouted — Ready for Action",
      needSbtToResonate: "A ManaSkills SBT is required to resonate.",
      alreadyResonated: "You have already resonated with this vision.",
      plantUpgradeSeedPlaceholder: "Plant an Upgrade Seed…",
      communityWisdom: "Community Wisdom",
      resonateWithUpgrade: "Resonate",
      alreadyResonatedWithUpgrade: "You have already resonated with this seed.",
      shareSeedWisdomPlaceholder: "Share wisdom on this seed…",
      seekOracleSynthesis: "Seek Oracle's Synthesis",
      synthesisLoading: "The Oracle is weaving…",
      oracleInsightLabel: "Oracle's Insight",
      consultOracleLabel: "Consult the Oracle",
    },
    communities: {
      genesisTitle: "Plant a Community Seed",
      genesisPlaceholder: "Tell the Genesis Oracle about your vision...",
      seedManifestedMessage: "Seed created. Awaiting manifestation in the Nursery.",
      nurseryTitle: "The Seed Nursery",
      nurserySubtitle: "Communities pending manifestation — water a seed and join the vision",
      nurseryEmpty: "No seeds in the nursery. Plant one with the Genesis Oracle.",
      waterTheSeed: "Water the Seed (Resonate & Join)",
      alreadyJoined: "You have already joined this seed.",
      criticalMass: "Critical mass",
      navSeeds: "Seeds",
      navGenesis: "New seed",
    },
    architect: {
      navArchitect: "The Architect's Room",
      title: "The Architect's Room",
      header: "The source code is open. The roadmap is alive. What shall we build next?",
      placeholder: "Ask about the philosophy, the roadmap, or propose a feature idea...",
      chatPlaceholder: "Type a message...",
      chatSend: "Send",
      oracleLabel: "Architect Oracle",
      youLabel: "You",
      successTitle: "Vision etched",
      successMessage: "Your vision has been etched into the Open Source log. The community will consider it.",
    },
    mentor: {
      accessDeniedTitle: "Access Denied — Mentors Only",
      accessDeniedMessage:
        "Only holders of a Level 3 (Mentor) ManaSkills SBT can grant the Genesis Anchor. Continue your path to Mentor level to unlock the Genesis Scanner.",
      grantGenesisResonance: "Grant Genesis Resonance",
      confirmGrantPrompt: "Grant Genesis Anchor to {address}?",
      scanOrPastePlaceholder: "Scan QR or paste wallet address…",
      openCamera: "Open camera",
      grantedTitle: "Genesis Resonance granted",
      grantedMessage: "The participant received their Apprentice (Level 0) token. They can now resonate with proposals and grow mana cycles.",
    },
    onboarding: {
      welcomeHome:
        "Welcome home. Here, there are no prices, no debts, and no clocks. Your right to exist is unconditional. Take a deep breath...",
      tapToContinue: "Tap the circle to continue",
      seasonQuestion: "Nature moves in cycles. What internal season are you currently in?",
      seasonWinter: "Winter (Rest & Healing)",
      seasonSpring: "Spring (Learning & Growing)",
      seasonSummer: "Summer (Creating & Resonating)",
      seasonAutumn: "Autumn (Harvesting & Shedding)",
      realmQuestion: "Where does your Mana wish to flow this season?",
      realmQuestionPrefix: "Where does your ",
      realmQuestionSuffix: " wish to flow this season?",
      manaTerm: "Mana",
      realmMaterialLabel: "Material Realm (Earth)",
      realmEnergeticLabel: "Energetic Realm (Spirit)",
      realmKnowledgeLabel: "Knowledge Realm (Mind)",
      manaWhisperDefinition:
        "Mana is the regenerative energy of nature and human intention — it replaces money.",
      genesisText:
        "Your energetic signature is ready. To awaken it, meet a local community mentor eye-to-eye. They will grant your first resonance.",
      readyLabel: "Ready",
      genesisAnchorButton: "Anchor Soul Contract",
      genesisAnchoring: "Resonating…",
      genesisConnectWallet: "Connect wallet to anchor",
      navHome: "← Home",
      codexTriggerLabel: "Why a physical meeting? (The Codex)",
      codexSoulContractTriggerLabel: "Soul Contract & Seasons (The Codex)",
      noWalletHint: "Install a wallet extension (e.g. MetaMask) to continue.",
      noWalletError: "No wallet found. Install a wallet extension (e.g. MetaMask) and connect this site.",
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

const realmKeys = ["realmMaterial", "realmEnergetic", "realmKnowledge"] as const;
export function getRealmDisplay(locale: Locale, realmIndex: number): string {
  const key = realmKeys[Math.max(0, Math.min(realmIndex, 2))];
  return dictionaries[locale].profile[key] ?? "—";
}
