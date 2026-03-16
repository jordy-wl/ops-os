# Sprint 2 — QA Tasks

## P3-S2-QA-01 — Test New Block Types

**Complexity:** MEDIUM
**Priority:** 5 (after BE-05 and FE-01 complete)
**Dependencies:** P3-S2-BE-05, P3-S2-FE-01
**Applicable Gates:** G1, G2, G5
**Assigned Role:** QA Engineer
**Estimate:** 2 days

### Description

Comprehensive testing of all 5 new block types, enriched Contact type, sub-org hierarchy, dynamic validation, and the updated creation UI.

### Test Plan

1. **Regression baseline:**
   - All existing tests pass (550+ from Phase 2 + Sprint 1 additions)
   - Build clean, lint clean

2. **Block type schema tests (unit):**
   - Each of the 5 new types has a valid field_schema
   - Each field has required metadata (name, type, label, validation)
   - Contact enrichment: all 6 new fields present with correct constraints

3. **Dynamic validation tests (integration):**
   - Create a block of each new type with valid fields -- succeeds
   - Create a block with invalid type -- returns 400
   - Create a block with missing required fields -- returns 400 with field errors
   - Create a block with invalid field values (wrong enum, wrong type) -- returns 400
   - Create a block with extra unknown fields -- handled gracefully

4. **Sub-org hierarchy tests (integration):**
   - Create 4-level hierarchy: org --> suborg --> department --> team
   - Attempt to create 5th level -- returns error
   - `getOrgHierarchy()` returns correct tree
   - `getOrgAncestors()` returns correct chain
   - Deleting a mid-level org is handled (cascade or prevent)

5. **Seed migration tests:**
   - All 5 types exist in `block_type_definitions` after migration
   - Running migration twice does not create duplicates

6. **Frontend tests:**
   - Block creation modal shows all new types
   - Type filter dropdown includes new types
   - Correct icons and colors for each new type

### Files to Create

- `tests/blocks/new-block-types.test.ts`
- `tests/blocks/dynamic-validation.test.ts`
- `tests/orgs/hierarchy.test.ts`
- `tests/components/block-creation-modal.test.tsx`

### Acceptance Criteria

- [ ] All existing tests pass (0 regressions)
- [ ] New type schema validation tests pass for all 5 types
- [ ] Contact enrichment tests verify all 6 new fields
- [ ] Dynamic validation rejects invalid types and fields with correct errors
- [ ] Sub-org hierarchy enforces 4-level depth constraint
- [ ] Seed migration is idempotent
- [ ] Build and lint clean
