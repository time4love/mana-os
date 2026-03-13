"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type { CommunityRow } from "@/lib/supabase/types";
import type { CommunitiesInsert, CommunitiesUpdate, CommunityMembersInsert } from "@/lib/supabase/db";
import type { CommunitySeed } from "@/lib/oracle/schema";

export type ManifestSeedResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Inserts a community seed (pending_manifestation) after the Genesis Oracle has calculated critical mass.
 */
export async function manifestCommunitySeed(
  founderWallet: string,
  seed: CommunitySeed
): Promise<ManifestSeedResult> {
  const name = seed.name?.trim();
  const vision = seed.vision?.trim();
  if (!name || !vision) {
    return { success: false, error: "Name and vision are required" };
  }
  if (
    !founderWallet ||
    !/^0x[a-fA-F0-9]{40}$/.test(founderWallet)
  ) {
    return { success: false, error: "Invalid wallet address" };
  }
  const mass = Math.max(1, Math.floor(Number(seed.requiredCriticalMass) || 1));
  try {
    const supabase = createServerSupabase();
    const payload: CommunitiesInsert = {
      founder_wallet: founderWallet.toLowerCase(),
      name,
      vision,
      required_critical_mass: mass,
      status: "pending_manifestation",
    };
    const { data, error } = await supabase
      .from("communities")
      .insert(payload as never)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    const row = data as { id: string } | null;
    if (!row?.id) return { success: false, error: "Community created but no id returned" };
    return { success: true, id: row.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to manifest community seed";
    return { success: false, error: message };
  }
}

export interface SeedWithMemberCount extends CommunityRow {
  member_count: number;
  has_joined?: boolean;
}

export type GetSeedsResult =
  | { success: true; seeds: SeedWithMemberCount[] }
  | { success: false; error: string };

/**
 * Fetches communities in pending_manifestation with current member count for the Nursery.
 * If wallet is provided, each seed includes has_joined for that wallet.
 */
export async function getSeedsForNursery(
  wallet?: string
): Promise<GetSeedsResult> {
  try {
    const supabase = createServerSupabase();
    const { data: communitiesData, error: commError } = await supabase
      .from("communities")
      .select("*")
      .eq("status", "pending_manifestation")
      .order("created_at", { ascending: false });

    if (commError) return { success: false, error: commError.message };
    const communities = (communitiesData ?? []) as CommunityRow[];

    const seeds: SeedWithMemberCount[] = [];
    const normalizedWallet = wallet?.toLowerCase();
    for (const c of communities) {
      const { count, error: countError } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", c.id);
      let has_joined = false;
      if (normalizedWallet) {
        const { data: member } = await supabase
          .from("community_members")
          .select("wallet_address")
          .eq("community_id", c.id)
          .eq("wallet_address", normalizedWallet)
          .maybeSingle();
        has_joined = !!member;
      }
      seeds.push({
        ...(c as CommunityRow),
        member_count: countError ? 0 : (count ?? 0),
        has_joined,
      });
    }
    return { success: true, seeds };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load seeds";
    return { success: false, error: message };
  }
}

export type JoinCommunityResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Adds the user as a member (resonator) of the community seed. If member count reaches required_critical_mass, updates status to manifested.
 */
export async function joinCommunity(
  communityId: string,
  walletAddress: string
): Promise<JoinCommunityResult> {
  if (
    !walletAddress ||
    !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)
  ) {
    return { success: false, error: "Invalid wallet address" };
  }
  try {
    const supabase = createServerSupabase();
    const memberPayload: CommunityMembersInsert = {
      community_id: communityId,
      wallet_address: walletAddress.toLowerCase(),
    };
    const { error: insertError } = await supabase.from("community_members").insert(memberPayload as never);

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: false, error: "Already a member" };
      }
      return { success: false, error: insertError.message };
    }

    const { data: communityData } = await supabase
      .from("communities")
      .select("required_critical_mass")
      .eq("id", communityId)
      .single();

    const community = communityData as { required_critical_mass: number | null } | null;
    if (community) {
      const { count } = await supabase
        .from("community_members")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId);
      if (count !== null && count >= (community.required_critical_mass ?? 0)) {
        const updatePayload: CommunitiesUpdate = { status: "manifested" };
        await supabase.from("communities").update(updatePayload as never).eq("id", communityId);
      }
    }
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to join community";
    return { success: false, error: message };
  }
}
