# Sprint 7 — QA Tasks

## P3-S7-QA-01 — Delta Engine Tests (MEDIUM)

**Priority:** 4 (wait for all implementation tasks)
**Deps:** P3-S7-AI-01, P3-S7-AI-02, P3-S7-BE-01, P3-S7-FE-01, P3-S7-AI-03, P3-S7-BE-02
**Gates:** G1, G2, G5

### What to Test
Delta calculation accuracy, auto-task generation thresholds, insight caching and invalidation, notification creation and delivery, and insights panel rendering.

### Key Files
- Create: `src/lib/ai/__tests__/delta-engine-integration.test.ts` -- full-path delta calculation with realistic workflow data
- Create: `src/lib/ai/__tests__/delta-task-generator.test.ts` -- threshold evaluation, de-duplication (if not covered by BE-01)
- Create: `src/lib/ai/__tests__/insights-cache.test.ts` -- cache hit/miss, invalidation on new events
- Create: `src/lib/notifications/__tests__/create.test.ts` -- notification creation, recipient resolution
- Create: `src/components/blocks/__tests__/insights-panel.test.tsx` -- panel rendering, section collapse, progress bar

### Test Cases
- Delta calculation: on-track workflow (health 100), partially delayed (health 50-80), severely delayed (health <50), completed workflow, empty (no events)
- Auto-task generation: threshold triggers, de-duplication (same issue does not create second task), routing integration
- Insight caching: first call generates (cache miss), second call returns cached (no Claude call), new event invalidates cache
- Notifications: delta threshold creates notification for assignee, mark-read API works, RLS prevents cross-org access
- Insights panel: renders only on workflow_instance blocks, sections expand/collapse, progress bar reflects health score
- Chat context: delta included for workflow_instance blocks, not included for other block types

### Acceptance Criteria
- [ ] All new test files pass
- [ ] Full suite passes with 0 failures
- [ ] Lint clean, build clean
- [ ] Edge cases: workflow with 1 step, workflow with 50 steps, no assignee on block, org with no routing policy
