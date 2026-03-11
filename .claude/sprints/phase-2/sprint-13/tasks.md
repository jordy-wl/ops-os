# Sprint 13 Tasks — update_block + Canvas-First + Remove Hardcoded

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 13
**Sprint Goal:** Workflows can modify block fields via update_block step. Remove hardcoded onboarding. Creating a workflow opens canvas directly.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 12 (User-Configurable Fields) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S13-BE-01 | `update_block` step type | Backend | HIGH | — | OPEN |
| P2-S13-FE-01 | Update Block canvas node | Frontend | MED | BE-01 | OPEN |
| P2-S13-BE-02 | Remove hardcoded onboarding | Backend | MED | — | OPEN |
| P2-S13-FE-02 | Canvas-first workflow creation | Frontend | MED | — | OPEN |
| P2-S13-QA-01 | Workflow system tests | QA | MED | BE-01, FE-01 | OPEN |

**Total:** 5 tasks (2 BE, 2 FE, 1 QA)
**Critical path:** BE-01 → FE-01 → QA-01

---

## Task Details

### P2-S13-BE-01 — `update_block` Step Type (HIGH)

**What:** Add `update_block` as a workflow step type that resolves a target block, validates against field_schema, applies a PATCH to block metadata, and emits a `block.updated` event.

**Context:**
- Existing: `src/lib/workflow/template-schema.ts` — step type enum (8 types, line 28)
- Existing: `src/lib/workflow/step-engine.ts` — executeStep switch (518 lines)
- Existing: `src/lib/workflow/canvas-layout.ts` — stepTypeToNodeType/stepToLabel mappings
- New from Sprint 12: `src/lib/block-types/field-types.ts` — field type validation
- New from Sprint 12: `src/lib/block-types/field-schema-builder.ts` — extractFieldsFromSchema

**Files to modify:**
- `src/lib/workflow/template-schema.ts` — add `'update_block'` to step type enum + config fields
- `src/lib/workflow/step-engine.ts` — add `case 'update_block'` handler
- `src/lib/workflow/canvas-layout.ts` — add update_block to stepTypeToNodeType, stepToLabel, stepToConfig, configToStep

**Files to create:**
- `src/lib/workflow/step-handlers/update-block.ts` — handler implementation

**Handler logic:**
1. Resolve target block ID from step config:
   - Literal UUID: `config.block_id`
   - Context reference: `{{context.source_block_id}}` (the block that triggered the workflow)
   - Relation follow: `{{block.relation_field}}` (follow a relation field to get target)
2. Fetch target block, verify org_id matches
3. Validate field updates against block type's field_schema (if schema exists)
4. Apply PATCH to block metadata (merge, not replace)
5. Emit `block.updated` event with `actor_type: 'workflow'`, `actor_id: instance_id`
6. Return step result with updated fields list

**Template expression injection protection:**
- Only allow `{{context.*}}` and `{{block.*}}` prefixes
- Sanitize values: no template expressions in field values themselves
- Validate field names against field_schema whitelist

**Gates:** G1, G2, G3, G5, G6

---

### P2-S13-FE-01 — Update Block Canvas Node (MED)

**What:** Add an "Update Block" node type to the workflow canvas with a config panel for selecting target block type, field, and value.

**Context:**
- Existing: `src/components/canvas/workflow-canvas.tsx` — React Flow canvas
- Existing: `src/components/canvas/node-palette.tsx` — draggable node palette
- Existing: `src/components/canvas/nodes/action-node.tsx` — generic action node
- Existing: `src/components/canvas/panels/node-config-panel.tsx` — config panel

**Files to create:**
- `src/components/canvas/nodes/update-block-node.tsx` — custom node with block type + field preview

**Files to modify:**
- `src/components/canvas/workflow-canvas.tsx` — register update-block-node type
- `src/components/canvas/node-palette.tsx` — add "Update Block" to palette
- `src/components/canvas/panels/node-config-panel.tsx` — add update_block config section (block type selector, field picker, value input/template expression)

**Details:**
- Node displays: icon + "Update Block" label + target type name + field count
- Config panel: block type dropdown → field dropdown (from field_schema) → value input (type-appropriate)
- Value can be literal or template expression (`{{context.source_block_id}}`, `{{block.field_name}}`)
- Config serializes to: `{ step_type: 'update_block', block_id: '...', fields: { field_name: value } }`

