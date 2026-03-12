"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type { MapPinRow, MapPinType } from "@/lib/supabase/types";

export type GetMapPinsResult =
  | { success: true; pins: MapPinRow[] }
  | { success: false; error: string };

/**
 * Fetches all pins for The Awakening Map.
 */
export async function getMapPins(): Promise<GetMapPinsResult> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("map_pins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, pins: (data ?? []) as MapPinRow[] };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load map pins";
    return { success: false, error: message };
  }
}

export type DropPinResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Inserts a new pin on The Awakening Map.
 */
export async function dropPin(
  wallet: string,
  pinType: MapPinType,
  lat: number,
  lng: number,
  title: string,
  description: string
): Promise<DropPinResult> {
  const trimmedTitle = title?.trim() ?? "";
  const trimmedDesc = description?.trim() ?? "";
  if (!trimmedTitle) {
    return { success: false, error: "Title is required" };
  }
  if (
    !wallet ||
    !/^0x[a-fA-F0-9]{40}$/.test(wallet)
  ) {
    return { success: false, error: "Invalid wallet address" };
  }
  const validTypes: MapPinType[] = [
    "vision_seed",
    "abundance_anchor",
    "resource_pledge",
  ];
  if (!validTypes.includes(pinType)) {
    return { success: false, error: "Invalid pin type" };
  }
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return { success: false, error: "Valid coordinates are required" };
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("map_pins")
      .insert({
        creator_wallet: wallet.toLowerCase(),
        pin_type: pinType,
        lat,
        lng,
        title: trimmedTitle,
        description: trimmedDesc,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    if (!data?.id) return { success: false, error: "Pin created but no id returned" };
    return { success: true, id: data.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to drop pin";
    return { success: false, error: message };
  }
}
