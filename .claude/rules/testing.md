---
paths:
  - "tests/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.js"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/*.spec.js"
  - "e2e/**"
---

# Testing Rules

> Path-scoped — loads when working in test files.
> Full standards: `.claude/standards/quality-gates.md` (Gate 2 section)

---

## Test Pyramid Targets
- **Unit tests**: 70% of test count — fast, isolated, test logic not implementation
- **Integration tests**: 20% — test components working together, real dependencies
- **E2E tests**: 10% — critical user paths only, expensive to maintain

## What to Test (and What Not To)
**DO test:**
- Business logic with multiple branches
- Error handling and edge cases
- Data transformations
- Permission and auth checks

**DO NOT test:**
- Framework internals (React rendering mechanics, ORM query building)
- Configuration files
- Trivial getters/setters with no logic

## Test Naming Convention
Tests must be readable as sentences:
```
describe('UserService') {
  describe('createUser') {
    it('should return the new user when valid data is provided')
    it('should throw ValidationError when email is missing')
    it('should not create a duplicate user for existing email')
  }
}
```
Test names must describe: what, under what conditions, expected outcome.

## Coverage Requirements
- New files: ≥ 80% line coverage
- Existing files modified: coverage must not decrease
- Paste coverage report as Gate 2 evidence in `gate-results.md`
- Coverage of 100% is not the goal — meaningful assertions are

## Assertions Must Be Specific
```typescript
// BAD — tests nothing meaningful
expect(result).toBeTruthy()

// GOOD — tests actual value
expect(result.user.email).toBe('test@example.com')
expect(result.user.createdAt).toBeInstanceOf(Date)
```
Never use `toBeTruthy()` or `toBeDefined()` alone — assert the actual value.

## Test Data
- Use factories or fixtures for test data — never hardcode magic values
- Test data must not depend on database state from other tests
- Each test must set up its own state and clean up after itself
- Never use real PII in test data — use generated fake data

## Critical User Paths for E2E
At minimum, E2E tests must cover (adapted per project):
1. User registration and first login
2. Core value action (the thing users come to do)
3. Error recovery (what happens when the core action fails)

E2E test results go in `gate-results.md` with Browserbase session ID if applicable.

## Test File Location
- Unit tests: co-located with source (`src/services/user.service.test.ts`)
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/` or `e2e/`
- Fixtures: `tests/fixtures/`

---

## Phase 3 — New Testing Patterns

### RBAC Test Patterns
- Test each of 10 permissions individually: create test user with ONLY that permission, verify access
- Test permission denial: user WITHOUT permission gets 403
- Test system role backward compat: ops-admin still has full access after RBAC migration
- Test custom role creation: create role → assign permissions → verify enforcement
- Test permission groups: assign group → verify all grouped permissions activate
- Pattern: `describe.each(PERMISSIONS)` for systematic coverage

### Routing Engine Test Matrix
Test all combinations:
| Confidence | Risk Level | Step Override | Expected Route |
|------------|-----------|---------------|----------------|
| ≥0.85 | low | none | auto |
| ≥0.85 | high | none | human |
| 0.6-0.84 | low | none | agent |
| <0.6 | any | none | human |
| any | any | human | human |
| any | any | agent | agent |

Use `describe.each` or test matrix pattern for all combinations.

### Delta Engine Mock Patterns
- Mock block data: use factory function `createMockBlock({ type, metadata })`
- Mock workflow instances: `createMockWorkflowInstance({ templateId, currentStep, totalSteps })`
- Mock events: `createMockEventStream(blockId, count)` — generates time-ordered events
- Test cache invalidation: create delta → add event → verify cache miss → verify recalculation
- Test threshold triggers: set threshold at X → create delta at X-0.01 (no trigger) → create delta at X+0.01 (trigger)
