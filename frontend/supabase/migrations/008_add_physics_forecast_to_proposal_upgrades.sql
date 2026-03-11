-- Mana OS: Physics Forecast (תחזית פיזיקלית) — show resource/mana deltas for upgrade seeds before merge.
-- Enables resonant choices: community sees the physical cost (water, Mana Cycles, etc.) of each seed.

ALTER TABLE proposal_upgrades
  ADD COLUMN IF NOT EXISTS physics_forecast JSONB;

COMMENT ON COLUMN proposal_upgrades.physics_forecast IS 'Array of deltas: [{ "category": "Natural"|"Human", "name": "Water"|"Agriculture Cycle", "change": "+50 liters"|"+1" }]. Physical impact of this upgrade seed.';
