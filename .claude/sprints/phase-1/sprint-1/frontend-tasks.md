# Frontend Tasks — Phase 1, Sprint 1

> Tasks for Frontend Engineer only. Source of truth: `tasks.md` (master list).
> Run `/load-agent frontend` then `/next-task` to claim your first task.

---

## Sprint Header

**Phase:** 1 | **Sprint:** 1 | **Role:** FRONTEND-ENGINEER
**Sprint Goal:** Build the authenticated app shell and the two core views: Block List and Block Detail. By end of Sprint 1, a user can sign in, browse their blocks, and see the complete event timeline for any block.
**Your critical path:** FE-01 (shell) → FE-03 (list) + FE-02 (detail, can start in parallel after FE-01)
**Dependency note:** FE-01 depends on BE-05 (auth middleware); FE-02/FE-03 depend on BE-02/BE-03 (APIs). Coordinate with backend on API availability.

---

## P1-S1-FE-01: App Shell + Clerk Auth Flow

**Description:** Build the authenticated app shell: Clerk sign-in, org switcher, protected route layout, and top-level navigation. Handles unauthenticated redirect, no-org state, and authenticated app state.

**Pages:** `/sign-in`, `/sign-up`, `/` (redirect), `/dashboard`, `/org-setup`
**Tech:** `@clerk/nextjs`, Next.js App Router layouts, shadcn/ui navigation components

**Acceptance Criteria:**
- [ ] Unauthenticated users accessing `/dashboard` are redirected to `/sign-in`
- [ ] Authenticated users redirected from `/sign-in` to `/dashboard`
- [ ] Org switcher visible in nav when user belongs to ≥1 org
- [ ] Nav links render: Blocks, Workflows (stub), Chat (stub)
- [ ] Loading state during auth check (no blank flash before redirect)
- [ ] All interactive elements (nav, org switcher, sign out) keyboard accessible
- [ ] Tested at 375px and 1280px — no broken layout at either breakpoint
- [ ] Sign out works; redirects to `/sign-in`

**Applicable Gates:** 1, 4, 5
**Dependencies:** P1-S1-OPS-01, P1-S1-BE-05
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** FRONTEND-ENGINEER

---

## P1-S1-FE-02: Block Detail View

**Description:** Build the Block detail page at `/blocks/[id]`. Shows block data, event timeline (newest first), and connected blocks panel. This is the most important view — what ops leads use to answer "what is the status of client XYZ?"

**Components to build:**
- `BlockDetailPage` at `/blocks/[id]/page.tsx`
- `BlockDataPanel` — renders key-value pairs from `data` JSONB
- `EventTimeline` — chronological list (icon, type, actor, relative timestamp, payload summary)
- `ConnectedBlocksPanel` — list of neighbouring blocks with type + relationship label
- `BlockHeader` — block type badge + title + jurisdiction tag

**Acceptance Criteria:**
- [ ] Block data rendered from `GET /api/blocks/:id`
- [ ] Event timeline: all events newest-first; each shows event_type, actor_type, relative timestamp, payload summary
- [ ] Connected blocks panel: neighbours from `GET /api/blocks/:id/neighbours`
- [ ] Loading skeleton while data fetches
- [ ] Empty state: "No events recorded yet" if events empty
- [ ] Error state: "Block not found" + back navigation if 404
- [ ] 403 state: "You don't have access to this block"
- [ ] Tested at 375px, 768px, 1280px
- [ ] Relative timestamps ("2 hours ago") with full ISO date on hover

**Applicable Gates:** 1, 2, 4, 5
**Dependencies:** P1-S1-BE-02, P1-S1-BE-03, P1-S1-FE-01
**Complexity:** HIGH
**Estimate:** 3 days
**Assigned Role:** FRONTEND-ENGINEER

---

## P1-S1-FE-03: Block List View

**Description:** Build the Block list view at `/blocks`. Displays all org blocks with type filtering and client-side text search. Entry point for navigating to Block detail.

**Components:** `BlockListPage`, `BlockCard` (type badge, name from `data.name`, jurisdiction tag, last event timestamp), `BlockTypeFilter`, `BlockSearch` (client-side)

**Acceptance Criteria:**
- [ ] All blocks for current org rendered via `GET /api/blocks`
- [ ] Block type filter (All / Client / Deal / Project / Contract) updates list without page reload
- [ ] Text search filters client-side by `data.name` (case-insensitive)
- [ ] Clicking a block card navigates to `/blocks/:id`
- [ ] Loading skeleton while fetching
- [ ] Empty state: "No blocks yet. Start by running a workflow." with CTA button (stub)
- [ ] Renders correctly with 0, 1, and 50+ blocks
- [ ] Tested at 375px and 1280px

**Applicable Gates:** 1, 4, 5
**Dependencies:** P1-S1-BE-02, P1-S1-FE-01
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** FRONTEND-ENGINEER
