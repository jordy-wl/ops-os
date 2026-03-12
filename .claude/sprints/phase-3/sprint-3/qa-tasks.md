# Sprint 3 — QA Tasks

## P3-S3-QA-01 — RBAC Integration Tests

**Complexity:** HIGH
**Priority:** 5 (after BE-03, FE-01, FE-02)
**Dependencies:** P3-S3-BE-03, P3-S3-FE-01, P3-S3-FE-02
**Applicable Gates:** G1, G2, G5, G6
**Assigned Role:** QA Engineer
**Estimate:** 3 days

### Description

Comprehensive testing of the entire RBAC system: permission resolution, enforcement middleware, backward compatibility, custom roles, team management, and org hierarchy.

### Test Plan

1. **Regression baseline:**
   - All existing tests pass (0 regressions)
   - Build clean, lint clean

2. **Permission resolution tests (unit):**
   - ops-admin resolves to all 10 permissions
   - ops-user resolves to correct subset (5 permissions)
   - compliance-approver resolves to correct subset (3 permissions)
   - Custom role resolves to exactly its assigned permissions
   - User with no assignment falls back to ops-user defaults
   - Permission resolution is cached per-request (no duplicate DB queries)

3. **Permission enforcement tests (integration):**
   - For each of the 10 permissions, test:
     - User WITH permission: request succeeds (200/201)
     - User WITHOUT permission: request returns 403
   - Test composition: route requiring multiple permissions rejects if any is missing

4. **Backward compatibility tests (critical):**
   - All existing test files that use `requireRole()` still pass
   - `withAuth()` still returns `role` as a string
   - No existing API behavior changed

5. **Custom role tests (integration):**
   - Create custom role with subset of permissions
   - Assign user to custom role
   - Verify user can only access permitted routes
   - Delete custom role (with no users assigned)
   - Attempt to delete role with users assigned -- blocked

6. **Team management tests:**
   - CRUD operations for team members
   - Reporting-to hierarchy validation (max 4 levels)
   - Status transitions (active --> on_leave, active --> offboarded)
   - Clerk user ID linking validation

7. **Org hierarchy tests:**
   - Full tree retrieval
   - Sub-org creation with depth constraint
   - Cycle detection on reparenting
   - Cannot delete org with children

8. **Frontend tests:**
   - Team list renders with correct columns
   - Role management permission matrix toggles correctly
   - System roles are read-only in the UI

### Files to Create

- `tests/rbac/permission-resolution.test.ts`
- `tests/rbac/permission-enforcement.test.ts`
- `tests/rbac/backward-compatibility.test.ts`
- `tests/rbac/custom-roles.test.ts`
- `tests/team/team-crud.test.ts`
- `tests/orgs/org-hierarchy-api.test.ts`
- `tests/components/role-management.test.tsx`
- `tests/components/team-management.test.tsx`

### Acceptance Criteria

- [ ] All existing tests pass (0 regressions -- critical for backward compat)
- [ ] Permission resolution tested for all 3 system roles + custom role
- [ ] Every route tested with both permitted and denied users
- [ ] Backward compatibility: old requireRole() tests unchanged and passing
- [ ] Custom role lifecycle tested (create, assign, use, delete)
- [ ] Team CRUD with hierarchy validation tested
- [ ] Org hierarchy API tested with depth and cycle constraints
- [ ] Build and lint clean
