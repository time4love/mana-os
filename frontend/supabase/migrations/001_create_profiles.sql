-- Mana OS: profiles table — maps Web3 wallet to declared Soul Contract (season + realms).
-- A "Registered User" is a row here: wallet_address + season + realms + status.

CREATE TABLE IF NOT EXISTS profiles (
  wallet_address TEXT PRIMARY KEY,
  season TEXT NOT NULL,
  realms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_genesis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups by status (e.g. pending_genesis for mentor flows).
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles (status);

-- Optional: allow updating season/realms when user re-anchors.
COMMENT ON TABLE profiles IS 'Off-chain Soul Contracts: wallet → season + realms. Status: pending_genesis | anchored.';
