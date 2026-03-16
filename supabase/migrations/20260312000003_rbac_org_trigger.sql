-- Auto-seed RBAC system roles when a new org is created.
-- Phase 3, Sprint 3, Task BE-02
--
-- Ensures every org gets the 3 system roles (ops-admin, ops-user, compliance-approver)
-- with their permission sets, without requiring application-level seeding.

CREATE OR REPLACE FUNCTION seed_rbac_for_new_org()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert 3 system roles
  INSERT INTO roles (org_id, name, display_name, description, is_system)
  VALUES
    (NEW.id, 'ops-admin', 'Admin', 'Full access to all features and settings.', true),
    (NEW.id, 'ops-user', 'User', 'Can view and edit blocks, run workflows, and approve tasks.', true),
    (NEW.id, 'compliance-approver', 'Compliance Approver', 'Read-only access with task approval rights for compliance review.', true)
  ON CONFLICT (org_id, name) DO NOTHING;

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
  WHERE r.org_id = NEW.id AND r.name = 'ops-admin' AND r.is_system = true
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
  WHERE r.org_id = NEW.id AND r.name = 'ops-user' AND r.is_system = true
  ON CONFLICT (role_id, permission) DO NOTHING;

  -- compliance-approver: 3 permissions
  INSERT INTO permission_groups (role_id, permission)
  SELECT r.id, p.permission
  FROM roles r
  CROSS JOIN (VALUES ('view_blocks'), ('approve_tasks'), ('view_audit_log')) AS p(permission)
  WHERE r.org_id = NEW.id AND r.name = 'compliance-approver' AND r.is_system = true
  ON CONFLICT (role_id, permission) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_rbac_for_new_org ON orgs;
CREATE TRIGGER trg_seed_rbac_for_new_org
  AFTER INSERT ON orgs
  FOR EACH ROW EXECUTE FUNCTION seed_rbac_for_new_org();
