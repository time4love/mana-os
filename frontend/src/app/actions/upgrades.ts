"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  ProposalRow,
  ProposalUpgradeRow,
  SeedDiscourseRow,
} from "@/lib/supabase/types";
import { runOracleSynthesis } from "@/lib/oracle/runSynthesis";

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

    if (shouldMerge) {
      const { data: upgradeRow } = await supabase
        .from("proposal_upgrades")
        .select("proposal_id")
        .eq("id", upgradeId)
        .single();
      if (upgradeRow?.proposal_id) {
        const synthesisResult = await runOracleSynthesis(upgradeRow.proposal_id);
        if (!synthesisResult.success) {
          console.error("[resonateWithUpgrade] Oracle synthesis after merge:", synthesisResult.error);
        }
      }
    }

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

export type ShareSeedWisdomResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Adds a wisdom message to the seed's micro-circle (flat discourse). No nesting.
 */
export async function shareSeedWisdom(
  upgradeId: string,
  authorWallet: string,
  wisdom: string
): Promise<ShareSeedWisdomResult> {
  const trimmed = wisdom?.trim();
  if (!trimmed) return { success: false, error: "Wisdom text is required" };
  if (!upgradeId || !authorWallet || !/^0x[a-fA-F0-9]{40}$/.test(authorWallet)) {
    return { success: false, error: "Invalid upgrade or wallet" };
  }

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase.from("seed_discourse").insert({
      upgrade_id: upgradeId,
      author_wallet: authorWallet.toLowerCase(),
      wisdom: trimmed,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to share wisdom";
    return { success: false, error: message };
  }
}

export type GetSeedDiscourseResult =
  | { success: true; discourse: SeedDiscourseRow[] }
  | { success: false; error: string };

/** Rich proposal context for the Codex: proposal + upgrades + micro-circle discourse per seed. */
export interface ProposalContextForCodex {
  proposal: {
    id: string;
    title: string;
    description: string;
    resource_plan: ProposalRow["resource_plan"];
    oracle_insight: string | null;
  };
  upgrades: Array<{
    id: string;
    suggested_upgrade: string;
    resonance_count: number;
    status: ProposalUpgradeRow["status"];
    discourse: SeedDiscourseRow[];
  }>;
}

export type GetProposalContextForCodexResult =
  | { success: true; context: ProposalContextForCodex }
  | { success: false; error: string };

/**
 * Fetches full proposal context for the Codex: proposal, all upgrade seeds (pending + merged),
 * and micro-circle discourse for each seed. One round-trip for the "Present Oracle" greeting.
 */
export async function getProposalContextForCodex(
  proposalId: string
): Promise<GetProposalContextForCodexResult> {
  if (!proposalId) return { success: false, error: "Invalid proposal id" };

  try {
    const supabase = createServerSupabase();

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, title, description, resource_plan, oracle_insight")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    const { data: upgrades, error: upgradesError } = await supabase
      .from("proposal_upgrades")
      .select("id, suggested_upgrade, resonance_count, status")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true });

    if (upgradesError) {
      return { success: false, error: upgradesError.message };
    }

    const upgradeList = (upgrades ?? []) as ProposalUpgradeRow[];
    const discourseByUpgradeId: Record<string, SeedDiscourseRow[]> = {};

    for (const u of upgradeList) {
      const { data: discourse } = await supabase
        .from("seed_discourse")
        .select("*")
        .eq("upgrade_id", u.id)
        .order("created_at", { ascending: true });
      discourseByUpgradeId[u.id] = (discourse ?? []) as SeedDiscourseRow[];
    }

    const context: ProposalContextForCodex = {
      proposal: {
        id: proposal.id,
        title: proposal.title,
        description: proposal.description,
        resource_plan: proposal.resource_plan,
        oracle_insight: proposal.oracle_insight,
      },
      upgrades: upgradeList.map((u) => ({
        id: u.id,
        suggested_upgrade: u.suggested_upgrade,
        resonance_count: u.resonance_count,
        status: u.status,
        discourse: discourseByUpgradeId[u.id] ?? [],
      })),
    };

    return { success: true, context };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load proposal context";
    return { success: false, error: message };
  }
}

/**
 * Fetches the flat micro-circle discourse for an upgrade seed, chronologically.
 */
export async function getSeedDiscourse(
  upgradeId: string
): Promise<GetSeedDiscourseResult> {
  if (!upgradeId) return { success: false, error: "Invalid upgrade id" };

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("seed_discourse")
      .select("*")
      .eq("upgrade_id", upgradeId)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, discourse: (data ?? []) as SeedDiscourseRow[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load discourse";
    return { success: false, error: message };
  }
}
