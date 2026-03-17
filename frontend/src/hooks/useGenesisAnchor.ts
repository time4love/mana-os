"use client";

import { useAccount, useReadContract } from "wagmi";
import { MANA_SKILLS_ABI, MANA_SKILLS_ADDRESS } from "@/contracts/manaSkills";
import { anvil } from "@/lib/wagmi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Checks whether the connected wallet holds a Genesis Anchor SBT (any ManaSkills token).
 * Used to gate Truth Engine actions: Epistemic Resonance, Support/Challenge claims, Transcript Sieve.
 * Phase 10 Step 8: Sybil-Resistant Arena Access.
 *
 * Two paths:
 * 1. **Web3:** Reads balanceOf(address) from ManaSkills.sol; balance > 0 ⇒ has SBT.
 * 2. **Architect's Key:** If connected wallet matches NEXT_PUBLIC_ARCHITECT_WALLET, gates are opened
 *    for local testing without needing an on-chain SBT.
 *
 * Dev: Set NEXT_PUBLIC_TRUTH_SBT_BYPASS=true to unlock for any connected wallet; or set
 * NEXT_PUBLIC_ARCHITECT_WALLET to your dev wallet address.
 */
export function useGenesisAnchor() {
  const { address, isConnected } = useAccount();

  const architectWallet =
    typeof process.env.NEXT_PUBLIC_ARCHITECT_WALLET === "string"
      ? process.env.NEXT_PUBLIC_ARCHITECT_WALLET.trim()
      : undefined;
  const devBypass =
    typeof process.env.NEXT_PUBLIC_TRUTH_SBT_BYPASS === "string" &&
    process.env.NEXT_PUBLIC_TRUTH_SBT_BYPASS.toLowerCase() === "true";

  const contractValid =
    MANA_SKILLS_ADDRESS && MANA_SKILLS_ADDRESS !== ZERO_ADDRESS;

  const { data: balanceRaw } = useReadContract({
    address: contractValid ? MANA_SKILLS_ADDRESS : undefined,
    abi: MANA_SKILLS_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: anvil.id,
    query: {
      enabled: !!address && contractValid,
    },
  });

  const balance = typeof balanceRaw === "bigint" ? Number(balanceRaw) : 0;
  const hasSBTOnChain = balance > 0;

  const isArchitect =
    !!address &&
    !!architectWallet &&
    address.toLowerCase() === architectWallet.toLowerCase();

  const hasGenesisAnchor =
    !!isConnected &&
    (isArchitect || devBypass || hasSBTOnChain);

  return {
    isConnected: !!isConnected,
    hasGenesisAnchor,
    walletAddress: address ?? undefined,
  };
}
