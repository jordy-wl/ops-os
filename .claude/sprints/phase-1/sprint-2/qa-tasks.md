# Sprint 2 — QA Engineer Tasks

Filtered from master tasks.md. Full detail in tasks.md.

| Task ID | Title | Status | Complexity | Dependencies |
|---------|-------|--------|-----------|-------------|
| P1-S2-QA-01 | Workflow Engine Contract Tests | OPEN | MEDIUM | P1-S2-BE-01 |

**Start:** Blocked until BE-01 is DONE. While waiting, review BE-01's acceptance criteria and pre-write test stubs and helper functions in `tests/api/workflow.test.ts` — stub the test cases with `.todo()` markers.
**Note:** Add a `makeDelete` helper to `tests/api/helpers.ts` if needed for any cleanup patterns. Remember: events immutability means no cascade deletes — workflow_jobs linked to events cannot be cleaned up. Use unique run IDs (Date.now()) per test run.
