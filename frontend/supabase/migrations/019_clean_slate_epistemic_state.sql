-- Clean Slate: Remove scores, add epistemic_state (Crossfire Arena).
-- Run after wiping data. New nodes get epistemic_state from default.

-- 1. Wipe existing data
TRUNCATE TABLE truth_edges CASCADE;
TRUNCATE TABLE truth_resonances CASCADE;
TRUNCATE TABLE truth_nodes CASCADE;

-- 2. Drop legacy score column
ALTER TABLE truth_nodes DROP COLUMN IF EXISTS logical_coherence_score;

-- 3. Epistemic state enum
DO $$ BEGIN
    CREATE TYPE epistemic_state_enum AS ENUM ('SOLID', 'CONTESTED', 'SHATTERED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. New column (default SOLID)
ALTER TABLE truth_nodes ADD COLUMN IF NOT EXISTS epistemic_state epistemic_state_enum DEFAULT 'SOLID';
