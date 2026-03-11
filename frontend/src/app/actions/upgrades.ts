"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type { ProposalUpgradeRow } from "@/lib/supabase/types";

const MERGE_RESONANCE_THRESHOLD = 2;

export type PlantUpgradeSeedResult =
  | { success: true; upgradeId: string }
  | { success: false; error: string };

/**
 * Plants an Upgrade Seed (community suggestion) on a proposal.
 * The seed appears as pending until enough members resonate with it.
 */
export async function plantUpgradeSeed(
  proposalId: string,
  authorWallet: string,
  suggestedUpgrade: string
): Promise<PlantUpgradeSeedResult> {
  const trimmed = suggestedUpgrade?.trim();
  if (!trimmed) {
    return { success: false, error: "Upgrade seed text is required" };
  }
  if (!proposalId || !authorWallet || !/^0x[a-fA-F0-9]{40}$/.test(authorWallet)) {
    return { success: false, error: "Invalid proposal or wallet" };
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("proposal_upgrades")
      .insert({
        proposal_id: proposalId,
        author_wallet: authorWallet.toLowerCase(),
        suggested_upgrade: trimmed,
        resonance_count: 0,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    if (!data?.id) return { success: false, error: "Upgrade created but no id returned" };
    return { success: true, upgradeId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to plant upgrade seed";
    return { success: false, error: message };
  }
}

export type ResonateWithUpgradeResult =
  | { success: true; merged: boolean }
  | { success: false; error: string };

/**
 * Records resonance with an upgrade seed. One resonance per wallet per upgrade.
 * When resonance_count reaches MERGE_RESONANCE_THRESHOLD, status becomes 'merged'.
 */
export async function resonateWithUpgrade(
  upgradeId: string,
  walletAddress: string
): Promise<ResonateWithUpgradeResult> {
  if (!upgradeId || !walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return { success: false, error: "Invalid upgrade or wallet" };
  }

  try {
    const supabase = createServerSupabase();
    const normalizedWallet = walletAddress.toLowerCase();

    const { error: insertError } = await supabase
      .from("proposal_upgrade_resonances")
      .insert({ upgrade_id: upgradeId, wallet_address: normalizedWallet });

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: true, merged: false };
      }
      return { success: false, error: insertError.message };
    }

    const { count, error: countError } = await supabase
      .from("proposal_upgrade_resonances")
      .select("*", { count: "exact", head: true })
      .eq("upgrade_id", upgradeId);

    if (countError) return { success: false, error: countError.message };
    const newCount = count ?? 0;
    const shouldMerge = newCount >= MERGE_RESONANCE_THRESHOLD;

    const { error: updateError } = await supabase
      .from("proposal_upgrades")
      .update({
        resonance_count: newCount,
        ...(shouldMerge ? { status: "merged" } : {}),
      })
      .eq("id", upgradeId);

    if (updateError) return { success: false, error: updateError.message };
    return { success: true, merged: shouldMerge };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resonate with upgrade";
    return { success: false, error: message };
  }
}

export type GetUpgradesForProposalResult =
  | { success: true; upgrades: ProposalUpgradeRow[] }
  | { success: false; error: string };

/**
 * Fetches all upgrade seeds for a proposal (pending and merged) for the Fractal UI.
 */
export async function getUpgradesForProposal(
  proposalId: string
): Promise<GetUpgradesForProposalResult> {
  if (!proposalId) return { success: false, error: "Invalid proposal id" };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("proposal_upgrades")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, upgrades: (data ?? []) as ProposalUpgradeRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load upgrades";
    return { success: false, error: message };
  }
}

export type GetUpgradeResonanceByWalletResult =
  | { success: true; resonatedUpgradeIds: string[] }
  | { success: false; error: string };

/**
 * Returns upgrade ids the wallet has already resonated with (for UI state).
 */
export async function getUpgradeResonanceByWallet(
  upgradeIds: string[],
  walletAddress: string
): Promise<GetUpgradeResonanceByWalletResult> {
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress) || upgradeIds.length === 0) {
    return { success: true, resonatedUpgradeIds: [] };
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("proposal_upgrade_resonances")
      .select("upgrade_id")
      .eq("wallet_address", walletAddress.toLowerCase())
      .in("upgrade_id", upgradeIds);

    if (error) return { success: false, error: error.message };
    const resonatedUpgradeIds = (data ?? []).map((r) => r.upgrade_id);
    return { success: true, resonatedUpgradeIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load resonance status";
    return { success: false, error: message };
  }
}
