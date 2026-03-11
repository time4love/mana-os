/**
 * Harmonic Time (תדר הזמן הטבעי): Nature-aligned time presentation.
 * Replaces Gregorian calendar display with Solar Season + Lunar Phase.
 * DB/logic may still use Date/timestamptz; only the UI uses these formatters.
 */

export type HarmonicLocale = "en" | "he";

// Solar seasons by month (Northern Hemisphere). 0 = Dec, 1 = Jan, ... 11 = Nov
const SEASON_BY_MONTH: Record<number, { en: string; he: string }> = {
  0: { en: "Winter", he: "חורף" },
  1: { en: "Winter", he: "חורף" },
  2: { en: "Winter", he: "חורף" },
  3: { en: "Spring", he: "אביב" },
  4: { en: "Spring", he: "אביב" },
  5: { en: "Spring", he: "אביב" },
  6: { en: "Summer", he: "קיץ" },
  7: { en: "Summer", he: "קיץ" },
  8: { en: "Summer", he: "קיץ" },
  9: { en: "Autumn", he: "סתיו" },
  10: { en: "Autumn", he: "סתיו" },
  11: { en: "Autumn", he: "סתיו" },
};

// Lunar cycle ~29.530588 days. Reference: 2024-01-11 was a new moon (approx).
const LUNAR_CYCLE_DAYS = 29.530588;
const REFERENCE_NEW_MOON_MS = new Date(2024, 0, 11).getTime();

type MoonPhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

const SUN_EMOJI = "\u2600\uFE0F";
const MOON_EMOJI = "\uD83C\uDF19";

const MOON_PHASES: Record<
  MoonPhaseKey,
  { en: string; he: string; emoji: string }
> = {
  new: { en: "New Moon", he: "מולד הירח", emoji: "\uD83C\uDF11" },
  waxing_crescent: {
    en: "Waxing Crescent",
    he: "ירח מתמלא (סהר)",
    emoji: "\uD83C\uDF12",
  },
  first_quarter: {
    en: "First Quarter Moon",
    he: "רבע ירח ראשון",
    emoji: "\uD83C\uDF13",
  },
  waxing_gibbous: {
    en: "Waxing Moon",
    he: "ירח מתמלא",
    emoji: "\uD83C\uDF14",
  },
  full: { en: "Full Moon", he: "ירח מלא", emoji: "\uD83C\uDF15" },
  waning_gibbous: {
    en: "Waning Moon",
    he: "ירח מתמעט",
    emoji: "\uD83C\uDF16",
  },
  last_quarter: {
    en: "Last Quarter Moon",
    he: "רבע ירח אחרון",
    emoji: "\uD83C\uDF17",
  },
  waning_crescent: {
    en: "Waning Crescent",
    he: "ירח מתמעט (סהר)",
    emoji: "\uD83C\uDF18",
  },
};

function getLunarPhase(date: Date): MoonPhaseKey {
  const daysSinceNew =
    (date.getTime() - REFERENCE_NEW_MOON_MS) / (24 * 60 * 60 * 1000);
  const position = ((daysSinceNew % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS;
  if (position < 1.85) return "new";
  if (position < 7.4) return "waxing_crescent";
  if (position < 9.2) return "first_quarter";
  if (position < 14.77) return "waxing_gibbous";
  if (position < 16.5) return "full";
  if (position < 22.1) return "waning_gibbous";
  if (position < 23.8) return "last_quarter";
  return "waning_crescent";
}

/**
 * Returns a Harmonic Time string for a given date: Solar Season | Moon Phase + emoji.
 * Example: "Spring | Waxing Moon 🌒" / "אביב | ירח מתמלא 🌒"
 */
export function getHarmonicDate(date: Date, locale: HarmonicLocale): string {
  const month = date.getMonth();
  const season = SEASON_BY_MONTH[month]?.[locale] ?? SEASON_BY_MONTH[3].en;
  const phaseKey = getLunarPhase(date);
  const phase = MOON_PHASES[phaseKey];
  const phaseLabel = locale === "he" ? phase.he : phase.en;
  const separator = locale === "he" ? " | " : " | ";
  return `${season}${separator}${phaseLabel} ${phase.emoji}`;
}

// Relative time labels: suns (days), moons (months). Use Unicode escapes for emoji to avoid bundle issues.
const RELATIVE_EN = {
  now: "just now",
  sunsAgo: (n: number) => (n === 1 ? `1 sun ago ${SUN_EMOJI}` : `${n} suns ago ${SUN_EMOJI}`),
  sunsAhead: (n: number) => (n === 1 ? `in 1 sun ${SUN_EMOJI}` : `in ${n} suns ${SUN_EMOJI}`),
  moonAgo: (n: number) => (n === 1 ? `1 moon ago ${MOON_EMOJI}` : `${n} moons ago ${MOON_EMOJI}`),
  moonAhead: (n: number) => (n === 1 ? `in 1 moon ${MOON_EMOJI}` : `in ${n} moons ${MOON_EMOJI}`),
  manyMoonsAgo: `many moons ago ${MOON_EMOJI}`,
  manyMoonsAhead: `in many moons ${MOON_EMOJI}`,
};

const RELATIVE_HE: {
  now: string;
  sunsAgo: (n: number) => string;
  sunsAhead: (n: number) => string;
  moonAgo: (n: number) => string;
  moonAhead: (n: number) => string;
  manyMoonsAgo: string;
  manyMoonsAhead: string;
} = {
  now: "עכשיו",
  sunsAgo: (n) => (n === 1 ? `לפני שמש אחת ${SUN_EMOJI}` : `לפני ${n} שמשות ${SUN_EMOJI}`),
  sunsAhead: (n) => (n === 1 ? `בעוד שמש אחת ${SUN_EMOJI}` : `בעוד ${n} שמשות ${SUN_EMOJI}`),
  moonAgo: (n) => (n === 1 ? `לפני ירח אחד ${MOON_EMOJI}` : `לפני ${n} ירחים ${MOON_EMOJI}`),
  moonAhead: (n) => (n === 1 ? `בעוד ירח אחד ${MOON_EMOJI}` : `בעוד ${n} ירחים ${MOON_EMOJI}`),
  manyMoonsAgo: `לפני ירחים רבים ${MOON_EMOJI}`,
  manyMoonsAhead: `בעוד ירחים רבים ${MOON_EMOJI}`,
};

/**
 * Returns a relative Harmonic Time string (e.g. "3 suns ago", "1 moon ago", "לפני 3 שמשות").
 * Uses days as "suns" and months as "moons". No Gregorian units.
 */
export function getRelativeHarmonicTime(
  date: Date,
  locale: HarmonicLocale,
  baseDate: Date = new Date()
): string {
  const t = date.getTime();
  const now = baseDate.getTime();
  const diffMs = now - t;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffMonths =
    (baseDate.getFullYear() - date.getFullYear()) * 12 +
    (baseDate.getMonth() - date.getMonth());
  const absDays = Math.abs(diffDays);
  const absMonths = Math.abs(diffMonths);
  const isPast = diffMs >= 0;
  const R = locale === "he" ? RELATIVE_HE : RELATIVE_EN;

  if (absDays === 0) return R.now;

  if (absDays < 31) {
    return isPast ? R.sunsAgo(absDays) : R.sunsAhead(absDays);
  }

  if (absMonths <= 12) {
    return isPast ? R.moonAgo(absMonths) : R.moonAhead(absMonths);
  }

  return isPast ? R.manyMoonsAgo : R.manyMoonsAhead;
}
