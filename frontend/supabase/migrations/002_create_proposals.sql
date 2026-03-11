-- Mana OS: proposals table — community proposals with AI-generated resource plans.
-- Status: pending_resonance (awaiting community resonance/votes), then approved/rejected later.

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL REFERENCES profiles (wallet_address) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_plan JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_resonance',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_creator ON proposals (creator_wallet);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals (created_at DESC);

COMMENT ON TABLE proposals IS 'Community proposals with Oracle-generated resource plans. Status: pending_resonance (default), then governance flow.';
COMMENT ON COLUMN proposals.resource_plan IS 'JSON: naturalResources + humanCapital arrays from ProposalResourcePlan.';
