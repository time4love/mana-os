-- Thematic constellations: macro-theme tags for truth_nodes (Cosmology, Space Hoax, etc.)
alter table public.truth_nodes
  add column if not exists thematic_tags text[] default '{}';

comment on column public.truth_nodes.thematic_tags is 'Up to ~3 macro-themes for hub grouping and constellation UX (e.g. Cosmology, Finance, Space Hoax).';
