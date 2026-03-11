# Sprint 16 — QA Tasks

## P2-S16-QA-01 — Full Regression Suite (HIGH)

**Priority:** 2 (wait for FE-01, FE-02, FE-03)
**Deps:** P2-S16-FE-01, P2-S16-FE-02, P2-S16-FE-03
**Gates:** G1, G2, G5, G6

### What to Test
Full regression across all Phase 2 features.

### Test Plan
1. All 550+ existing tests pass with 0 failures
2. Build succeeds with zero errors
3. Lint clean

### New Test Cases (if time permits)
- Integration test: workflow with update_block step modifies block metadata
- Chat widget: tool call renders BlockCreationPreview for create_block
- @mention: getMentionQuery helper unit tests

### Acceptance Criteria
- [ ] Full suite passes (550+ tests, 0 failures)
- [ ] Build clean (`next build` succeeds)
- [ ] Lint clean (`next lint` zero errors)
- [ ] No regressions from polish/cleanup changes
