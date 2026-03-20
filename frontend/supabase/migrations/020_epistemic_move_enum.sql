-- Epistemic Move categorization (replacing 0-100 scores).
-- Each claim is classified by tactical nature: Empirical Contradiction, Ad-Hoc Rescue, etc.

-- 1. Create enum for epistemic moves
DO $$ BEGIN
    CREATE TYPE epistemic_move_enum AS ENUM (
        'EMPIRICAL_CONTRADICTION',
        'INTERNAL_INCONSISTENCY',
        'EMPIRICAL_VERIFICATION',
        'AD_HOC_RESCUE',
        'APPEAL_TO_AUTHORITY'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add column to truth_nodes (which move this claim performs)
ALTER TABLE truth_nodes ADD COLUMN IF NOT EXISTS epistemic_move epistemic_move_enum;
