-- Mana OS: Micro-Circle — flat discourse on Upgrade Seeds.
-- Strict depth: Main Proposal -> Upgrade Seed -> Flat Micro-Circle. No further nesting.

CREATE TABLE IF NOT EXISTS seed_discourse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upgrade_id UUID NOT NULL REFERENCES proposal_upgrades (id) ON DELETE CASCADE,
  author_wallet TEXT NOT NULL,
  wisdom TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seed_discourse_upgrade ON seed_discourse (upgrade_id);
CREATE INDEX IF NOT EXISTS idx_seed_discourse_created_at ON seed_discourse (created_at ASC);

COMMENT ON TABLE seed_discourse IS 'Flat refinement discourse on an upgrade seed. One level only; no nested threads.';
