# Sprint 5 — Frontend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P2-S5-FE-01: Workflow Template List + Create UI

**Complexity:** MEDIUM | **Est:** 2d | **Blocked By:** PR merge backlog
**Applicable Gates:** 1, 4, 5

**Description:** Create a page at `/workflows` that lists workflow templates and allows creating new ones. This builds on the block_type_definitions and workflow_template infrastructure from Sprint 4.

**UI Components:**
- Workflow Templates page at `/workflows` (add to sidebar nav)
- Template list: cards showing name, trigger type, applies_to_type, step count
- Create Template modal: form with template fields (name, applies_to_type, trigger config, step builder)
- Step builder: ordered list of steps with add/remove/reorder
- Empty state when no templates exist

**Acceptance Criteria:**
- [ ] /workflows page lists workflow templates
- [ ] Create template modal with step builder
- [ ] Template cards show meaningful summary
- [ ] Empty state with CTA
- [ ] Responsive at 375px and 1280px
- [ ] Loading/error states

---

## P2-S5-FE-02: My Tasks Queue UI

**Complexity:** MEDIUM | **Est:** 1.5d | **Blocked By:** P2-S5-BE-04
**Applicable Gates:** 1, 4, 5

**Description:** Add a "My Tasks" view accessible from the sidebar or dashboard. Shows task_queue_items assigned to or claimable by the current user.

**UI Components:**
- My Tasks page at `/tasks` (add to sidebar nav)
- Task list: grouped by status (open, claimed by me, completed)
- Task card: shows instructions, workflow name, source block link
- Claim button on open tasks
- Complete button on claimed tasks
- Badge on sidebar showing open task count

**Acceptance Criteria:**
- [ ] /tasks page lists task queue items
- [ ] Claim and complete actions work
- [ ] Sidebar badge shows open task count
- [ ] Link to source block from task card
- [ ] Responsive at 375px and 1280px
- [ ] Loading/empty/error states
