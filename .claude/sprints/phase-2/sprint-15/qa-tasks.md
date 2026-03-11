# Sprint 15 — QA Tasks

## P2-S15-QA-01 — Integration and AI Tests (MED)

**Priority:** 3 (wait for FE-01, BE-01, FE-02)
**Deps:** P2-S15-FE-01, P2-S15-BE-01, P2-S15-FE-02
**Gates:** G1, G2, G5

### What to Test
Integration wizard flow, AI entity creation, @mention autocomplete.

### Key Files
- Create: `src/components/integrations/__tests__/onboarding-wizard.test.tsx`
- Create: `src/lib/ai/__tests__/entity-creation.test.ts`
- Create: `src/components/chat/__tests__/chat-input.test.tsx`

### Test Cases
- Wizard: step navigation, provider selection, connection test success/failure
- Entity creation: NL→block parsing, duplicate detection, field schema validation
- @mention: `@` trigger, search filtering, selection insertion, blockId storage

### Acceptance Criteria
- [ ] All new test files pass
- [ ] Full suite (521+ tests) pass with 0 failures
- [ ] Lint clean, build clean
