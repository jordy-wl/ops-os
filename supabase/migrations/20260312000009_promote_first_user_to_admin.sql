-- Promote the first user in each org to ops-admin if no admin exists.
-- Fixes orgs that were created before the RBAC trigger was added.
WITH admin_roles AS (
  SELECT r.id AS role_id, r.org_id
  FROM roles r
  WHERE r.name = 'ops-admin' AND r.is_system = true
),
orgs_without_admin AS (
  SELECT ar.org_id, ar.role_id
  FROM admin_roles ar
  WHERE NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.org_id = ar.org_id AND up.role_id = ar.role_id
  )
),
first_user AS (
  SELECT DISTINCT ON (up.org_id) up.id, owa.role_id
  FROM user_permissions up
  JOIN orgs_without_admin owa ON owa.org_id = up.org_id
  ORDER BY up.org_id, up.assigned_at ASC
)
UPDATE user_permissions
SET role_id = fu.role_id, assigned_by = 'system-first-admin'
FROM first_user fu
WHERE user_permissions.id = fu.id;
