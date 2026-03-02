-- Migration: 20260302000004_rbac.sql
-- Adds RBAC user_roles table for per-org role assignment.
-- Roles: ops-admin | ops-user | compliance-approver

CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,       -- Clerk user ID (e.g. "user_abc123")
  role       TEXT        NOT NULL CHECK (role IN ('ops-admin', 'ops-user', 'compliance-approver')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_roles_org_user_idx ON user_roles (org_id, user_id);
