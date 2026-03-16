-- Macro-Arena: store competing theories and other extensible metadata (JSONB).
alter table public.truth_nodes
  add column if not exists metadata jsonb not null default '{}';

comment on column public.truth_nodes.metadata is 'Extensible metadata: e.g. { "competingTheories": [{ "assertionEn", "assertionHe" }, ...] } for macro-arenas.';
