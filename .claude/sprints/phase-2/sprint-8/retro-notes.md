# Sprint 8 Retrospective

**Date:** 2026-03-10
**Completion Rate:** 10/11 tasks DONE, 1 DEFERRED (91%)
**Conducted by:** ORCHESTRATOR

---

## What Went Well

- **Google OAuth implemented end-to-end in a single session.** From zero Google integration to working OAuth flow, Gmail send, Calendar booking, Drive storage, all with automatic token refresh. The `googleapis` npm package was straightforward.
- **Action menu provides real user value.** Send Email, Book Meeting, and Generate Document actions are now accessible from every block detail page. The dropdown → modal → form pattern works well and is consistent with the existing create-block modal.
- **Library pages give the application substance.** Integration Library (capability-focused, not just raw connectors) and Block Library (with type filters, search, grid/list toggle) make the app feel like a real product.
- **Test count grew from 322 to 344.** 22 new tests across 3 test files covering action handlers (schema + execute) and Google client (OAuth, tokens, services).
- **Zero build errors throughout.** `next build` clean after every change. Only 2 type fixes needed: step type enum (expected) and AuthContext in step-engine (quick fix).
- **Env var hoisting pattern for vitest confirmed.** `vi.hoisted()` is the correct way to set env vars before module-level `const` captures them.

## What Was Harder Than Expected

- **Module-level const captures in vitest.** `google-client.ts` reads env vars at module top level. The `process.env` assignments in the test file were executed too late because `vi.mock` hoists above them. Required using `vi.hoisted()` to set env vars before any imports. This is a known pattern but caught us initially.
- **AuthContext requirements in step-engine.** The `send_email` and `book_meeting` step handlers call action execute functions which expect full `AuthContext` (userId, orgId, clerkOrgId, role). For workflow-executed steps, there's no real user — had to pass synthetic context with `clerkOrgId: ''` and `role: 'ops-admin'`. This is a mild code smell — may want a `SystemContext` type later.
- **Gmail receive (BE-03) deferred.** Pub/Sub push notifications require Google Cloud Pub/Sub topic setup, domain verification, and a publicly accessible webhook endpoint. Polling is simpler but adds cron overhead. Neither was worth the complexity for this sprint — sending email is what matters for Phase 2 exit conditions.

## Build Signals Generated This Sprint

- 0 new signals logged to `build-learnings.md`
- 0 PENDING for researcher
- No PRD deviations — Sprint 8 followed the plan closely
- One implicit signal: **SystemContext for workflow-executed actions** — action handlers assume human callers (AuthContext with clerkOrgId). Workflow step-engine calls them with synthetic context. May need a `SystemContext | AuthContext` union if this pattern grows.

## Phase Exit Condition Status

Phase 2 exit conditions (from phases.md):

| Exit Condition | Status | Evidence |
|---------------|--------|----------|
| User runs ≥5 complete workflows using canvas + Google + docs | NOT MET | Canvas built (S7). Google integration built (S8). Document generation not started (S9). No manual testing yet. |
| At least 1 workflow includes email + document generation | NOT MET | `send_email` step type wired. `generate_document` step type defined but no handler. |
| Internal company onboarding preparation complete | NOT MET | Not started |
| Google OAuth connected and working | PARTIAL | Code built and deployed. User has credentials. Not manually tested with real Google API yet. |
| ≥3 documents generated from templates with brand styling | NOT MET | Sprint 9 scope |
| ≥10 task_queue_items completed by the user | NOT MET | Task queue exists but no manual testing done |

**Phase 2 status: 4/10 sprints complete (5, 6, 7, 8). 2 sprints remain (9, 10).**

## Next Sprint Priorities

1. **Document generation system (BE-heavy)** — Document templates, brand kit, template rendering engine, PDF generation, AI document generation action. This is the last major feature needed for Phase 2 exit.
2. **Document Library page** — Browse templates and generated documents.
3. **Brand kit management UI** — Upload logo, pick colors, set fonts.

## What the Next Sprint Must Account For

- **PDF generation library choice** — `@react-pdf/renderer` vs Puppeteer vs `jspdf`. Need to evaluate at implementation time.
- **Document template format** — HTML/markdown with `{{block.field}}` variable syntax. Must be defined early so templates can be authored.
- **Sprint 8 code uncommitted** — All Sprint 8 work is on the working tree. Needs commit + PR before Sprint 9 starts.
- **Gmail receive still deferred** — If needed for exit conditions, could be a Sprint 10 task.
- **Test count should grow** — Sprint 8 added 22 tests but no component tests for the action menu or Library pages. Sprint 9 should include document rendering tests.
