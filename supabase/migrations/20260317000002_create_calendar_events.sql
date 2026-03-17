-- ============================================================
-- Migration: 20260317000002_create_calendar_events
-- Calendar events for the Productivity Suite.
-- Supports local events and synced Google Calendar events.
-- Phase 6, Sprint 19 — BE-01
-- ============================================================

CREATE TABLE calendar_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id         TEXT        NOT NULL,  -- Clerk user ID
  title           TEXT        NOT NULL,
  description     TEXT        DEFAULT '',
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  all_day         BOOLEAN     NOT NULL DEFAULT false,
  source          TEXT        NOT NULL DEFAULT 'local',  -- 'local' | 'google'
  external_id     TEXT,        -- Google Calendar event ID
  external_link   TEXT,        -- Link to event in Google Calendar
  color           TEXT        DEFAULT 'primary',
  block_id        UUID        REFERENCES blocks(id) ON DELETE SET NULL,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_source_check CHECK (source IN ('local', 'google'))
);

-- Primary query: user's events in date range
CREATE INDEX idx_calendar_events_user_range ON calendar_events(org_id, user_id, start_at, end_at);

-- Dedup Google events by external_id
CREATE UNIQUE INDEX idx_calendar_events_external ON calendar_events(org_id, external_id) WHERE external_id IS NOT NULL;

-- Block-linked events
CREATE INDEX idx_calendar_events_block ON calendar_events(block_id) WHERE block_id IS NOT NULL;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_org_rw ON calendar_events
  USING (true)
  WITH CHECK (true);
