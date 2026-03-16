-- flush_truth_weave.sql
-- Clears all Truth Engine data (nodes + edges) so you can create new arenas from scratch.
-- Run in the Supabase SQL Editor. Use only in dev/staging.

-- Edges reference nodes; truncate edges first, then nodes (or use CASCADE on nodes).
TRUNCATE TABLE public.truth_edges CASCADE;
TRUNCATE TABLE public.truth_nodes CASCADE;

-- Optional: reset epistemic constellations if you use them for theme summaries.
-- TRUNCATE TABLE public.epistemic_constellations CASCADE;
