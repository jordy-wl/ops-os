# Sprint 1 — QA Tasks

## P3-S1-QA-01 — Regression Test Sprint 1 Fixes

**Complexity:** MEDIUM
**Priority:** 2 (after all BE/FE tasks complete)
**Dependencies:** P3-S1-BE-01, P3-S1-FE-01, P3-S1-FE-02, P3-S1-FE-03
**Applicable Gates:** G1, G2, G5
**Assigned Role:** QA Engineer
**Estimate:** 1.5 days

### Description

Verify all 550+ existing tests still pass after Sprint 1 changes. Add new tests covering the specific fixes made in this sprint.

### Test Plan

1. **Regression baseline:**
   - Run full test suite (`npm test`) -- all 550+ tests must pass
   - Run build (`next build`) -- zero errors
   - Run lint (`next lint`) -- zero errors/warnings

2. **New tests for BE-01:**
   - Workflow template creation with 0 steps succeeds (Zod validation)
   - Workflow template creation with 1+ steps still succeeds
   - Dynamic block type validation queries `block_type_definitions` table
   - Block creation with an invalid type returns 400

3. **New tests for FE-01:**
   - Chat widget position classes include `right-5` (snapshot or DOM assertion)

4. **New tests for FE-02:**
   - ThemeToggle component renders correct icon for current theme
   - Clicking toggle switches the theme class on `<html>`
   - localStorage is updated on toggle

5. **New tests for FE-03:**
   - Verify no horizontal overflow on key pages at 375px (if E2E/visual tests exist)
   - Otherwise: manual verification documented in gate evidence

### Files to Create

- `tests/api/workflow-creation.test.ts` (or extend existing)
- `tests/components/theme-toggle.test.tsx`

### Acceptance Criteria

- [ ] All 550+ existing tests pass with 0 failures
- [ ] Build succeeds with zero errors
- [ ] Lint clean with zero errors
- [ ] New tests added for dynamic block type validation
- [ ] New tests added for theme toggle functionality
- [ ] Chat widget position verified (test or manual evidence)
