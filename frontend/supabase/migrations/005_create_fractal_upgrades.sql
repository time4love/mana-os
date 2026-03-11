-- Mana OS: Fractal Refinement Circle — Upgrade Seeds.
-- Community ideas are "Upgrade Seeds" that, when resonated with, merge into the core proposal.
-- As above, so below: the proposal is the center; upgrades orbit until they become part of the vision.

CREATE TABLE IF NOT EXISTS proposal_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
  author_wallet TEXT NOT NULL,
  suggested_upgrade TEXT NOT NULL,
  resonance_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_upgrade_resonances (
  upgrade_id UUID NOT NULL REFERENCES proposal_upgrades (id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (upgrade_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_proposal_upgrades_proposal ON proposal_upgrades (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_upgrades_status ON proposal_upgrades (status);
CREATE INDEX IF NOT EXISTS idx_proposal_upgrades_created_at ON proposal_upgrades (created_at ASC);
CREATE INDEX IF NOT EXISTS idx_proposal_upgrade_resonances_upgrade ON proposal_upgrade_resonances (upgrade_id);

COMMENT ON TABLE proposal_upgrades IS 'Fractal Refinement Circle: community upgrade seeds for a proposal. pending → merged when resonance threshold reached.';
COMMENT ON COLUMN proposal_upgrades.suggested_upgrade IS 'The community-suggested improvement to the proposal (Upgrade Seed).';
COMMENT ON TABLE proposal_upgrade_resonances IS 'One resonance per wallet per upgrade; prevents double-counting.';
