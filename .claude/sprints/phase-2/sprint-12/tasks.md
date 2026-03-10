# Sprint 12 Tasks — User-Configurable Block Fields

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 12
**Sprint Goal:** Ops-admins can add/remove/reorder custom fields on block types. 12 field types including relations. Block detail pages render all field types with inline editing.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 11 (UI Foundation) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S12-BE-01 | Extended field schema support | Backend | HIGH | — | OPEN |
| P2-S12-BE-02 | Field management API | Backend | MED | BE-01 | OPEN |
| P2-S12-FE-01 | Dynamic field renderer V2 | Frontend | HIGH | BE-01 | OPEN |
| P2-S12-FE-02 | Field configuration UI (admin) | Frontend | HIGH | BE-02 | OPEN |
| P2-S12-FE-03 | Block detail page enhancement | Frontend | MED | FE-01 | OPEN |
| P2-S12-QA-01 | Block field tests | QA | MED | BE-02, FE-01 | OPEN |

**Total:** 6 tasks (2 BE, 3 FE, 1 QA)
**Critical path:** BE-01 → BE-02 → FE-02 | BE-01 → FE-01 → FE-03

---

## Task Details

### P2-S12-BE-01 — Extended Field Schema Support (HIGH)

**What:** Extend the JSON Schema `field_schema` system with `x-*` extension properties for 12 field types. Create field type definitions and a schema builder utility.

**Context:**
- Existing: `src/lib/block-types/system-types.ts` defines 10 block types with basic JSON Schema (string, number, boolean, enum)
- Existing: `src/lib/validation/json-schema.ts` validates schemas with AJV
- Existing: `src/app/api/block-types/route.ts` + `[id]/route.ts` — CRUD for block types

**Files to create:**
- `src/lib/block-types/field-types.ts` — 12 field type definitions with metadata
- `src/lib/block-types/field-schema-builder.ts` — utility to construct valid JSON Schema with `x-*` extensions

**12 Field Types:**
1. `text` — basic string input (existing)
2. `number` — numeric input with optional min/max (existing)
3. `email` — string with `format: "email"` (existing)
4. `date` — string with `x-field-type: "date"`, ISO 8601 format
5. `select` — string with `enum` values (existing)
6. `multi-select` — array of strings with `x-field-type: "multi-select"`
7. `boolean` — boolean checkbox (existing)
8. `url` — string with `format: "uri"`, `x-field-type: "url"`
9. `phone` — string with `x-field-type: "phone"`, pattern validation
10. `currency` — number with `x-field-type: "currency"`, `x-currency-code`
11. `relation` — string (UUID) with `x-field-type: "relation"`, `x-relation-target: "client"`
12. `rich-text` — string with `x-field-type: "rich-text"`, markdown content

**JSON Schema `x-*` extension properties:**
- `x-field-type` — canonical field type identifier
- `x-relation-target` — target block type for relation fields
- `x-display-order` — integer for field ordering (since JSON Schema properties are unordered)
- `x-currency-code` — ISO 4217 currency code (default: "AUD")
- `x-placeholder` — custom placeholder text
- `x-is-system` — marks fields as system-managed (locked from editing)

**AJV config:** Set `strict: false` to allow `x-*` properties without schema errors.

**Gates:** G1, G2, G3, G5

---

### P2-S12-BE-02 — Field Management API (MED)

**What:** API endpoints for adding, updating, removing, and reordering individual fields within a block type's `field_schema`. System fields are locked from editing.

**Context:**
- Existing: `src/app/api/block-types/[id]/route.ts` — PATCH updates entire `field_schema`
- New: per-field CRUD endpoints that safely mutate individual properties within the schema

**Files to create:**
- `src/app/api/block-types/[id]/fields/route.ts` — GET (list fields), POST (add field)
- `src/app/api/block-types/[id]/fields/[fieldName]/route.ts` — PATCH (update), DELETE (remove)

**Details:**
- GET: Returns field list with `x-display-order` sorting, enriched with field type metadata
- POST: Validates new field against `field-types.ts` definitions, assigns next `x-display-order`, rejects duplicate field names
- PATCH: Allows updating field properties (label, type config, placeholder, required) — blocks `x-is-system` fields
- DELETE: Removes field from schema — blocks `x-is-system` fields, warns if field has data in existing blocks
- All endpoints: ops-admin only, validate resulting schema with AJV

**Relation field constraints:**
- Prevent self-referencing (target type cannot be the same as the block type)
- Limit to 1-hop (no relation→relation chains)
- Validate target type exists in `block_type_definitions`

**Gates:** G1, G2, G3, G5

---

### P2-S12-FE-01 — Dynamic Field Renderer V2 (HIGH)

**What:** Rewrite `dynamic-field-renderer.tsx` to support all 12 field types with inline editing and proper validation.

**Context:**
- Existing: `src/components/blocks/dynamic-field-renderer.tsx` (184 lines) — handles text, email, number, boolean, select only
- Existing: `src/components/blocks/block-data-panel.tsx` (64 lines) — wraps renderer in read-only mode