**Gates:** G1, G4, G5

---

### P2-S13-BE-02 — Remove Hardcoded Onboarding (MED)

**What:** Delete hardcoded onboarding handler and UI components. Clean up references. Onboarding is now a workflow template that users create via canvas.

**Context:**
- Existing: `src/lib/actions/handlers/onboarding-start.ts` — onboarding action handler
- Existing: `src/lib/workflow/handlers/onboarding.ts` — workflow handler
- Existing: `src/lib/workflow/registry.ts` — registers onboarding handler
- Existing: `src/lib/actions/registry.ts` — registers onboarding.start action
- Existing: `src/components/blocks/start-onboarding-button.tsx` — UI button
- Existing: `src/app/(app)/blocks/[id]/page.tsx` — imports StartOnboardingButton

**Files to delete:**
- `src/lib/actions/handlers/onboarding-start.ts`
- `src/lib/workflow/handlers/onboarding.ts`
- `src/components/blocks/start-onboarding-button.tsx`

**Files to modify:**
- `src/lib/actions/registry.ts` — remove `onboarding.start` entry + import
- `src/lib/workflow/registry.ts` — remove `onboarding` entry + import
- `src/app/(app)/blocks/[id]/page.tsx` — remove StartOnboardingButton import + usage (lines 10, 159-166)

**Pre-deletion check:**
- Verify no production workflow_jobs reference 'onboarding' type (query DB if connected)
- Verify no tests import deleted files (update/remove test cases)

**Gates:** G1, G2, G5

---

### P2-S13-FE-02 — Canvas-First Workflow Creation (MED)

**What:** "Create Workflow" shows a name-only input, then immediately redirects to `/workflows/{id}/builder`. Pre-place a trigger node on the empty canvas. Support inline name editing in builder.

**Context:**
- Existing: `src/components/workflows/workflow-templates-client.tsx` — CreateTemplateModal (509 lines)
- Existing: `src/app/(app)/workflows/[id]/builder/builder-client.tsx` — canvas builder page
- Existing: `src/app/(app)/workflows/[id]/builder/page.tsx` — server component

**Files to modify:**
- `src/components/workflows/workflow-templates-client.tsx` — replace CreateTemplateModal with lightweight name-only dialog → create block → redirect to builder
- `src/app/(app)/workflows/[id]/builder/builder-client.tsx` — add inline name editing, pre-place trigger node on empty canvas, add "applies_to_type" selector in builder header

**Details:**
- New flow: Click "Create" → modal with just name input → POST /api/blocks (type: workflow_template, minimal metadata) → redirect to /workflows/{id}/builder
- Builder loads template → if no canvas_layout, auto-place trigger node at top-center
- Builder header: editable name (click to edit), type selector (applies_to: client/deal/project/etc.)
- Save button serializes canvas → steps via canvasToTemplate() → PATCH /api/blocks/{id}

**Gates:** G1, G4, G5

---

### P2-S13-QA-01 — Workflow System Tests (MED)

**What:** Unit tests for update_block handler. Integration test for step engine executing update_block. Canvas layout conversion tests for new node type.

**Files to create:**
- `src/lib/workflow/step-handlers/__tests__/update-block.test.ts` — handler unit tests
- `src/lib/workflow/__tests__/canvas-layout-update-block.test.ts` — canvas conversion tests

**Files to modify:**
- Existing step-engine tests if any — add update_block case

**Test cases:**
- update_block handler: resolves literal block_id, resolves context reference, validates field against schema, applies PATCH, emits event, rejects invalid field, rejects cross-org block
- Canvas layout: update_block maps to 'action' node type, stepToLabel returns "Update Block", round-trip conversion (steps → canvas → steps preserves update_block config)
- Onboarding removal: verify no imports reference deleted files, registry has no onboarding entry

**Gates:** G1, G2, G5

---

## Dependencies

```
BE-01 (update_block step) ────┐
  ├── FE-01 (canvas node)     │
  └── QA-01 (system tests)    │

BE-02 (remove onboarding) ──── independent
FE-02 (canvas-first creation) ── independent
```
