-- ============================================================
-- Migration: 20260309000001_integration_connectors
-- Integration connector framework for external system connections.
-- Supports inbound webhooks, outbound API calls, and bidirectional sync.
-- Phase 2, Sprint 6 — BE-01
-- ============================================================

CREATE TABLE integration_connectors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  provider        TEXT        NOT NULL,  -- 'webhook', 'custom_api', 'salesforce', 'xero', etc.
  direction       TEXT        NOT NULL DEFAULT 'inbound',  -- 'inbound' | 'outbound' | 'bidirectional'
  config          JSONB       NOT NULL DEFAULT '{}',  -- connection config (base_url, headers, event_type_mapping, etc.)
  credentials_ref TEXT,       -- env var name or secrets manager reference — NEVER actual secrets
  status          TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'paused' | 'error' | 'pending_auth' | 'archived'
  webhook_secret  TEXT,       -- HMAC secret for inbound webhook signature verification
  last_sync_at    TIMESTAMPTZ,
  created_by      TEXT        NOT NULL,  -- Clerk user ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT integration_connectors_direction_check CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  CONSTRAINT integration_connectors_status_check CHECK (status IN ('active', 'paused', 'error', 'pending_auth', 'archived'))
);

CREATE INDEX idx_integration_connectors_org ON integration_connectors(org_id, status);
CREATE INDEX idx_integration_connectors_provider ON integration_connectors(org_id, provider);

ALTER TABLE integration_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_connectors_org_rw ON integration_connectors
  USING (true)
  WITH CHECK (true);
