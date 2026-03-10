# Sprint 12 — Backend Engineer Tasks

**Sprint:** 12 — User-Configurable Block Fields
**Role:** Backend Engineer
**Tasks:** 2 (1 HIGH, 1 MED)

---

## P2-S12-BE-01 — Extended Field Schema Support (HIGH)

**Priority:** 1 (blocks all other tasks)
**Deps:** None
**Branch:** `feature/P2-S12-BE-01-field-types`

### What to Build

Create field type definitions for 12 field types and a schema builder utility that constructs valid JSON Schema with `x-*` extension properties.

### Key Files

**Read first:**
- `src/lib/block-types/system-types.ts` — existing block type definitions
- `src/lib/validation/json-schema.ts` — AJV validator (needs `strict: false`)
- `src/app/api/block-types/route.ts` — POST validation flow
- `src/app/api/block-types/__tests__/block-types.test.ts` — existing tests

**Create:**
- `src/lib/block-types/field-types.ts`
- `src/lib/block-types/field-schema-builder.ts`

**Modify:**
- `src/lib/validation/json-schema.ts` — add `strict: false` to AJV config

### Implementation Notes

- 12 field types: text, number, email, date, select, multi-select, boolean, url, phone, currency, relation, rich-text
- Each field type: `{ type, label, icon, jsonSchemaType, defaultConfig, xProperties }`
- Schema builder: `buildFieldSchema(fields: FieldDefinition[]) → JSONSchema`
- `x-*` extensions: `x-field-type`, `x-relation-target`, `x-display-order`, `x-currency-code`, `x-placeholder`, `x-is-system`
- Ensure existing system types still validate after AJV `strict: false` change

### Gates
G1 (lint), G2 (tests for all 12 types + builder), G3 (validate against AJV), G5 (security)

---

## P2-S12-BE-02 — Field Management API (MED)

**Priority:** 2
**Deps:** BE-01
**Branch:** `feature/P2-S12-BE-02-field-api`

### What to Build

Per-field CRUD endpoints that safely mutate individual properties within a block type's `field_schema`.

### Key Files

**Read first:**
- `src/app/api/block-types/[id]/route.ts` — existing type CRUD
- `src/lib/block-types/field-types.ts` — (from BE-01) field type definitions
- `src/lib/supabase/server.ts` — Supabase client

**Create:**
- `src/app/api/block-types/[id]/fields/route.ts` — GET, POST
- `src/app/api/block-types/[id]/fields/[fieldName]/route.ts` — PATCH, DELETE

### Implementation Notes

- GET: Return sorted field list (by `x-display-order`)
- POST: Validate field against field type definitions, auto-assign `x-display-order`
- PATCH: Update properties, block `x-is-system` fields, validate result schema
- DELETE: Remove field, block `x-is-system`, check for data (warning, not blocking)
- All: ops-admin only (check Clerk role), validate with `isValidJsonSchema()`
- Relation constraints: no self-referencing, validate target exists, 1-hop limit

### Gates
G1 (lint), G2 (API tests), G3 (real request test), G5 (security — role check)
