# Sprint 4 — Frontend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P1-S4-FE-01: Dashboard Empty State CTA

**Complexity:** LOW | **Est:** 0.5d | **Blocked By:** none
**Applicable Gates:** 1 (Code Quality), 4 (Frontend Quality), 5 (Security Baseline)

**Description:** When a user signs in for the first time, the dashboard is empty and disorienting. Add a "Create your first Block" CTA when no blocks exist for the org.

**Acceptance Criteria:**
- [ ] Dashboard shows a CTA when org has 0 blocks
- [ ] CTA links to `/blocks` with a prompt to create
- [ ] CTA disappears once blocks exist
- [ ] Responsive at 375px and 1280px

**Files likely modified:**
- `src/app/(app)/dashboard/page.tsx`

---

## P2-S4-FE-02: Dynamic Block Forms from field_schema

**Complexity:** MEDIUM | **Est:** 2d | **Blocked By:** P2-S4-BE-02, P2-S4-DE-01
**Applicable Gates:** 1, 4, 5

**Description:** Instead of hardcoded block metadata fields, render form fields dynamically based on the block type's `field_schema` from `block_type_definitions`. Support text, number, select, and boolean field types.

**Acceptance Criteria:**
- [ ] Block create form renders fields from the type's field_schema
- [ ] Block detail page shows metadata fields from field_schema
- [ ] Supported field types: text, number, select (enum), boolean
- [ ] Validation matches JSON Schema constraints (required, minLength, enum)
- [ ] Falls back to free-form metadata editor if no field_schema defined
- [ ] Responsive at 375px and 1280px

**Files likely modified:**
- `src/components/blocks/block-create-form.tsx` (new or modified)
- `src/components/blocks/block-data-panel.tsx` (render dynamic fields)
- `src/app/(app)/blocks/page.tsx` (pass block types to form)
