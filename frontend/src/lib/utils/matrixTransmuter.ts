/**
 * Matrix Transmuter — translates OSM (matrix) POI tags into Healing OS concepts.
 * Used by The Awakening Map to display the world in New World language.
 */

export type TransmuterLocale = "en" | "he";

export type TransmutedIconKind = "pillar" | "basket" | "spark" | "pin";

export interface TransmutedPOI {
  icon: TransmutedIconKind;
  name: string;
  description: string;
  /** Original OSM name (e.g. "Bank Leumi") for the Legacy Bridge subtitle. */
  originalName: string | null;
  /** For untransmuted POIs: raw OSM key=value (e.g. "amenity: fuel") for matrix-code display. */
  rawMatrixCode?: string | null;
  /** For untransmuted POIs: emoji for marker icon (e.g. ⛽, 🕍). */
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
};

function getEmojiForTagValue(value: string): string {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  return EMOJI_MAP[normalized] ?? "📍";
}

/** Generic category descriptions for fallback POIs (no specific transmutation). */
const FALLBACK_DESCRIPTION_HE = "מרחב בעולם הישן";
const FALLBACK_DESCRIPTION_EN = "Space in the Old World";

/** Category descriptor from OSM tag for fallback POIs. Locale-aware. */
function getGenericDescription(tags: OSMTags, locale: TransmuterLocale): string {
  const shop = tags.shop?.toLowerCase();
  const amenity = tags.amenity?.toLowerCase();
  if (shop) {
    return locale === "he" ? "חנות" : "Shop";
  }
  if (amenity) {
    return locale === "he" ? "מרחב בעולם הישן" : FALLBACK_DESCRIPTION_EN;
  }
  return locale === "he" ? FALLBACK_DESCRIPTION_HE : FALLBACK_DESCRIPTION_EN;
}

const BANK_HE = {
  name: "מוזיאון העולם הישן",
  description:
    "בעבר נאגרו כאן רשומות חוב. כיום זהו מרחב לאמנות והיסטוריה.",
};
const BANK_EN = {
  name: "Museum of the Old World",
  description:
    "Once held debt ledgers. Now a space for art and history.",
};

const SUPERMARKET_HE = {
  name: "מרכז שפע אזורי",
  description:
    "נקודת ניתוב לעודפי מזון ויבולי הקהילה ללא תמורה.",
};
const SUPERMARKET_EN = {
  name: "Regional Abundance Hub",
  description:
    "Routing point for surplus food and community harvests, free of charge.",
};

const SCHOOL_HE = {
  name: "מרחב חניכה",
  description:
    "מרכז להעברת תדרי התודעה בין מנטורים לחניכים.",
};
const SCHOOL_EN = {
  name: "Apprenticeship Grounds",
  description:
    "Center for transmitting Knowledge Realm frequencies.",
};

/**
 * Translates a single OSM-tagged POI into a Mana OS entity.
 * Specific matrix pillars (bank, supermarket, school) get transmuted names; all others
 * fallback to original name with a generic description and pin icon so the map stays functional.
 * Returns null only when the POI has no displayable name.
 */
export function transmutePOI(
  tags: OSMTags,
  locale: TransmuterLocale
): TransmutedPOI | null {
  if (!tags || typeof tags !== "object") return null;

  const originalName = getOriginalName(tags, locale);
  if (!originalName) return null;

  const amenity = tags.amenity?.toLowerCase();
  const shop = tags.shop?.toLowerCase();

  if (amenity === "bank") {
    const t = locale === "he" ? BANK_HE : BANK_EN;
    return { icon: "pillar", name: t.name, description: t.description, originalName };
  }

  if (shop === "supermarket" || shop === "convenience") {
    const t = locale === "he" ? SUPERMARKET_HE : SUPERMARKET_EN;
    return { icon: "basket", name: t.name, description: t.description, originalName };
  }

  if (amenity === "school" || amenity === "university") {
    const t = locale === "he" ? SCHOOL_HE : SCHOOL_EN;
    return { icon: "spark", name: t.name, description: t.description, originalName };
  }

  const primary = extractPrimaryTag(tags);
  const rawMatrixCode = primary
    ? `${primary.key}: ${primary.value}`
    : null;
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
