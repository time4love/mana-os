/**
 * ManaSkills contract ABI and address for frontend reads.
 * Keys and addresses remain in English; UI strings are localized elsewhere.
 */

export const MANA_SKILLS_ADDRESS =
  (process.env.NEXT_PUBLIC_MANA_SKILLS_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

/** Minimal ABI for reading skill records and token ownership. Level is enum (uint8): 0=Apprentice, 1=Basic, 2=Advanced, 3=Mentor. */
export const MANA_SKILLS_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getSkillRecord",
    outputs: [
      { name: "category", type: "string" },
      { name: "level", type: "uint8" },
      { name: "hoursContributed", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getTokenIdsOf",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type ManaSkillsSkillRecord = readonly [string, number, bigint];
