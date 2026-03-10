# Sprint 7 Retrospective

**Date:** 2026-03-10
**Completion Rate:** 10/11 tasks DONE, 1 DEFERRED (91%)
**Conducted by:** ORCHESTRATOR

---

## What Went Well

- **React Flow canvas implemented end-to-end in one sprint.** From zero canvas code to a fully working visual builder with drag-and-drop nodes, config panels, bidirectional serialization, and persistence. The `@xyflow/react` v12 library was straightforward to integrate.
- **Canvas serialization proved clean.** The `stepsToCanvas` ↔ `canvasToTemplate` bidirectional converter works well. 15 tests confirm round-trip data preservation including call_api with all config fields.
- **Navigation restructure was smooth.** Library dropdown with Blocks/Integrations/Documents, proper keyboard support, outside-click-to-close. No regressions in existing nav.
- **My Work page aggregates data well.** Server-side data assembly (parallel queries + name resolution) gives a fast initial paint. 4-section layout (Tasks, Workflows, Blocks, Activity) covers the key personal work areas.
- **Test count grew from 307 to 322.** 15 new canvas serialization tests. All existing tests remain passing.
- **Zero build errors throughout.** `next build` clean after every change. No TypeScript regressions.

## What Was Harder Than Expected

- **TypeScript discriminated union issues from Sprint 6.** The `integration_connectors` API routes had 4 instances of the Supabase `.single()` discriminated union bug (checking `!data` before `error` causes TS to narrow `error` to `never`). Fixed as prerequisite to clean build.
- **Missing webhook trigger type in Zod schema.** Sprint 6 code referenced `trigger.type === 'webhook'` in `trigger-evaluation.ts` but the `TriggerSchema` only defined `manual | event`. Added `webhook` discriminated union variant to unblock the build.
- **shared-state.md coordination gap.** Sprint 7 work happened across two continuous sessions, and shared-state.md wasn't updated incrementally. The retro found shared-state showing 1/11 DONE when all tasks were actually complete. Lesson: even in continuous sessions, update shared-state after each task.
- **UI-01 UX research wasn't executed.** The Design Lead agent was set up (ORC-01) but the research task itself wasn't claimed. Partial coverage came from the design standards document, but competitive UX analysis (n8n, Make, Monday.com) was skipped.

## Build Signals Generated This Sprint

- 0 new signals logged to `build-learnings.md`
- 0 PENDING for researcher
- No PRD deviations — Sprint 7 was a greenfield feature sprint (canvas, My Work, nav restructure)
- One implicit signal: **UI-01 (UX research) was deferred** — the Design Lead agent persona was created but never spawned for research. This suggests the multi-agent model may not be practical for a solo developer workflow. Consider simplifying to direct implementation with design standards as the guide, rather than waiting for a separate research step.

## Phase Exit Condition Status

Phase 2 exit conditions (from phases.md):

| Exit Condition | Status | Evidence |
|---------------|--------|----------|
| User runs ≥5 complete workflows using canvas + Google + docs | NOT MET | Canvas built (Sprint 7). Google integration not started. Document generation not started. |
| At least 1 workflow includes email + document generation | NOT MET | `send_email` and `generate_document` step types defined in schema but no handlers implemented |
| Internal company onboarding preparation complete | NOT MET | Not started |
| Google OAuth connected and working | NOT MET | Sprint 8 scope |
| ≥3 documents generated from templates with brand styling | NOT MET | Sprint 9 scope |
| ≥10 task_queue_items completed by the user | NOT MET | Task queue exists but no manual testing done |

**Phase 2 status: 3/10 sprints complete (5, 6, 7). 3 sprints remain (8, 9, 10).**

## Next Sprint Priorities

1. **Google OAuth + Gmail/Calendar integration (BE-heavy)** — This unlocks the email send and meeting book actions needed for the Phase 2 exit condition.
2. **Action menu on block detail pages** — Users need a way to trigger discrete actions (send email, book meeting, generate document) from the block context.
3. **Library pages (Block Library + Integration Library)** — New nav structure has Library dropdown pointing to these pages. Currently `/blocks` and `/integrations` exist but need the enhanced Library treatment.

## What the Next Sprint Must Account For

- **Google OAuth requires environment setup** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` env vars needed. May need Google Cloud Console project setup. OAuth scopes: `gmail.send`, `gmail.readonly`, `calendar.events`, `drive.file`.
- **Sprint 7 code is uncommitted** — All canvas, My Work, and nav code is on the working tree of `fix/pii-and-atomicity` branch. Needs to be committed and PR'd before Sprint 8 starts.
- **UI-01 (UX research) deferred** — Consider folding competitive UX analysis into Sprint 8 Library page work, or dropping it entirely in favour of iterating based on user testing.
- **Test count should grow** — Sprint 7 added 15 tests for serialization but no component tests for the canvas UI or My Work page. Sprint 8 should include integration tests for Google OAuth flow and action handlers.
