# Sprint 12 — QA Engineer Tasks

**Sprint:** 12 — User-Configurable Block Fields
**Role:** QA Engineer
**Tasks:** 1 (MED)

---

## P2-S12-QA-01 — Block Field Tests (MED)

**Priority:** 1 (after BE-02 and FE-01 complete)
**Deps:** BE-01, BE-02, FE-01
**Branch:** `feature/P2-S12-QA-01-field-tests`

### What to Build

Comprehensive test suite covering field types, schema builder, field management API, and integration flow.

### Key Files

**Read first:**
- `src/lib/block-types/field-types.ts` — field type definitions (from BE-01)
- `src/lib/block-types/field-schema-builder.ts` — schema builder (from BE-01)
- `src/app/api/block-types/[id]/fields/route.ts` — field API (from BE-02)
- `src/app/api/block-types/__tests__/block-types.test.ts` — existing test patterns

**Create:**
- `src/lib/block-types/__tests__/field-types.test.ts`
- `src/lib/block-types/__tests__/field-schema-builder.test.ts`
- `src/app/api/block-types/[id]/fields/__tests__/fields.test.ts`

### Test Cases

**Field types (unit):**
- Each of 12 types has: name, label, icon, jsonSchemaType
- Each type produces valid JSON Schema property
- `x-*` properties correctly set for each type
- Type-specific defaults: currency → AUD, relation → required target, date → ISO format

**Schema builder (unit):**
- Builds schema with correct `type: "object"` + `properties`
- Applies `x-display-order` in sequence
- Handles `required` fields correctly
- Validates output against AJV
- Preserves existing system type schemas when round-tripped

**Field API (integration):**
- GET: returns fields sorted by `x-display-order`
- POST: creates field, assigns next order, rejects duplicates
- PATCH: updates field properties, blocks system fields
- DELETE: removes field, blocks system fields
- Relation: rejects self-referencing target type
- Auth: rejects non-ops-admin users (403)
- Validation: rejects invalid field type, invalid schema result

**Integration (end-to-end unit):**
- Admin adds custom field to block type → field appears in GET response
- Field schema validates against AJV after each mutation
- Block with the type still validates after field changes

### Gates
G1 (lint), G2 (all tests pass, coverage ≥80%), G5 (security)
