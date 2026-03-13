"use server";

import { createPublicClient, http } from "viem";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProposalResourcePlan } from "@/lib/oracle/schema";
import type { ProposalRow } from "@/lib/supabase/types";
import { PROPOSALS_DAO_ABI } from "@/contracts/proposalsDao";

const RESONANCE_THRESHOLD = 3;

function getPublicClient() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
  return createPublicClient({
    chain: { id: chainId, name: "Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });
}

export type ResonateProposalResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Inserts a proposal into the Supabase proposals table.
 * Called when the user resonates (submits) their vision to the community.
 */
export async function resonateProposal(
  creatorWallet: string,
  title: string,
  description: string,
  resourcePlan: ProposalResourcePlan
): Promise<ResonateProposalResult> {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) {
    return { success: false, error: "Vision title is required" };
  }
  if (!creatorWallet || !/^0x[a-fA-F0-9]{40}$/.test(creatorWallet)) {
    return { success: false, error: "Invalid wallet address" };
  }

  try {
    const supabase = createServerSupabase();
    const payload = {
      creator_wallet: creatorWallet.toLowerCase(),
      title: trimmedTitle,
      description: description?.trim() ?? "",
      resource_plan: resourcePlan as unknown as Record<string, unknown>,
      status: "pending_resonance",
    };
    const { data, error } = await supabase
      .from("proposals")
      .insert(payload as never)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const row = data as { id: string } | null;
    if (!row?.id) {
      return { success: false, error: "Proposal created but no id returned" };
    }
    return { success: true, id: row.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resonate proposal";
    return { success: false, error: message };
  }
}

export type GetProposalsForFeedResult =
  | { success: true; proposals: ProposalRow[] }
  | { success: false; error: string };

/**
 * Fetches proposals with status pending_resonance for the Community Feed.
 */
export async function getProposalsForFeed(): Promise<GetProposalsForFeedResult> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("status", "pending_resonance")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, proposals: (data ?? []) as ProposalRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load proposals";
    return { success: false, error: message };
  }
}

export type SyncProposalStatusResult =
  | { success: true; updated: boolean }
  | { success: false; error: string };

/**
 * If on-chain resonance for the proposal is >= threshold, updates Supabase status to approved.
 * Call when the feed displays a proposal that has reached resonance (e.g. after refetch).
 */
export async function syncProposalStatusToApproved(
  proposalId: string
): Promise<SyncProposalStatusResult> {
  const daoAddress = process.env.NEXT_PUBLIC_PROPOSALS_DAO_ADDRESS as `0x${string}` | undefined;
  if (!daoAddress || daoAddress === "0x0000000000000000000000000000000000000000") {
    return { success: false, error: "ProposalsDAO address not configured" };
  }
  try {
    const client = getPublicClient();
    const resonance = await client.readContract({
      address: daoAddress,
      abi: PROPOSALS_DAO_ABI,
      functionName: "proposalResonance",
      args: [proposalId],
    });
    const count = Number(resonance);
    if (count < RESONANCE_THRESHOLD) {
      return { success: true, updated: false };
    }
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("proposals")
      .update({ status: "approved" } as never)
      .eq("id", proposalId);
    if (error) return { success: false, error: error.message };
    return { success: true, updated: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync proposal status";
    return { success: false, error: message };
  }
}
