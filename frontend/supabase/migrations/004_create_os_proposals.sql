-- Mana OS: Open-source feature proposals from the Architect Oracle.
-- Users and contributors propose features; philosophical_alignment explains how the idea aligns with UBA, Resonance, trauma-informed design, etc.

CREATE TABLE IF NOT EXISTS os_feature_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_wallet TEXT NOT NULL,
  title TEXT NOT NULL,
  philosophical_alignment TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_feature_proposals_status ON os_feature_proposals (status);
CREATE INDEX IF NOT EXISTS idx_os_feature_proposals_proposer ON os_feature_proposals (proposer_wallet);
CREATE INDEX IF NOT EXISTS idx_os_feature_proposals_created_at ON os_feature_proposals (created_at DESC);

COMMENT ON TABLE os_feature_proposals IS 'Open-source feature proposals submitted via the Architect Oracle; status: pending_review, accepted, deferred.';
