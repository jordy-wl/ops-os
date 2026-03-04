# Sprint 3 — Frontend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-FE-01 | Workflow Trigger — Block Detail Button | OPEN | MEDIUM | 2 | none |
| P1-S3-FE-02 | Block Detail — Events Timeline Polish | OPEN | LOW | 1 | none |

**Day-1 recommendation:** Start both tasks in parallel if running 2 FE sessions. FE-01 is the critical path item for Sprint 3 — it unblocks QA-01 and DE-01. FE-02 is independent and can be completed quickly.

---

## P1-S3-FE-01: Workflow Trigger — Block Detail Action Button

**Description:** Add a "Start Client Onboarding" action button to the block detail page. Sprint 2 produced a workflow engine with no UI trigger. This task is the single biggest gap blocking Phase 1 exit — a design partner cannot run a real workflow without it.

**API to call:** `POST /api/actions/onboarding.start`
```json
Request: {
  "blockId": "<block id from URL>",
  "payload": {
    "clientName": "<block.name>",
    "jurisdiction": "<block.metadata?.jurisdiction || 'AU'>"
  }
}
Response (201): { "data": { "workflowJobId": "...", "status": "pending" } }
```

**Existing file to modify:** `src/app/(app)/blocks/[id]/page.tsx` (Sprint 1 FE-02 deliverable).
Read it first to understand the current structure before modifying.

**Button behaviour:**
- Render a "Start Client Onboarding" button ONLY when `block.type === 'client'`
- Button calls the actions API on click
- Loading state: disabled + spinner icon (aria-busy, aria-disabled)
- Success: display toast "Onboarding workflow started" → redirect to `/workflows` after 1.5s
- Error: display error toast with message from API response; re-enable button
- If `compliance-approver` role (403 response): show "Your role doesn't permit this action"

**Implementation hints:**
- Use a client component for the button (add `'use client'` to a new `StartOnboardingButton` component)
- Keep the block detail page itself as a server component; pass `block` data down to the button component
- Toast pattern: use the same pattern as other modals/toasts in the codebase (check existing components first)
- Redirect: `router.push('/workflows')` after a brief delay so the toast is visible

**Acceptance Criteria:**
- [ ] "Start Client Onboarding" button visible on block detail for `type === 'client'` blocks
- [ ] Button calls `POST /api/actions/onboarding.start` with correct blockId, clientName, jurisdiction
- [ ] Loading state: disabled + spinner during POST request
- [ ] Success: toast + redirect to `/workflows`
- [ ] Error: toast with error message; button re-enabled
- [ ] Button NOT rendered for non-client block types (deal, contact, project)
- [ ] Keyboard accessible: Tab-reachable, Enter/Space activatable
- [ ] Tested at 375px (button full-width) and 1280px (button right-aligned in action zone)
- [ ] No layout shift when button loads or changes state

**Applicable Gates:** 1, 4, 5
**Owner once claimed:** FRONTEND-ENGINEER

---

## P1-S3-FE-02: Block Detail — Events Timeline Polish

**Description:** Replace the current basic events list on the block detail page with a polished timeline. Demo quality — the partner needs to watch events populate as the workflow runs and understand at a glance what each event means.

**Current state:** Block detail shows events but likely as a flat list without visual hierarchy. Check the existing implementation before starting.

**Target design:**
- Events grouped by date with sticky or clear date dividers ("Today", "Yesterday", "2026-03-02")
- Event type badge with colour per category:
  - Workflow events (onboarding.*, workflow.*): blue badge
  - User-triggered events (block.created, action.*): green badge
  - AI events (actor_type = 'ai'): purple badge
  - System events (default): grey badge
- Actor type icon (small, inline): 👤 user, ✦ ai, ⚙ system (or text labels if icons add complexity)
- Payload summary: 1-line truncated text from event payload (display `type` + first key-value pair, max 80 chars)
- 30-second polling for new events (consistent with dashboard)

**Acceptance Criteria:**
- [ ] Events grouped by date with date header dividers
- [ ] Event type badge with colour category (4 categories: workflow / user / ai / system)
- [ ] Actor type shown (icon or text label) with aria-label
- [ ] Payload summary line (truncated, not raw JSON)
- [ ] Empty state: "No events recorded yet" when events array is empty
- [ ] 100+ events: scrollable list, no overflow issues
- [ ] 30-second polling for new events
- [ ] Loading skeleton during initial fetch
- [ ] Responsive at 375px and 1280px

**Applicable Gates:** 1, 4, 5
**Owner once claimed:** FRONTEND-ENGINEER

---

## Files You Will Likely Touch

| File | Task | Notes |
|------|------|-------|
| `src/app/(app)/blocks/[id]/page.tsx` | FE-01, FE-02 | Read first — Sprint 1 deliverable |
| `src/components/blocks/StartOnboardingButton.tsx` | FE-01 | New client component |
| `src/components/blocks/EventsTimeline.tsx` | FE-02 | New or refactored from existing |
| `src/components/ui/Toast.tsx` (or similar) | FE-01 | Check existing toast pattern first |

---

## Standards Reminder

- Keep server components for data fetching; client components for interactivity
- All loading, empty, and error states required (Gate 4)
- No new npm dependencies without Gate 5 scan
- No `console.log` — use `logger` from `@/lib/logger`
- Functions over 50 lines: document the reason in a comment
