# Sprint 8 — Frontend Tasks

## P3-S8-FE-01 — Settings Page Restructure (HIGH)

**Priority:** 1 (critical path -- FE-02, FE-03, FE-04 all depend on this layout)
**Deps:** None (Sprints 3+4+7 complete is external prerequisite)
**Gates:** G1, G2, G4, G5, G6

### What to Build
Restructure `/settings` into a comprehensive admin page with sidebar navigation. Sidebar sections: Org Profile, Team, Roles, Block Types, Brand Kit, Integrations, Routing Policies, Notifications, API Keys, Audit Log. Each section loads as a sub-page within the settings layout.

### Key Files
- Create: `src/app/(app)/settings/layout.tsx` -- settings layout with sidebar navigation
- Create: `src/components/settings/settings-sidebar.tsx` -- sidebar nav component with section links and active state
- Modify: `src/app/(app)/settings/page.tsx` -- redirect to first section (Org Profile) or render overview
- Create: `src/app/(app)/settings/org-profile/page.tsx` -- org profile settings (existing content migrated)
- Create: `src/app/(app)/settings/team/page.tsx` -- team management (existing content migrated)
- Create: `src/app/(app)/settings/roles/page.tsx` -- RBAC role management (existing content migrated)
- Create: `src/app/(app)/settings/block-types/page.tsx` -- block type config (existing content migrated)
- Create: `src/app/(app)/settings/brand-kit/page.tsx` -- brand kit settings (existing content migrated)
- Create: `src/app/(app)/settings/integrations/page.tsx` -- integrations overview (link to /integrations)

### Acceptance Criteria
- [ ] Settings page has persistent sidebar navigation with 10 sections
- [ ] Active section highlighted in sidebar
- [ ] Each section loads as nested route within settings layout
- [ ] Existing settings content (org profile, team, roles, block types, brand kit) migrated without data loss
- [ ] Responsive: sidebar collapses to dropdown on mobile (< 768px)
- [ ] Sidebar sections grouped logically: Organization (Profile, Team, Roles), Content (Block Types, Brand Kit), System (Integrations, Routing, Notifications, API Keys, Audit Log)

---

## P3-S8-FE-02 — Routing Policy Config UI (MEDIUM)

**Priority:** 2 (depends on FE-01 for layout and BE-01 for API)
**Deps:** P3-S8-FE-01, P3-S8-BE-01
**Gates:** G1, G2, G4, G5

### What to Build
Settings page section for configuring org-level routing policies. Features a confidence threshold slider (0-1), a risk level matrix grid mapping risk levels to routing modes (human/agent/hybrid), and a preview panel showing how sample tasks would be routed under current settings.

### Key Files
- Create: `src/app/(app)/settings/routing/page.tsx` -- routing policy settings page
- Create: `src/components/settings/confidence-slider.tsx` -- slider component (0-1) with labeled breakpoints
- Create: `src/components/settings/risk-matrix.tsx` -- grid: risk levels (low/medium/high/critical) x routing modes (human/agent/hybrid)
- Create: `src/components/settings/routing-preview.tsx` -- preview panel showing routing decision for sample scenarios

### Acceptance Criteria
- [ ] Confidence slider: 0-1 range, 0.05 step, labeled breakpoints (0.3=low, 0.6=medium, 0.8=high)
- [ ] Risk matrix grid: 4 risk levels x 3 routing modes, click cell to select
- [ ] Preview panel: shows 3 sample task descriptions and their routing decisions under current config
- [ ] Save button persists to API, success toast confirmation
- [ ] Form loads current org policy on mount (or defaults if none set)

---

## P3-S8-FE-03 — Notification Preferences UI (MEDIUM)

**Priority:** 2 (depends on FE-01 for settings layout)
**Deps:** P3-S8-FE-01
**Gates:** G1, G2, G4, G5

### What to Build
Per-user notification preferences within settings. User selects which event types trigger notifications, delivery channel (email vs in-app), and frequency (immediate or daily digest). Builds on the notification system foundation from Sprint 7.

### Key Files
- Create: `src/app/(app)/settings/notifications/page.tsx` -- notification preferences page
- Create: `src/components/settings/notification-toggles.tsx` -- toggle grid: event types x channels
- Create: `src/app/api/settings/notifications/route.ts` -- GET/PUT for user notification preferences

### Acceptance Criteria
- [ ] Event type toggles: delta_alert, task_assigned, step_overdue, workflow_complete, mention (each toggleable)
- [ ] Channel selection per event type: in-app (always on), email (toggleable)
- [ ] Frequency: immediate or daily digest (radio group, applies to email channel)
- [ ] Preferences stored per-user (not per-org)
- [ ] Changes saved on toggle (optimistic update) or via explicit Save button

---

## P3-S8-FE-04 — Audit Log Viewer (MEDIUM)

**Priority:** 2 (depends on FE-01 for settings layout)
**Deps:** P3-S8-FE-01
**Gates:** G1, G2, G4, G5

### What to Build
A `/settings/audit-log` page showing a paginated, filterable, read-only event viewer. Filters by actor (user), event type, date range, and related block. Leverages the existing `events` table which is the immutable audit log.

### Key Files
- Create: `src/app/(app)/settings/audit-log/page.tsx` -- audit log viewer page
- Create: `src/components/settings/audit-log-table.tsx` -- paginated table with event rows
- Create: `src/components/settings/audit-log-filters.tsx` -- filter bar: actor, type, date range, block
- Modify: `src/app/api/events/route.ts` -- add filter parameters (actor_id, type, date_from, date_to, block_id) if not present

### Acceptance Criteria
- [ ] Paginated table: 50 events per page, cursor-based pagination (load more)
- [ ] Columns: timestamp, actor (user name), event type, block name (linked), summary
- [ ] Filter by actor: dropdown of org users
- [ ] Filter by event type: multi-select of event types
- [ ] Filter by date range: date picker (from/to)
- [ ] Filter by block: search autocomplete for block name
- [ ] Read-only: no edit/delete actions (events are immutable)
- [ ] Responsive at all 4 breakpoints (horizontal scroll on mobile for table)
