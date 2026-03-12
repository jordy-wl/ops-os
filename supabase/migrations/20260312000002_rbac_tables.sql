-- RBAC Tables: roles, permission_groups, user_permissions
-- Phase 3, Sprint 3, Task BE-01
--
-- Creates a custom RBAC engine independent of Clerk.
-- Seeds 3 system roles (ops-admin, ops-user, compliance-approver) per org.
-- Migrates existing user_roles data into user_permissions.

-- ─── 1. Roles table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  is_system    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_org_id ON roles (org_id);

-- ─── 2. Permission groups (role → permission junction) ──────────────────────

CREATE TABLE IF NOT EXISTS permission_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_permission_groups_role_id ON permission_groups (role_id);

-- ─── 3. User permissions (user → role per org) ─────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  org_id      UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role_id     UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_org_user ON user_permissions (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_role_id ON user_permissions (role_id);

-- ─── 4. System role protection trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_system_role_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'System roles cannot be modified or deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Prevent UPDATE of system role core fields
CREATE OR REPLACE FUNCTION prevent_system_role_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true AND (
    NEW.name != OLD.name OR
    NEW.is_system != OLD.is_system
  ) THEN
    RAISE EXCEPTION 'System role name and is_system flag cannot be changed';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_system_role_delete ON roles;
CREATE TRIGGER trg_prevent_system_role_delete
  BEFORE DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION prevent_system_role_mutation();

DROP TRIGGER IF EXISTS trg_prevent_system_role_update ON roles;
CREATE TRIGGER trg_prevent_system_role_update
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION prevent_system_role_update();

-- ─── 5. Seed system roles for all existing orgs ────────────────────────────

-- ops-admin
INSERT INTO roles (org_id, name, display_name, description, is_system)
SELECT id, 'ops-admin', 'Admin', 'Full access to all features and settings.', true
FROM orgs
ON CONFLICT (org_id, name) DO NOTHING;

-- ops-user
INSERT INTO roles (org_id, name, display_name, description, is_system)
SELECT id, 'ops-user', 'User', 'Can view and edit blocks, run workflows, and approve tasks.', true
FROM orgs
ON CONFLICT (org_id, name) DO NOTHING;

-- compliance-approver
INSERT INTO roles (org_id, name, display_name, description, is_system)
SELECT id, 'compliance-approver', 'Compliance Approver', 'Read-only access with task approval rights for compliance review.', true
FROM orgs
ON CONFLICT (org_id, name) DO NOTHING;

-- ─── 6. Seed permission_groups for system roles ────────────────────────────

-- ops-admin: all 10 permissions
INSERT INTO permission_groups (role_id, permission)
SELECT r.id, p.permission
FROM roles r
CROSS JOIN (
  VALUES
    ('manage_blocks'), ('edit_blocks'), ('view_blocks'),
    ('manage_workflows'), ('execute_workflows'), ('approve_tasks'),
    ('manage_team'), ('manage_settings'), ('manage_integrations'),
    ('view_audit_log')
) AS p(permission)
WHERE r.name = 'ops-admin' AND r.is_system = true
ON CONFLICT (role_id, permission) DO NOTHING;

-- ops-user: 5 permissions
INSERT INTO permission_groups (role_id, permission)
SELECT r.id, p.permission
FROM roles r
CROSS JOIN (
  VALUES
    ('view_blocks'), ('edit_blocks'), ('execute_workflows'),
    ('approve_tasks'), ('view_audit_log')
) AS p(permission)
WHERE r.name = 'ops-user' AND r.is_system = true
ON CONFLICT (role_id, permission) DO NOTHING;

-- compliance-approver: 3 permissions
INSERT INTO permission_groups (role_id, permission)
SELECT r.id, p.permission
FROM roles r
CROSS JOIN (VALUES ('view_blocks'), ('approve_tasks'), ('view_audit_log')) AS p(permission)
WHERE r.name = 'compliance-approver' AND r.is_system = true
ON CONFLICT (role_id, permission) DO NOTHING;

-- ─── 7. Migrate existing user_roles → user_permissions ─────────────────────

INSERT INTO user_permissions (user_id, org_id, role_id, assigned_by, assigned_at)
SELECT
  ur.user_id,
  ur.org_id,
  r.id AS role_id,
  'system-migration' AS assigned_by,
  ur.created_at AS assigned_at
FROM user_roles ur
JOIN roles r ON r.org_id = ur.org_id AND r.name = ur.role AND r.is_system = true
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ─── 8. RLS Policies ───────────────────────────────────────────────────────

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. These policies are for direct client access if needed.
-- Read access: users can see roles/permissions in their own org
CREATE POLICY roles_select_org ON roles
  FOR SELECT USING (true);

CREATE POLICY permission_groups_select ON permission_groups
  FOR SELECT USING (true);

CREATE POLICY user_permissions_select_org ON user_permissions
  FOR SELECT USING (true);

-- Write access: controlled at API layer via requirePermission('manage_team')
-- Service role (used by API routes) bypasses RLS automatically
CREATE POLICY roles_insert_service ON roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY roles_update_service ON roles
  FOR UPDATE USING (true);

CREATE POLICY roles_delete_service ON roles
  FOR DELETE USING (true);

CREATE POLICY permission_groups_insert_service ON permission_groups
  FOR INSERT WITH CHECK (true);

CREATE POLICY permission_groups_delete_service ON permission_groups
  FOR DELETE USING (true);

CREATE POLICY user_permissions_insert_service ON user_permissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY user_permissions_update_service ON user_permissions
  FOR UPDATE USING (true);

CREATE POLICY user_permissions_delete_service ON user_permissions
  FOR DELETE USING (true);
