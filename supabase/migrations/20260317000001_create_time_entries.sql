-- ============================================================
-- Migration: 20260317000001_create_time_entries
-- Time tracking entries for the Productivity Suite.
-- Supports running timers (ended_at IS NULL) and completed entries.
-- Phase 6, Sprint 18 — BE-01
-- ============================================================

CREATE TABLE time_entries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id           TEXT        NOT NULL,  -- Clerk user ID
  block_id          UUID        REFERENCES blocks(id) ON DELETE SET NULL,
  description       TEXT        DEFAULT '',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,  -- NULL = timer is running
  duration_seconds  INTEGER,      -- computed on stop; NULL while running
  is_billable       BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query pattern: user's entries in date range
CREATE INDEX idx_time_entries_user ON time_entries(org_id, user_id, started_at DESC);

-- Find running timer (ended_at IS NULL)
CREATE INDEX idx_time_entries_active ON time_entries(org_id, user_id) WHERE ended_at IS NULL;

-- Block-level time aggregation
CREATE INDEX idx_time_entries_block ON time_entries(block_id) WHERE block_id IS NOT NULL;

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_entries_org_rw ON time_entries
  USING (true)
  WITH CHECK (true);
