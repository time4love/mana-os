/**
 * Supabase database types for Mana OS.
 * Profiles table: wallet → Soul Contract (season + realms).
 */

export type ProfileStatus = "pending_genesis" | "anchored";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          wallet_address: string;
          season: string;
          realms: string[];
          status: ProfileStatus;
          created_at: string;
        };
        Insert: {
          wallet_address: string;
          season: string;
          realms: string[];
          status?: ProfileStatus;
          created_at?: string;
        };
        Update: {
          wallet_address?: string;
          season?: string;
          realms?: string[];
          status?: ProfileStatus;
          created_at?: string;
        };
      };
    };
  };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
