-- Migration: create_api_keys_table
-- Phase 3 Sprint 8 — API key management (P3-S8-BE-02)
--
-- Stores hashed API keys for org-scoped external integrations.
-- The full key is NEVER stored — only the SHA-256 hash and an 8-char prefix for display.

CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  key_prefix  text        NOT NULL,       -- first 8 chars of key for identification
  key_hash    text        NOT NULL,       -- SHA-256 hex digest of the full key
  created_by  text        NOT NULL,       -- Clerk user ID
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,                -- NULL = active; set = revoked
  last_used_at timestamptz,               -- updated on each successful validation
  rate_limit  integer     NOT NULL DEFAULT 100
);

-- Index for lookup by org (list keys)
CREATE INDEX idx_api_keys_org ON api_keys(org_id);

-- Index for lookup by hash (validate key)
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Org-scoped read access
CREATE POLICY "Users can view own org api_keys"
  ON api_keys FOR SELECT
  USING (org_id IN (SELECT id FROM orgs));

-- Service role can insert (keys created via API)
CREATE POLICY "System can insert api_keys"
  ON api_keys FOR INSERT
  WITH CHECK (true);

-- Service role can update (revoke, update last_used_at)
CREATE POLICY "System can update api_keys"
  ON api_keys FOR UPDATE
  USING (true);
