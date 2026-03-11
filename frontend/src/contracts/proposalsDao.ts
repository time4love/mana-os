/**
 * ProposalsDAO contract ABI and address for Resonance governance.
 * Only ManaSkills SBT holders can resonate; proposalId is Supabase proposal UUID.
 */

export const PROPOSALS_DAO_ADDRESS =
  (process.env.NEXT_PUBLIC_PROPOSALS_DAO_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

export const PROPOSALS_DAO_ABI = [
  {
    inputs: [{ name: "proposalId", type: "string" }],
    name: "resonate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "proposalId", type: "string" }],
    name: "proposalResonance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "proposalId", type: "string" },
      { name: "resonator", type: "address" },
    ],
    name: "hasResonated",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
