# Sprint 3 — Frontend Tasks

## P3-S3-FE-01 — Team Management Settings Page

**Complexity:** MEDIUM
**Priority:** 4 (after BE-04 and BE-05)
**Dependencies:** P3-S3-BE-04, P3-S3-BE-05
**Applicable Gates:** G1, G2, G4, G5
**Assigned Role:** Frontend Engineer
**Estimate:** 3 days

### Description

Build a team management page at `/settings/team` where admins can list team members, invite new members, assign roles, set reporting-to relationships, and view the org hierarchy tree.

### What to Build

1. **Team member list:**
   - Table with columns: Name, Email, Role, Department, Reporting To, Status, Actions
   - Filter by status (active/on_leave/offboarded), department
   - Search by name or email
   - Pagination (or virtual scroll for large teams)

2. **Invite/create team member:**
   - Modal form with fields from Team Member block type schema
   - Role assignment dropdown (from roles API)
   - Reporting-to picker (search existing team members)
   - Optional Clerk user ID field for linking to auth system

3. **Edit team member:**
   - Inline edit or modal for updating fields
   - Role reassignment
   - Deactivation (with confirmation dialog)

4. **Org hierarchy tree view:**
   - Collapsible tree visualization of the org structure
   - Each node shows: org name, level badge, member count
   - Click to filter team list by that org node
   - Add sub-org action on each node (for users with manage_team permission)

### Files to Create

- `src/app/settings/team/page.tsx`
- `src/components/team/team-member-list.tsx`
- `src/components/team/team-member-form.tsx`
- `src/components/team/org-hierarchy-tree.tsx`
- `src/components/team/reporting-to-picker.tsx`

### Acceptance Criteria

- [ ] Team member list displays with all columns and filtering
- [ ] Create team member form with role assignment and reporting-to
- [ ] Edit and deactivate team members with confirmation
- [ ] Org hierarchy tree renders with correct nesting
- [ ] Tree nodes are collapsible and show member counts
- [ ] Responsive at 375px (stacked layout), 768px, 1280px, 1920px
- [ ] Dark mode compatible
- [ ] Permissions enforced: only users with manage_team see edit/invite actions

---

## P3-S3-FE-02 — Role Management UI

**Complexity:** MEDIUM
**Priority:** 3 (after BE-02)
**Dependencies:** P3-S3-BE-02
**Applicable Gates:** G1, G2, G4, G5
**Assigned Role:** Frontend Engineer
**Estimate:** 2.5 days

### Description

Build a role management page at `/settings/roles` where admins can view system roles, create custom roles, and assign permissions via a checkbox matrix.

### What to Build

1. **Role list:**
   - Cards or table showing all roles (system + custom)
   - System roles (ops-admin, ops-user, compliance-approver) have a "System" badge and are read-only
   - Custom roles show edit and delete actions
   - Member count for each role

2. **Create custom role:**
   - Form: name, display name, description
   - Permission checkbox matrix: 10 permissions as checkboxes
   - Group permissions by category:
     - Blocks: manage_blocks, edit_blocks, view_blocks
     - Workflows: manage_workflows, execute_workflows
     - Tasks: approve_tasks
     - Admin: manage_team, manage_settings, manage_integrations
     - Audit: view_audit_log
   - Save creates the role + permission_groups entries

3. **Edit custom role:**
   - Same form as create, pre-filled with current values
   - Cannot edit system roles (UI disabled with explanation)
   - Changing permissions updates permission_groups

4. **Delete custom role:**
   - Confirmation dialog
   - Cannot delete if users are assigned to this role (show count)
   - Reassignment flow: if role has users, prompt to reassign them first

### Files to Create

- `src/app/settings/roles/page.tsx`
- `src/components/roles/role-list.tsx`
- `src/components/roles/role-form.tsx`
- `src/components/roles/permission-matrix.tsx`

### Acceptance Criteria

- [ ] System roles displayed as read-only with correct permission badges
- [ ] Custom role creation with permission checkbox matrix
- [ ] Custom role editing updates permissions correctly
- [ ] Custom role deletion with user reassignment check
- [ ] Permission categories group related permissions logically
- [ ] Responsive at 375px (stacked permissions), 768px, 1280px, 1920px
- [ ] Dark mode compatible
- [ ] Only users with manage_team permission can access this page
