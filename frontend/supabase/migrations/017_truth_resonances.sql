-- Sybil resistance: one wallet = one resonance per node (toggle mechanic).
-- Junction table enforces PRIMARY KEY (node_id, wallet_address) so the same wallet cannot resonate twice.
create table if not exists public.truth_resonances (
  node_id uuid not null references public.truth_nodes(id) on delete cascade,
  wallet_address text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (node_id, wallet_address)
);

create index if not exists idx_truth_resonances_wallet on public.truth_resonances(wallet_address);

comment on table public.truth_resonances is 'One resonance per wallet per node; toggle on/off for Epistemic Resonance (Phase 10 Step 11).';
