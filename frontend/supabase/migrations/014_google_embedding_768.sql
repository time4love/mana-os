-- Unified Google embedding engine: gemini-embedding-001 with outputDimensionality 768.
-- Run this after switching from OpenAI text-embedding-3-small (1536) to Google gemini-embedding-001 (768).
-- Existing embeddings are dropped; new anchors will populate with 768-dim vectors.

drop function if exists match_truth_nodes(vector(1536), float, int);

alter table public.truth_nodes
  drop column if exists embedding;

alter table public.truth_nodes
  add column embedding vector(768);

comment on column public.truth_nodes.embedding is 'Vector for semantic search (Google gemini-embedding-001, 768 dimensions).';

create or replace function match_truth_nodes(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    truth_nodes.id,
    truth_nodes.content,
    1 - (truth_nodes.embedding <=> query_embedding) as similarity
  from truth_nodes
  where truth_nodes.embedding is not null
    and 1 - (truth_nodes.embedding <=> query_embedding) > match_threshold
  order by truth_nodes.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Epistemic constellations: same 768-dim switch
alter table public.epistemic_constellations
  drop column if exists embedding;

alter table public.epistemic_constellations
  add column embedding vector(768);

comment on column public.epistemic_constellations.embedding is 'Vector for similarity search (Google gemini-embedding-001, 768 dimensions).';

drop function if exists match_constellations(vector(1536), float, int);

create or replace function match_constellations(
  query_embedding vector(768),
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
