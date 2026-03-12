# Sprint 3 — Backend Tasks

## P3-S3-BE-01 — RBAC Data Model Migration

**Complexity:** HIGH
**Priority:** 1 (start immediately -- on critical path)
**Dependencies:** None (Sprint 2 complete is a sprint-level prerequisite)
**Applicable Gates:** G1, G2, G3, G5, G6
**Assigned Role:** Backend Engineer
**Estimate:** 3 days

### Description

Create the database schema for a custom RBAC engine. Migrate the existing 3 hardcoded roles (ops-admin, ops-user, compliance-approver) into the new system as default system roles. Define 10 granular permissions.

### What to Build

1. **New tables via Supabase migration:**

   **`roles` table:**
   - `id` (uuid, PK)
   - `org_id` (uuid, FK to orgs)
   - `name` (text, unique per org)
   - `display_name` (text)
   - `description` (text)
   - `is_system` (boolean, default false) -- system roles cannot be deleted or renamed
   - `created_at`, `updated_at` (timestamptz)

   **`permission_groups` table:**
   - `id` (uuid, PK)
   - `role_id` (uuid, FK to roles, ON DELETE CASCADE)
   - `permission` (text, one of the 10 permission slugs)
   - Unique constraint on (role_id, permission)

   **`user_permissions` table:**
   - `id` (uuid, PK)
   - `user_id` (text, Clerk user ID)
   - `org_id` (uuid, FK to orgs)
   - `role_id` (uuid, FK to roles)
   - `assigned_by` (text, Clerk user ID)
   - `assigned_at` (timestamptz)
   - Unique constraint on (user_id, org_id) -- one role per user per org

2. **10 permissions:**
   - `manage_blocks` -- create, delete block types and blocks
   - `edit_blocks` -- update existing blocks
   - `view_blocks` -- read blocks
   - `manage_workflows` -- create, edit, delete workflow templates
   - `execute_workflows` -- trigger workflow instances
   - `approve_tasks` -- approve/reject task queue items
   - `manage_team` -- invite, remove, change roles of team members
   - `manage_settings` -- modify org settings, integrations
   - `manage_integrations` -- configure integration connectors
   - `view_audit_log` -- read events/audit trail

3. **System role seed data:**
   - `ops-admin`: all 10 permissions
   - `ops-user`: view_blocks, edit_blocks, execute_workflows, approve_tasks, view_audit_log
   - `compliance-approver`: view_blocks, approve_tasks, view_audit_log

4. **RLS policies:**
   - Users can only query roles/permissions within their own org
   - Only users with `manage_team` can modify user_permissions
   - System roles are read-only (cannot be updated or deleted)

### Files to Create

- `supabase/migrations/[timestamp]_rbac_tables.sql`
- `src/lib/rbac/types.ts` (Permission enum, Role types)
- `src/lib/rbac/constants.ts` (system role definitions, permission list)

### Acceptance Criteria

- [ ] All 3 tables created with correct constraints and indexes
- [ ] 10 permissions defined as a TypeScript enum and in the database
- [ ] 3 system roles seeded with correct permission mappings
- [ ] RLS policies enforce org-level isolation
- [ ] System roles cannot be deleted (constraint or RLS)
- [ ] Migration is idempotent and runs on both local and production
- [ ] Integration test validates table creation and seed data

---

## P3-S3-BE-02 — Refactor withAuth.ts for Granular RBAC

**Complexity:** HIGH
**Priority:** 2 (after BE-01)
**Dependencies:** P3-S3-BE-01
**Applicable Gates:** G1, G2, G3, G5, G6
**Assigned Role:** Backend Engineer
**Estimate:** 3 days

### Description

Refactor the `withAuth()` middleware to resolve permissions instead of just roles. The current `resolveRole()` function returns a role string; the new `resolvePermissions()` returns an `AuthContext` object with a `permissions: Set<Permission>` field. This must be backward compatible -- existing code that checks roles must continue to work.

### What to Build

