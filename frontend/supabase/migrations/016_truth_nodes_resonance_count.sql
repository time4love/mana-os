-- Epistemic Resonance: community overrule multiplier (Phase 10 Step 11).
-- Each resonance from a verified human increases the node's logical mass in the Bubbling Algorithm.
alter table public.truth_nodes
  add column if not exists resonance_count integer not null default 0;

comment on column public.truth_nodes.resonance_count is 'Number of Epistemic Resonance votes from verified SBT holders. Used as multiplier: Node Mass = Base Score * (1 + resonance_count * 0.2).';
