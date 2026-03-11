-- Mana OS: Oracle Synthesis Loop — store the Oracle's Socratic reflection after weaving community wisdom.
-- When merged Upgrade Seeds exist, the Oracle can synthesize an updated resource plan and a short insight (תבוננות).

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS oracle_insight TEXT;

COMMENT ON COLUMN proposals.oracle_insight IS 'Socratic insight (תבוננות) from the Oracle after synthesizing community upgrade seeds into the proposal.';