1. **New AuthContext type:**
   ```typescript
   interface AuthContext {
     userId: string
     orgId: string
     role: string          // keep for backward compat
     roleId: string        // new: UUID from roles table
     permissions: Set<Permission>  // new: resolved from permission_groups
   }
   ```

2. **`resolvePermissions(userId, orgId)`:**
   - Query `user_permissions` JOIN `permission_groups` to get all permissions for this user in this org
   - If no explicit assignment exists, fall back to `ops-user` system role (safe default)
   - Cache per-request to avoid repeated DB queries

3. **Backward compatibility:**
   - `withAuth()` still returns `auth.role` as a string
   - Existing `requireRole('ops-admin')` calls still work
   - New `requirePermission('manage_blocks')` available as an alternative

4. **Update withAuth wrapper signature:**
   - Handler now receives `AuthContext` instead of just `{ userId, orgId, role }`
   - TypeScript types updated, but runtime behavior unchanged for existing code

### Files to Modify

- `src/middleware/withAuth.ts` (or `src/lib/auth/withAuth.ts`)
- `src/lib/rbac/resolve.ts` (new: permission resolution logic)

### Acceptance Criteria

- [ ] `resolvePermissions()` returns correct permissions for each system role
- [ ] `AuthContext` includes both `role` (string) and `permissions` (Set)
- [ ] Existing `requireRole()` checks continue to work unchanged
- [ ] New `requirePermission()` function available for use
- [ ] Default role assignment works for users without explicit assignment
- [ ] All existing API route tests pass without modification (backward compat proof)
- [ ] Integration test: user with custom role gets correct permission set

---

## P3-S3-BE-03 — Permission Enforcement Middleware

**Complexity:** HIGH
**Priority:** 3 (after BE-02)
**Dependencies:** P3-S3-BE-02
**Applicable Gates:** G1, G2, G3, G5, G6
**Assigned Role:** Backend Engineer
**Estimate:** 2.5 days

### Description

Create a `requirePermission()` wrapper that replaces `requireRole()` and apply it to all existing API routes. This is the enforcement layer -- while BE-02 resolves permissions, BE-03 checks them at the route level.

### What to Build

1. **`requirePermission(...permissions: Permission[])` wrapper:**
   - Takes one or more required permissions
   - Returns 403 if the user lacks any of the required permissions
   - Error response includes which permission was missing (safe to expose)
   - Can be composed: `requirePermission('manage_blocks', 'edit_blocks')` requires ALL listed

2. **Apply to all existing routes:**

   | Route | Current Check | New Permission |
   |-------|--------------|----------------|
   | POST /api/blocks | requireRole('ops-admin') | requirePermission('manage_blocks') |
   | PATCH /api/blocks/[id] | requireRole('ops-admin') | requirePermission('edit_blocks') |
   | GET /api/blocks | requireRole('ops-user') | requirePermission('view_blocks') |
   | POST /api/actions/[type] | requireRole('ops-admin') | requirePermission('manage_blocks') |
   | POST /api/workflows | requireRole('ops-admin') | requirePermission('manage_workflows') |
   | POST /api/workflows/[id]/trigger | requireRole('ops-user') | requirePermission('execute_workflows') |
   | PATCH /api/tasks/[id] | requireRole('ops-user') | requirePermission('approve_tasks') |
   | GET /api/events | requireRole('ops-user') | requirePermission('view_audit_log') |
   | POST /api/integrations | requireRole('ops-admin') | requirePermission('manage_integrations') |
   | PATCH /api/settings | requireRole('ops-admin') | requirePermission('manage_settings') |

3. **Deprecation path:**
   - Mark `requireRole()` as deprecated with JSDoc comment
   - Keep it working (delegates to permission check internally)
   - Log a warning when `requireRole()` is used (dev only)

### Files to Modify

- `src/middleware/withAuth.ts` (add requirePermission)
- All API route files listed above
- `src/lib/rbac/middleware.ts` (new: requirePermission implementation)

### Acceptance Criteria

