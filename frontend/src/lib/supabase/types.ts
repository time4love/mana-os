/**
 * Supabase database types for Mana OS.
 * Profiles table: wallet → Soul Contract (season + realms).
 * Proposals table: community proposals with Oracle resource plans.
 */

export type ProfileStatus = "pending_genesis" | "anchored";

export type ProposalStatus = "pending_resonance" | "approved" | "rejected";

export type CommunityStatus = "pending_manifestation" | "manifested";

export type OsFeatureProposalStatus = "pending_review" | "accepted" | "deferred";

export type ProposalUpgradeStatus = "pending" | "merged";

export type MapPinType = "vision_seed" | "abundance_anchor" | "resource_pledge";

/** Single delta in the Physics Forecast: added or reduced resource / Mana Cycle for an upgrade seed. */
export interface PhysicsForecastDeltaJson {
  category: string;
  name: string;
  change: string;
}

export interface ProposalResourcePlanJson {
  naturalResources: Array<{
    resourceName: string;
    quantity: number;
    unit: string;
  }>;
  humanCapital: Array<{
    requiredSkillCategory: string;
    requiredLevel: number;
    manaCycles: number;
  }>;
}

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
      proposals: {
        Row: {
          id: string;
          creator_wallet: string;
          title: string;
          description: string;
          resource_plan: ProposalResourcePlanJson;
          status: ProposalStatus;
          created_at: string;
          oracle_insight: string | null;
        };
        Insert: {
          id?: string;
          creator_wallet: string;
          title: string;
          description: string;
          resource_plan: ProposalResourcePlanJson;
          status?: ProposalStatus;
          created_at?: string;
          oracle_insight?: string | null;
        };
        Update: {
          id?: string;
          creator_wallet?: string;
          title?: string;
          description?: string;
          resource_plan?: ProposalResourcePlanJson;
          status?: ProposalStatus;
          created_at?: string;
          oracle_insight?: string | null;
        };
      };
      communities: {
        Row: {
          id: string;
          founder_wallet: string;
          name: string;
          vision: string;
          required_critical_mass: number;
          status: CommunityStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          founder_wallet: string;
          name: string;
          vision: string;
          required_critical_mass: number;
          status?: CommunityStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          founder_wallet?: string;
          name?: string;
          vision?: string;
          required_critical_mass?: number;
          status?: CommunityStatus;
          created_at?: string;
        };
      };
      community_members: {
        Row: {
          community_id: string;
          wallet_address: string;
          joined_at: string;
        };
        Insert: {
          community_id: string;
          wallet_address: string;
          joined_at?: string;
        };
        Update: {
          community_id?: string;
          wallet_address?: string;
          joined_at?: string;
        };
      };
      os_feature_proposals: {
        Row: {
          id: string;
          proposer_wallet: string;
          title: string;
          philosophical_alignment: string;
          description: string;
          status: OsFeatureProposalStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposer_wallet: string;
          title: string;
          philosophical_alignment: string;
          description: string;
          status?: OsFeatureProposalStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposer_wallet?: string;
          title?: string;
          philosophical_alignment?: string;
          description?: string;
          status?: OsFeatureProposalStatus;
          created_at?: string;
        };
      };
      proposal_upgrades: {
        Row: {
          id: string;
          proposal_id: string;
          author_wallet: string;
          suggested_upgrade: string;
          resonance_count: number;
          status: ProposalUpgradeStatus;
          created_at: string;
          physics_forecast: PhysicsForecastDeltaJson[] | null;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          author_wallet: string;
          suggested_upgrade: string;
          resonance_count?: number;
          status?: ProposalUpgradeStatus;
          created_at?: string;
          physics_forecast?: PhysicsForecastDeltaJson[] | null;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          author_wallet?: string;
          suggested_upgrade?: string;
          resonance_count?: number;
          status?: ProposalUpgradeStatus;
          created_at?: string;
          physics_forecast?: PhysicsForecastDeltaJson[] | null;
        };
      };
      seed_discourse: {
        Row: {
          id: string;
          upgrade_id: string;
          author_wallet: string;
          wisdom: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          upgrade_id: string;
          author_wallet: string;
          wisdom: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          upgrade_id?: string;
          author_wallet?: string;
          wisdom?: string;
          created_at?: string;
        };
      };
      map_pins: {
        Row: {
          id: string;
          creator_wallet: string;
          pin_type: MapPinType;
          lat: number;
          lng: number;
          title: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_wallet: string;
          pin_type: MapPinType;
          lat: number;
          lng: number;
          title: string;
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_wallet?: string;
          pin_type?: MapPinType;
          lat?: number;
          lng?: number;
          title?: string;
          description?: string;
          created_at?: string;
        };
      };
    };
  };
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];
export type CommunityRow = Database["public"]["Tables"]["communities"]["Row"];
export type CommunityMemberRow = Database["public"]["Tables"]["community_members"]["Row"];
export type OsFeatureProposalRow = Database["public"]["Tables"]["os_feature_proposals"]["Row"];
export type ProposalUpgradeRow = Database["public"]["Tables"]["proposal_upgrades"]["Row"];
export type SeedDiscourseRow = Database["public"]["Tables"]["seed_discourse"]["Row"];
export type MapPinRow = Database["public"]["Tables"]["map_pins"]["Row"];
