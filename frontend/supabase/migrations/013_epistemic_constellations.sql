-- Epistemic Constellations: abstractive summaries of macro-thematic groups (Graph RAG layer)
-- The Cartographer agent maintains living_summary per theme; match_constellations enables Forest-level search.

create table if not exists public.epistemic_constellations (
  id uuid default gen_random_uuid() primary key,
  theme_name text not null unique,
  living_summary text not null default '',
  embedding vector(1536),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.epistemic_constellations is 'Cartographer-maintained abstractive summaries per thematic constellation for Graph RAG (Forest view).';
comment on column public.epistemic_constellations.living_summary is 'Synthesized overview: established pillars, broken premises, burning debate fronts.';
comment on column public.epistemic_constellations.embedding is 'Vector of theme_name + living_summary for similarity search (OpenAI text-embedding-3-small).';

create or replace function match_constellations(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  theme_name text,
  living_summary text,
  similarity float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    epistemic_constellations.id,
    epistemic_constellations.theme_name,
    epistemic_constellations.living_summary,
    1 - (epistemic_constellations.embedding <=> query_embedding) as similarity
  from epistemic_constellations
  where epistemic_constellations.embedding is not null
    and 1 - (epistemic_constellations.embedding <=> query_embedding) > match_threshold
  order by epistemic_constellations.embedding <=> query_embedding
  limit match_count;
end;
$$;
