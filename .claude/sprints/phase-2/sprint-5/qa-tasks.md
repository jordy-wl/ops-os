# Sprint 5 — QA Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P2-S5-QA-01: Workflow Runtime Integration Tests

**Complexity:** MEDIUM | **Est:** 1d | **Blocked By:** P2-S5-BE-02, P2-S5-BE-03
**Applicable Gates:** 1, 2, 5

**Description:** Contract tests for the workflow runtime: instance spawning, step execution, trigger evaluation, and task queue. Test the full lifecycle: template → trigger → instance → steps → completion.

**Test cases (minimum):**

### Contract Tests (real Supabase, skip guard)
- [ ] Spawn instance from template → verify instance Block created with correct metadata
- [ ] Advance instance through 2 steps → verify step_results populated
- [ ] Manual trigger → verify instance created for target block
- [ ] Event trigger → verify instance auto-spawned on matching event
- [ ] Task queue: create → claim → complete → verify workflow advances
- [ ] Org isolation: org A cannot see org B's instances or tasks

**Files likely created:**
- `tests/api/workflow-runtime.test.ts`
