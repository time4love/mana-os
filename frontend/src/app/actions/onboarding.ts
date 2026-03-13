"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileRow as SupabaseProfileRow } from "@/lib/supabase/types";

const SeasonSchema = z.enum(["winter", "spring", "summer", "autumn"]);
const RealmSchema = z.enum(["material", "energetic", "knowledge"]);
const WalletAddressSchema = z
  .string()
  .min(1, "Wallet address is required")
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const AnchorSoulContractSchema = z.object({
  walletAddress: WalletAddressSchema,
  season: SeasonSchema,
  realms: z.array(RealmSchema),
});

export type AnchorSoulContractInput = z.infer<typeof AnchorSoulContractSchema>;

export type AnchorSoulContractResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Anchors the user's Soul Contract in the off-chain DB: maps wallet to season + realms.
 * Insert or update profiles. Status set to 'anchored' on success.
 */
export async function anchorSoulContract(
  walletAddress: string,
  season: string,
  realms: string[]
): Promise<AnchorSoulContractResult> {
  const parsed = AnchorSoulContractSchema.safeParse({
    walletAddress,
    season,
    realms,
  });

  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(first).flat().find(Boolean) ?? "Invalid input";
    return { success: false, error: String(message) };
  }

  const { walletAddress: address, season: s, realms: r } = parsed.data;

  try {
    const supabase = createServerSupabase();
    const profilePayload = {
      wallet_address: address.toLowerCase(),
      season: s,
      realms: r,
      status: "anchored",
    };
    const { error } = await supabase.from("profiles").upsert(profilePayload as never, {
      onConflict: "wallet_address",
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to anchor";
    return { success: false, error: message };
  }
}

const WalletOnlySchema = z.object({
  walletAddress: WalletAddressSchema,
});

export type ProfileRow = SupabaseProfileRow;

export type GetProfileResult =
  | { success: true; profile: SupabaseProfileRow | null }
  | { success: false; error: string };

/**
 * Fetches the user's Soul Contract (profile) from Supabase by wallet address.
 * Used by the profile page to display season and realms.
 */
export async function getProfileByWallet(
  walletAddress: string
): Promise<GetProfileResult> {
  const parsed = WalletOnlySchema.safeParse({ walletAddress });
  if (!parsed.success) {
    return { success: false, error: "Invalid wallet address" };
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("wallet_address, season, realms, status, created_at")
      .eq("wallet_address", parsed.data.walletAddress.toLowerCase())
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, profile: data as SupabaseProfileRow | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load profile";
    return { success: false, error: message };
  }
}
