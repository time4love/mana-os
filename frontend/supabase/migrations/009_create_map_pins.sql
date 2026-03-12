-- Mana OS: The Awakening Map — pins for Vision Seeds, Abundance Anchors, Resource Pledges.
-- Simulation mode: users drop pins to transmute the map with regenerative intent.

CREATE TABLE IF NOT EXISTS map_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,
  pin_type TEXT NOT NULL CHECK (pin_type IN ('vision_seed', 'abundance_anchor', 'resource_pledge')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_pins_created_at ON map_pins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_pins_pin_type ON map_pins (pin_type);
CREATE INDEX IF NOT EXISTS idx_map_pins_creator ON map_pins (creator_wallet);

COMMENT ON TABLE map_pins IS 'Pins on The Awakening Map: vision seeds, abundance anchors, resource pledges.';
