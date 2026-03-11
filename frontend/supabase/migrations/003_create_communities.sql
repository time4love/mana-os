-- Mana OS: communities (seeds) and community_members (resonators).
-- Communities start as seeds in pending_manifestation; Oracle calculates required_critical_mass.
-- When enough members join, the seed sprouts (status updated elsewhere or via app logic).

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  vision TEXT NOT NULL DEFAULT '',
  required_critical_mass INTEGER NOT NULL CHECK (required_critical_mass > 0),
  status TEXT NOT NULL DEFAULT 'pending_manifestation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  community_id UUID NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_communities_status ON communities (status);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_wallet ON community_members (wallet_address);

COMMENT ON TABLE communities IS 'Community seeds: vision + Oracle-calculated critical mass. Status: pending_manifestation, then manifested.';
COMMENT ON TABLE community_members IS 'Pivot: who has resonated (watered the seed) for each community.';
COMMENT ON COLUMN communities.required_critical_mass IS 'Minimum members needed for the vision to become sustainable (calculated by Genesis Oracle).';
