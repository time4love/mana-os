-- Enable pgvector if not already enabled
create extension if not exists vector;

-- 1. TRUTH NODES: The core concepts/arguments
create table public.truth_nodes (
    id uuid default gen_random_uuid() primary key,
    author_wallet text, -- nullable if we eventually support full anon, but recorded for SBT sync
    content text not null,
    embedding vector(1536), -- For OpenAI text-embedding-3-small
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. TRUTH EDGES: The DAG mapping
create type edge_relationship as enum ('supports', 'challenges', 'ai_analysis');

create table public.truth_edges (
    id uuid default gen_random_uuid() primary key,
    source_id uuid references public.truth_nodes(id) on delete cascade not null, -- The node being addressed
    target_id uuid references public.truth_nodes(id) on delete cascade not null, -- The node making the claim
    relationship edge_relationship not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(source_id, target_id) -- Prevent duplicating the exact same edge
);

-- 3. MATCHING FUNCTION (The Semantic Weaver)
-- Calculates cosine similarity to find highly similar canonical nodes
create or replace function match_truth_nodes(
    query_embedding vector(1536),
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
