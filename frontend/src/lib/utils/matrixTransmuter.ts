/**
 * Matrix Transmuter — translates OSM (matrix) POI tags into Healing OS concepts.
 * Uses The Grand Transmutation Dictionary: Matrix Relics, Material, Energetic, Knowledge Realms.
 */

export type TransmuterLocale = "en" | "he";

export type TransmutedIconKind = "pillar" | "basket" | "spark" | "pin";

export interface TransmutedPOI {
  icon: TransmutedIconKind;
  name: string;
  description: string;
  /** Original OSM name (e.g. "Bank Leumi") for the Legacy Bridge subtitle. */
  originalName: string | null;
  /** For untransmuted POIs: raw OSM key=value for matrix-code display. */
  rawMatrixCode?: string | null;
  /** Emoji for marker icon (transmuted and fallback). */
  emoji?: string | null;
}

/**
 * Extracts the display name from OSM tags: prefers locale-specific (name:he / name:en), then name.
 */
function getOriginalName(tags: OSMTags, locale: TransmuterLocale): string | null {
  const localeKey = locale === "he" ? "name:he" : "name:en";
  const value = tags[localeKey] ?? tags.name;
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export interface TransmutedPOIWithCoords extends TransmutedPOI {
  lat: number;
  lng: number;
  osmId: string;
}

/** OSM element tags: key-value pairs from node/way tags. */
export interface OSMTags {
  amenity?: string;
  shop?: string;
  leisure?: string;
  natural?: string;
  building?: string;
  office?: string;
  craft?: string;
  tourism?: string;
  [key: string]: string | undefined;
}

const PRIMARY_TAG_KEYS = [
  "amenity",
  "shop",
  "leisure",
  "natural",
  "building",
  "office",
  "craft",
  "tourism",
] as const;

/** Extracts the primary category key and value from OSM tags for fallback POIs. */
function extractPrimaryTag(tags: OSMTags): { key: string; value: string } | null {
  for (const key of PRIMARY_TAG_KEYS) {
    const value = tags[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { key, value: value.trim() };
    }
  }
  return null;
}

/** Single dictionary entry: bilingual name + description + emoji. */
interface DictEntry {
  nameHe: string;
  nameEn: string;
  descHe: string;
  descEn: string;
  emoji: string;
}

/** Rule: predicate on tags returns true if this transmutation applies. */
type TagPredicate = (tags: OSMTags) => boolean;

/** Build a TransmutedPOI from a dictionary entry and locale. */
function fromEntry(
  entry: DictEntry,
  locale: TransmuterLocale,
  originalName: string
): TransmutedPOI {
  return {
    icon: "pin",
    name: locale === "he" ? entry.nameHe : entry.nameEn,
    description: locale === "he" ? entry.descHe : entry.descEn,
    originalName,
    emoji: entry.emoji,
  };
}

// ——— A. Matrix Relics (שרידי המטריקס) ———
const MUSEUM_OLD_WORLD: DictEntry = {
  nameHe: "מוזיאון העולם הישן",
  nameEn: "Museum of the Old World",
  descHe: "ארכיון למערכות חוב היסטוריות.",
  descEn: "Archive of historic debt systems.",
  emoji: "🏛️",
};

const ARCHIVE_CONSENSUS: DictEntry = {
  nameHe: "מרכז ארכיון והסכמה",
  nameEn: "Archive & Consensus Center",
  descHe: "לשעבר מוסדות אכיפה. כיום מרחבי תיעוד ציבורי וגישור אזרחי.",
  descEn: "Formerly enforcement institutions. Now spaces for public record and civic mediation.",
  emoji: "📜",
};

// ——— B. Material Realm (תדר החומר) ———
const REGIONAL_ABUNDANCE: DictEntry = {
  nameHe: "מרכז שפע אזורי",
  nameEn: "Regional Abundance Hub",
  descHe: "נקודת ניתוב לעודפי מזון ויבולי הקהילה.",
  descEn: "Routing point for surplus food and community harvests.",
  emoji: "🧺",
};

const ECO_CHARGING: DictEntry = {
  nameHe: "תחנת טעינה אקולוגית",
  nameEn: "Ecological Charging Station",
  descHe: "מוקד הזנה אנרגטית בת-קיימא.",
  descEn: "Sustainable energy replenishment hub.",
  emoji: "🔋",
};

const GREEN_LUNG: DictEntry = {
  nameHe: "ריאה ירוקה",
  nameEn: "Green Lung",
  descHe: "מרחב קהילתי פתוח לליקוט וחיבור לאדמה.",
  descEn: "Open community space for foraging and connection to the land.",
  emoji: "🌳",
};

// ——— C. Energetic Realm (תדר הרוח והריפוי) ———
const COMMUNITY_HEALING: DictEntry = {
  nameHe: "מרחב ריפוי קהילתי",
  nameEn: "Community Healing Space",
  descHe: "מוקד להענקת רפואה ותמיכה מתדר הרוח.",
  descEn: "Hub for healing and support from the Energetic Realm.",
  emoji: "🌿",
};

const SANCTUARY_SPIRIT: DictEntry = {
  nameHe: "היכל רוח והתכנסות",
  nameEn: "Sanctuary of Spirit",
  descHe: "מרחב מקודש לתפילה, שקט והדהוד קהילתי.",
  descEn: "Sacred space for prayer, silence and community resonance.",
  emoji: "✨",
};

const TRIBAL_HEARTH: DictEntry = {
  nameHe: "מדורת השבט",
  nameEn: "The Tribal Hearth",
  descHe: "מרחב הזנה ושיח פתוח לחברי הקהילה.",
  descEn: "Space for nourishment and open dialogue for the community.",
  emoji: "☕",
};

// ——— D. Knowledge Realm (תדר התודעה) ———
const HALL_CREATION: DictEntry = {
  nameHe: "היכל יצירה והשראה",
  nameEn: "Hall of Creation & Inspiration",
  descHe: "מרכז אומנותי להעברת תדרים ופיתוח תודעתי.",
  descEn: "Artistic centre for transmitting frequencies and consciousness development.",
  emoji: "🎨",
};

const APPRENTICESHIP_GROUNDS: DictEntry = {
  nameHe: "מרחב חניכה",
  nameEn: "Apprenticeship Grounds",
  descHe: "מרכז להעברת תדרי התודעה בין מנטורים לחניכים.",
  descEn: "Center for transmitting Knowledge Realm frequencies between mentors and apprentices.",
  emoji: "📖",
};

/** Ordered rules: first match wins. */
const TRANSMUTATION_RULES: Array<{ match: TagPredicate; entry: DictEntry }> = [
  // A. Matrix Relics
  { match: (t) => ["bank", "atm"].includes(t.amenity?.toLowerCase() ?? ""), entry: MUSEUM_OLD_WORLD },
  { match: (t) => t.office?.toLowerCase() === "government" || t.amenity?.toLowerCase() === "police", entry: ARCHIVE_CONSENSUS },
  // B. Material Realm
  { match: (t) => ["supermarket", "convenience", "bakery"].includes(t.shop?.toLowerCase() ?? ""), entry: REGIONAL_ABUNDANCE },
  { match: (t) => t.amenity?.toLowerCase() === "fuel", entry: ECO_CHARGING },
  { match: (t) => t.leisure?.toLowerCase() === "park" || t.natural?.toLowerCase() === "wood", entry: GREEN_LUNG },
  // C. Energetic Realm
  { match: (t) => ["hospital", "clinic", "pharmacy"].includes(t.amenity?.toLowerCase() ?? ""), entry: COMMUNITY_HEALING },
  { match: (t) => t.amenity?.toLowerCase() === "place_of_worship", entry: SANCTUARY_SPIRIT },
  { match: (t) => ["cafe", "restaurant"].includes(t.amenity?.toLowerCase() ?? ""), entry: TRIBAL_HEARTH },
  // D. Knowledge Realm
  { match: (t) => t.amenity?.toLowerCase() === "arts_centre" || t.tourism?.toLowerCase() === "museum" || t.amenity?.toLowerCase() === "theatre", entry: HALL_CREATION },
  { match: (t) => ["school", "university", "library"].includes(t.amenity?.toLowerCase() ?? ""), entry: APPRENTICESHIP_GROUNDS },
];

/** Emoji for untransmuted OSM tag values (lowercase). Fallback 📍. */
const EMOJI_MAP: Record<string, string> = {
  fuel: "⛽",
  place_of_worship: "🕍",
  cafe: "☕",
  restaurant: "🍽️",
  pharmacy: "⚕️",
  park: "🌳",
  parking: "🅿️",
  hospital: "🏥",
  school: "🏫",
  university: "🎓",
  bank: "🏛️",
  supermarket: "🛒",
  bakery: "🥖",
  convenience: "🏪",
  library: "📚",
  theatre: "🎭",
  cinema: "🎬",
  museum: "🖼️",
  arts_centre: "🎨",
  playground: "🛝",
  swimming_pool: "🏊",
  gym: "🏋️",
  fast_food: "🍔",
  bar: "🍺",
  pub: "🍺",
  ice_cream: "🍦",
  clothes: "👕",
  hairdresser: "💇",
  dentist: "🦷",
  doctors: "🩺",
  veterinary: "🐾",
  bus_station: "🚌",
  taxi: "🚕",
  bicycle_parking: "🚲",
  atm: "🏧",
  post_office: "📮",
  police: "🚔",
  fire_station: "🚒",
  townhall: "🏛️",
  community_centre: "🏠",
  recycling: "♻️",
  drinking_water: "💧",
  fountain: "⛲",
  clinic: "🩺",
  wood: "🌲",
};

function getEmojiForTagValue(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  return EMOJI_MAP[normalized] ?? "📍";
}

const FALLBACK_DESCRIPTION_HE = "מרחב בעולם הישן";
const FALLBACK_DESCRIPTION_EN = "Space in the Old World";

function getGenericDescription(tags: OSMTags, locale: TransmuterLocale): string {
  const shop = tags.shop?.toLowerCase();
  const amenity = tags.amenity?.toLowerCase();
  if (shop) return locale === "he" ? "חנות" : "Shop";
  if (amenity) return locale === "he" ? FALLBACK_DESCRIPTION_HE : FALLBACK_DESCRIPTION_EN;
  return locale === "he" ? FALLBACK_DESCRIPTION_HE : FALLBACK_DESCRIPTION_EN;
}

/**
 * Translates a single OSM-tagged POI into a Mana OS entity using the Grand Transmutation Dictionary.
 * Matrix Relics, Material, Energetic, and Knowledge Realms are mapped first; everything else
 * falls back to original name with rawMatrixCode and tag-based emoji.
 */
export function transmutePOI(
  tags: OSMTags,
  locale: TransmuterLocale
): TransmutedPOI | null {
  if (!tags || typeof tags !== "object") return null;

  const originalName = getOriginalName(tags, locale);
  if (!originalName) return null;

  for (const { match, entry } of TRANSMUTATION_RULES) {
    if (match(tags)) {
      return fromEntry(entry, locale, originalName);
    }
  }

  const primary = extractPrimaryTag(tags);
  const rawMatrixCode = primary ? `${primary.key}: ${primary.value}` : null;
  const emoji = primary ? getEmojiForTagValue(primary.value) : "📍";

  return {
    icon: "pin",
    name: originalName,
    description: getGenericDescription(tags, locale),
    originalName: null,
    rawMatrixCode: rawMatrixCode ?? undefined,
    emoji,
  };
}