- [ ] `requirePermission()` correctly enforces one or more permissions
- [ ] 403 response returned with descriptive error when permission denied
- [ ] All existing API routes migrated from `requireRole()` to `requirePermission()`
- [ ] ops-admin users can still access everything (all 10 permissions)
- [ ] ops-user users have correct subset of access
- [ ] compliance-approver users can view + approve but not create/edit
- [ ] Integration tests cover each role accessing routes they should/should not access

---

## P3-S3-BE-04 — Team Member CRUD API

**Complexity:** MEDIUM
**Priority:** 1 (independent, start immediately)
**Dependencies:** None (Sprint 2 complete is a sprint-level prerequisite)
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 2 days

### Description

Build CRUD endpoints for Team Member blocks with special handling for Clerk user ID linking, reporting-to hierarchy, and active/offboarded status management.

### What to Build

1. **API endpoints:**
   - `GET /api/team` -- list team members for the org (filterable by status, department)
   - `POST /api/team` -- create team member (optionally link to Clerk user ID)
   - `PATCH /api/team/[id]` -- update team member fields
   - `DELETE /api/team/[id]` -- soft deactivate (set status to 'offboarded', do not hard delete)

2. **Business logic:**
   - Reporting-to hierarchy: validate that the `reporting_to` field references an existing active team member
   - Depth constraint: max 4 levels of reporting hierarchy
   - Clerk user linking: if `clerk_user_id` is provided, validate it exists in Clerk
   - Status transitions: active --> on_leave --> active, active --> offboarded (terminal)

3. **Team Member is a Block:**
   - Team members are blocks of type `team_member`
   - Use the standard block CRUD under the hood, with additional validation
   - Reporting-to is a block_edge relationship

### Files to Create

- `src/app/api/team/route.ts` (GET, POST)
- `src/app/api/team/[id]/route.ts` (PATCH, DELETE)
- `src/lib/team/validation.ts` (hierarchy validation, status transitions)

### Acceptance Criteria

- [ ] List team members with filtering by status and department
- [ ] Create team member with all fields from the Team Member block type schema
- [ ] Update team member fields with validation
- [ ] Deactivate (soft delete) sets status to 'offboarded'
- [ ] Reporting-to hierarchy validated (max 4 levels)
- [ ] Clerk user ID linking validated when provided
- [ ] Integration tests for all CRUD operations and validation rules

---

## P3-S3-BE-05 — Org Hierarchy API

**Complexity:** MEDIUM
**Priority:** 1 (independent, start immediately)
**Dependencies:** None (Sprint 2 BE-03 sub-org data model is a sprint-level prerequisite)
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 1.5 days

### Description

Expose the sub-org hierarchy (created in Sprint 2 BE-03) via REST API endpoints for the frontend team management UI.

### What to Build

1. **API endpoints:**
   - `GET /api/org/hierarchy` -- returns the full org tree from root to all leaves
   - `POST /api/org/sub-orgs` -- create a sub-org under a parent
   - `PATCH /api/org/[id]` -- update org name, level, or parent

2. **Response format for hierarchy:**
   ```json
   {
     "id": "...",
     "name": "Thornfield Capital",
     "level": "org",
     "children": [
       {
         "id": "...",
         "name": "APAC Operations",
         "level": "suborg",
         "children": [
           { "id": "...", "name": "Compliance", "level": "department", "children": [] }
         ]
       }
     ]
   }
   ```

3. **Validation:**
   - Cannot create a sub-org that would exceed 4 levels
   - Cannot reparent an org to create a cycle
   - Cannot delete an org with children (must delete children first or reassign)

### Files to Create

- `src/app/api/org/hierarchy/route.ts` (GET)
- `src/app/api/org/sub-orgs/route.ts` (POST)
- `src/app/api/org/[id]/route.ts` (PATCH)

### Acceptance Criteria

- [ ] GET /api/org/hierarchy returns correct nested tree structure
- [ ] POST /api/org/sub-orgs creates sub-org with depth validation
- [ ] PATCH /api/org/[id] updates org details with cycle detection
- [ ] 4-level depth constraint enforced via API
- [ ] Org with children cannot be deleted (returns 409)
- [ ] Integration tests for hierarchy CRUD and constraint validation
