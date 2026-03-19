/**
 * Arena-Scoped Identity (Ego Death).
 * Unified procedural gradient avatars: single nature emoji + HSL gradient circle.
 * Stateless, zero-storage, zero latency. Same wallet in another arena = different identity.
 */

const NATURE_EMOJIS = [
  "🌿", "🍂", "🌊", "⛰️", "☀️", "🌙", "⭐", "☁️",
  "❄️", "🔥", "💧", "🍄", "🌸", "🌲", "🐚", "🦋",
  "🦉", "🦊", "🐢", "🐳", "🦅", "🐝", "🐞", "🕊️",
];

export interface ArenaAvatar {
  emoji: string;
  background: string;
  borderColor: string;
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return Math.abs(hash);
}

export function getArenaAvatar(
  walletAddress: string | null | undefined,
  arenaId: string
): ArenaAvatar {
  if (!walletAddress) {
    return {
      emoji: "👤",
      background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
      borderColor: "#475569",
    };
  }

  const combined = `${walletAddress.toLowerCase()}::${arenaId}`;
  const baseHash = hashString(combined);

  const emoji = NATURE_EMOJIS[baseHash % NATURE_EMOJIS.length];

  const hue1 = (baseHash / NATURE_EMOJIS.length) % 360;
  const hue2 = (hue1 + 45 + (baseHash % 90)) % 360;

  const background = `linear-gradient(135deg, hsl(${hue1}, 80%, 80%) 0%, hsl(${hue2}, 85%, 75%) 100%)`;
  const borderColor = `hsl(${hue1}, 60%, 60%)`;

  return {
    emoji,
    background,
    borderColor,
  };
}
