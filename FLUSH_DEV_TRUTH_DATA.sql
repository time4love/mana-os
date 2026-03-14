-- FLUSH_DEV_TRUTH_DATA.sql
-- Run this in the Supabase SQL Editor to clear testing/development Weave data.
-- Use only in dev; cascades will clear dependent rows.

TRUNCATE TABLE public.seed_discourse CASCADE;
TRUNCATE TABLE public.proposal_upgrades CASCADE;
TRUNCATE TABLE public.truth_edges CASCADE;
TRUNCATE TABLE public.truth_nodes CASCADE;
TRUNCATE TABLE public.epistemic_constellations CASCADE;
-- Done: Weave is entirely empty and clean for fractal deployment testing.
