# Sprint 12 — Frontend Engineer Tasks

**Sprint:** 12 — User-Configurable Block Fields
**Role:** Frontend Engineer
**Tasks:** 3 (2 HIGH, 1 MED)

---

## P2-S12-FE-01 — Dynamic Field Renderer V2 (HIGH)

**Priority:** 1 (after BE-01 completes)
**Deps:** BE-01
**Branch:** `feature/P2-S12-FE-01-field-renderer-v2`

### What to Build

Rewrite `dynamic-field-renderer.tsx` as a dispatcher to per-type field components. Support all 12 field types in both edit and view modes.

### Key Files

**Read first:**
- `src/components/blocks/dynamic-field-renderer.tsx` — V1 renderer (184 lines, rewrite)
- `src/components/blocks/block-data-panel.tsx` — wraps renderer (64 lines)
- `src/lib/block-types/field-types.ts` — (from BE-01) field type definitions
- `src/lib/block-types/system-types.ts` — existing schemas to test against

**Create (per-type components):**
- `src/components/blocks/fields/date-field.tsx`
- `src/components/blocks/fields/multi-select-field.tsx`
- `src/components/blocks/fields/relation-field.tsx`
- `src/components/blocks/fields/currency-field.tsx`
- `src/components/blocks/fields/rich-text-field.tsx`
- `src/components/blocks/fields/url-field.tsx`
- `src/components/blocks/fields/phone-field.tsx`

**Modify:**
- `src/components/blocks/dynamic-field-renderer.tsx` — rewrite as type dispatcher

### Implementation Notes

- Each component: `{ value, onChange, fieldDef, mode: 'edit' | 'view', error? }`
- View mode: formatted display (linked URLs, formatted dates, currency with symbol)
- Edit mode: validated inputs with error messages
- Relation field: fetches `/api/blocks?type={target}` for autocomplete
- Render order: sort by `x-display-order` from field_schema properties
- Existing field types (text, number, email, boolean, select) must not regress

### Gates
G1 (lint), G2 (unit tests per field type), G4 (responsive, all states), G5 (security)

---

## P2-S12-FE-02 — Field Configuration UI (admin) (HIGH)

**Priority:** 2 (after BE-02 completes)
**Deps:** BE-02
**Branch:** `feature/P2-S12-FE-02-field-config-ui`

### What to Build

Settings UI for ops-admins to manage block type fields — HubSpot-style property management.

### Key Files

**Read first:**
- `src/app/(app)/settings/brand/page.tsx` — existing settings page pattern
- `src/components/shell/page-container.tsx` — page wrapper (Sprint 11)
- `src/components/shell/content-section.tsx` — section component (Sprint 11)
- `src/components/shell/app-sidebar.tsx` — Settings nav item (`/settings/brand`)

**Create:**
- `src/app/(app)/settings/block-types/page.tsx` — type list
- `src/app/(app)/settings/block-types/[id]/page.tsx` — field management
- `src/app/(app)/settings/block-types/loading.tsx` — loading skeleton
- `src/components/settings/field-config-panel.tsx` — field property editor
- `src/components/settings/field-list.tsx` — sortable field list

**Modify:**
- `src/components/shell/app-sidebar.tsx` — add "Block Types" sub-item under Settings (or update Settings href)

### Implementation Notes

- Type list: card grid showing type icon, name, field count, block count
- Type detail: two-column layout (field list left, config panel right)
- Field list: sortable (drag or up/down buttons), lock icon on system fields
- Field config: field name (immutable after creation), type selector, type-specific options
- "Add Field" button: opens type selector → creates with defaults → focuses config panel
- All API calls through `/api/block-types/[id]/fields/` endpoints (BE-02)

### Gates
G1 (lint), G4 (responsive at 375/768/1280/1920px, all states), G5 (security)

---

## P2-S12-FE-03 — Block Detail Page Enhancement (MED)

**Priority:** 3 (after FE-01 completes)
**Deps:** FE-01
**Branch:** `feature/P2-S12-FE-03-block-detail-v2`

### What to Build

Upgrade block detail page to use V2 field renderer with inline editing.

### Key Files

**Read first:**
- `src/app/(app)/blocks/[id]/page.tsx` — server component (185 lines)
- `src/components/blocks/block-data-panel.tsx` — data display (64 lines)
- `src/components/blocks/dynamic-field-renderer.tsx` — V2 renderer (from FE-01)

**Modify:**
- `src/app/(app)/blocks/[id]/page.tsx` — pass edit mode props
- `src/components/blocks/block-data-panel.tsx` — inline edit mode, save on blur/Enter

### Implementation Notes

- Click field value → switch to edit mode (ops-admin/ops-user only)
- Save: PATCH `/api/blocks/[id]` with updated metadata
- Optimistic UI: update immediately, rollback on error with toast
- Relation fields: show block name with link to `/blocks/{related_id}`
- Animate field updates: `scale-in` effect on save confirmation
- Field type icons next to labels (from field type definitions)

### Gates
G1 (lint), G4 (responsive, inline edit at all breakpoints), G5 (security)
