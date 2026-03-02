-- ============================================================
-- Migration: 20260302000000_core_schema
-- Ops OS — Core Database Schema
-- Phase 1, Sprint 1 — BE-01
--
-- Tables: orgs, blocks, block_edges, events (immutable),
--         workflow_jobs, embeddings
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─────────────────────────────────────────────────────────
-- orgs
-- Maps Clerk organization IDs to internal UUIDs.
-- Auto-provisioned on first login via withAuth middleware.
-- ─────────────────────────────────────────────────────────

CREATE TABLE orgs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT        NOT NULL UNIQUE,
  name         TEXT,
  slug         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; policy here for completeness
CREATE POLICY orgs_rw ON orgs
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- blocks
-- Stateful business entities: client, deal, project,
-- contact, contract. Connected in a graph via block_edges.
-- ─────────────────────────────────────────────────────────

CREATE TABLE blocks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL, -- 'client' | 'deal' | 'project' | 'contact' | 'contract'
  name       TEXT        NOT NULL,
  state      TEXT        NOT NULL DEFAULT 'active',
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocks_org_type ON blocks(org_id, type);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_org_rw ON blocks
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- block_edges
-- Directed graph edges between blocks within an org.
-- Self-loops are forbidden.
-- ─────────────────────────────────────────────────────────

CREATE TABLE block_edges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  from_block_id UUID        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  to_block_id   UUID        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  edge_type     TEXT        NOT NULL, -- e.g. 'has_contact', 'involves_deal', 'related_to'
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT block_edges_no_self_loop CHECK (from_block_id != to_block_id)
);

CREATE INDEX idx_block_edges_from ON block_edges(from_block_id);

ALTER TABLE block_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY block_edges_org_rw ON block_edges
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- events
-- Immutable append-only audit log. The compliance
-- foundation of Ops OS. No updated_at column.
--
-- Immutability is enforced at two levels:
--   1. RLS DENY policies for UPDATE and DELETE
--   2. Postgres triggers (enforced even for service role)
-- ─────────────────────────────────────────────────────────

CREATE TABLE events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  block_id    UUID        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL, -- e.g. 'block.created', 'block.updated', 'onboarding.started'
  actor_id    TEXT        NOT NULL, -- Clerk user ID — never from request body
  actor_type  TEXT        NOT NULL DEFAULT 'human', -- 'human' | 'ai' | 'system'
  payload     JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now() -- server-side always; no client override
  -- No updated_at — events are immutable
);

CREATE INDEX idx_events_block_occurred ON events(block_id, occurred_at);
CREATE INDEX idx_events_org_occurred   ON events(org_id, occurred_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow reads
CREATE POLICY events_select ON events
  FOR SELECT USING (true);

-- Allow inserts
CREATE POLICY events_insert ON events
  FOR INSERT WITH CHECK (true);

-- Deny updates (belt-and-suspenders; trigger below also enforces)
CREATE POLICY events_no_update ON events
  FOR UPDATE USING (false);

-- Deny deletes (belt-and-suspenders; trigger below also enforces)
CREATE POLICY events_no_delete ON events
  FOR DELETE USING (false);

-- Immutability function — raises exception for any UPDATE or DELETE attempt.
-- Triggers execute before the operation and run for ALL roles including
-- service_role (which bypasses RLS but NOT triggers).
CREATE OR REPLACE FUNCTION prevent_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Events are immutable — updates and deletes are not permitted (event id: %)', OLD.id
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER events_immutable_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

CREATE TRIGGER events_immutable_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

-- ─────────────────────────────────────────────────────────
-- workflow_jobs
-- Postgres-backed job queue (prototype tier).
-- Phase 2: replaced by Temporal for durable execution.
-- ─────────────────────────────────────────────────────────

CREATE TABLE workflow_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  block_id     UUID        REFERENCES blocks(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL, -- e.g. 'onboarding', 'deal_review', 'kyc_check'
  status       TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  payload      JSONB       NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_jobs_org_status
  ON workflow_jobs(org_id, status, scheduled_at);

ALTER TABLE workflow_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_jobs_org_rw ON workflow_jobs
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- embeddings
-- pgvector semantic memory. 1536 dimensions to match
-- OpenAI text-embedding-3-small (Claude API has no embeddings).
-- ─────────────────────────────────────────────────────────

CREATE TABLE embeddings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_type TEXT        NOT NULL, -- 'event' | 'block'
  source_id   UUID        NOT NULL,
  embedding   vector(1536),
  content     TEXT        NOT NULL, -- the original text that was embedded
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ivfflat index for approximate nearest-neighbour cosine search.
-- lists=100 appropriate for up to ~1M rows; rebuild at 10× growth.
CREATE INDEX idx_embeddings_ivfflat
  ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY embeddings_org_rw ON embeddings
  USING (true)
  WITH CHECK (true);
