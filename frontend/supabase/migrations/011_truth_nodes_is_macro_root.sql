-- Macro-root flag: only these nodes appear on the /truth hub (document theses, standalone premises).
-- Child claims from Epistemic Prism stay hidden until user dives into the macro node.
alter table public.truth_nodes
  add column if not exists is_macro_root boolean not null default false;

comment on column public.truth_nodes.is_macro_root is 'True for document theses and standalone premises; false for extracted sub-claims. Hub shows only macro roots.';

-- Index for fast hub listing
create index if not exists idx_truth_nodes_is_macro_root_created_at
  on public.truth_nodes (is_macro_root, created_at desc)
  where is_macro_root = true;

-- Backfill: nodes that are never a target (no parent) are macro roots
update public.truth_nodes n
set is_macro_root = true
where not exists (
  select 1 from public.truth_edges e where e.target_id = n.id
);