**Files to create (per-type components):**
- `src/components/blocks/fields/date-field.tsx` — date picker using native input[type=date]
- `src/components/blocks/fields/multi-select-field.tsx` — tag-style multi-select
- `src/components/blocks/fields/relation-field.tsx` — async block search with combobox
- `src/components/blocks/fields/currency-field.tsx` — number input with currency prefix
- `src/components/blocks/fields/rich-text-field.tsx` — textarea with markdown preview
- `src/components/blocks/fields/url-field.tsx` — text input with link preview
- `src/components/blocks/fields/phone-field.tsx` — text input with phone pattern validation

**Files to modify:**
- `src/components/blocks/dynamic-field-renderer.tsx` — complete rewrite as dispatcher to per-type components
- `src/components/blocks/block-data-panel.tsx` — update for V2 renderer, inline editing support

**Details:**
- Each field component handles both `mode: "edit"` and `mode: "view"`
- View mode: displays formatted value with appropriate styling (links for URL, formatted dates, currency symbols)
- Edit mode: appropriate input with validation, error messages, required indicators
- Relation field: queries `/api/blocks?type={target}` for autocomplete suggestions
- Field ordering: render in `x-display-order` sequence

**Gates:** G1, G2, G4, G5

---

### P2-S12-FE-02 — Field Configuration UI (admin) (HIGH)

**What:** Settings UI for ops-admins to manage block type fields. HubSpot-style property management with drag-to-reorder.

**Context:**
- Existing: `src/app/(app)/settings/brand/page.tsx` — only settings page currently
- New: Block type management section in settings

**Files to create:**
- `src/app/(app)/settings/block-types/page.tsx` — list all block types with field counts
- `src/app/(app)/settings/block-types/[id]/page.tsx` — field management for a specific type
- `src/components/settings/field-config-panel.tsx` — right panel for editing a single field's properties
- `src/components/settings/field-list.tsx` — sortable field list with drag-to-reorder (updates `x-display-order`)

**Details:**
- Type list page: shows all block types (system + custom), field count, block count using type
- Type detail page: left panel = sortable field list, right panel = selected field config
- Field config panel: field name (locked after creation), field type selector, type-specific options (e.g. enum values for select, target type for relation, currency code for currency), required toggle, placeholder text
- System fields (`x-is-system: true`) shown with lock icon, not editable
- "Add Field" button opens type selector → creates field with default config
- Drag-to-reorder updates `x-display-order` via PATCH
- All mutations through the field management API (BE-02)

**Gates:** G1, G4, G5

---

### P2-S12-FE-03 — Block Detail Page Enhancement (MED)

**What:** Update block detail page to use the V2 field renderer with inline editing and animations.

**Context:**
- Existing: `src/app/(app)/blocks/[id]/page.tsx` (185 lines) — server component that passes data to BlockDataPanel
- Existing: `src/components/blocks/block-data-panel.tsx` (64 lines) — read-only display

**Files to modify:**
- `src/app/(app)/blocks/[id]/page.tsx` — pass V2 renderer props, add edit mode toggle
- `src/components/blocks/block-data-panel.tsx` — support inline editing via V2 renderer, save via `/api/blocks/[id]` PATCH

**Details:**
- Click field value to enter inline edit mode (for ops-admin/ops-user)
- Save on blur or Enter key
- Optimistic UI update with rollback on error
- Animate field updates with scale-in effect
- Show field type icons next to field labels
- Relation fields show linked block name with click-through navigation

**Gates:** G1, G4, G5

---

### P2-S12-QA-01 — Block Field Tests (MED)

**What:** Unit tests for field types and schema builder. API tests for field CRUD. Integration test for admin field config flow.

**Files to create:**
- `src/lib/block-types/__tests__/field-types.test.ts` — unit tests for 12 field type definitions
- `src/lib/block-types/__tests__/field-schema-builder.test.ts` — schema builder utility tests
- `src/app/api/block-types/[id]/fields/__tests__/fields.test.ts` — API endpoint tests (field CRUD)

**Test cases:**
- Field types: each of 12 types produces valid JSON Schema, `x-*` properties set correctly
- Schema builder: constructs schema with ordered fields, handles required fields, validates against AJV
- API: add field → list shows new field, update field properties, delete field, reorder fields, system field protection, relation self-reference prevention, ops-admin role enforcement
- Integration: admin adds custom field → field appears on block detail → user edits value → value persists in metadata

**Gates:** G1, G2, G5

---

## Dependencies

```
BE-01 (field types + schema builder) ─────┐
  ├── BE-02 (field management API)        │
  │     └── FE-02 (field config UI)       │
  │     └── QA-01 (field tests)           │
  └── FE-01 (dynamic field renderer V2)   │
        └── FE-03 (block detail enhance)  │
        └── QA-01 (field tests)           │
```
