/**
 * Typed database helpers for Server Actions.
 * Use these types when Supabase client inference yields `never` (e.g. schema shape mismatch with GenericSchema).
 * All types must stay in sync with migrations and @/lib/supabase/types.
 */

import type { Database } from "@/lib/supabase/types";

export type CommunitiesInsert = Database["public"]["Tables"]["communities"]["Insert"];
export type CommunitiesRow = Database["public"]["Tables"]["communities"]["Row"];
export type CommunityMembersInsert = Database["public"]["Tables"]["community_members"]["Insert"];
export type ProfilesInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProposalsInsert = Database["public"]["Tables"]["proposals"]["Insert"];
export type ProposalsRow = Database["public"]["Tables"]["proposals"]["Row"];
export type MapPinsInsert = Database["public"]["Tables"]["map_pins"]["Insert"];
export type MapPinsRow = Database["public"]["Tables"]["map_pins"]["Row"];
export type TruthNodesInsert = Database["public"]["Tables"]["truth_nodes"]["Insert"];
export type TruthNodesRow = Database["public"]["Tables"]["truth_nodes"]["Row"];
export type TruthEdgesInsert = Database["public"]["Tables"]["truth_edges"]["Insert"];
export type TruthEdgesRow = Database["public"]["Tables"]["truth_edges"]["Row"];
export type CommunitiesUpdate = Database["public"]["Tables"]["communities"]["Update"];
export type ProposalsUpdate = Database["public"]["Tables"]["proposals"]["Update"];
