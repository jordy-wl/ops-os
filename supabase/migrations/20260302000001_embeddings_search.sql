-- ============================================================
-- Migration: 20260302000001_embeddings_search
-- Ops OS — Embeddings Similarity Search Function
-- Phase 1, Sprint 1 — DE-02
--
-- Adds a PostgreSQL function for cosine similarity search
-- over the embeddings table. Called via Supabase RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_count     int  DEFAULT 10,
  filter_org_id   uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  org_id      uuid,
  source_type text,
  source_id   uuid,
  content     text,
  similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.org_id,
    e.source_type,
    e.source_id,
    e.content,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE
    (filter_org_id IS NULL OR e.org_id = filter_org_id)
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
