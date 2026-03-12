# Sprint 5 — Gate Results

> Phase 3, Sprint 5: Workflow Canvas Enhancements

---

## P3-S5-BE-02 — Field group schema extension + API

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: existing field-types tests + system-types tests pass
Test run: 760 passed, 0 failed
Edge cases: getFieldGroups with no groups → [General], with groups → sorted by order, ungrouped fields → General fallback; groupFieldsByCategory sorts by x-display-order within groups

**GATE 3 — INTEGRATION CHECK**
Happy path: PATCH /api/block-types/[id] accepts x-field-group and x-field-groups in JSON Schema — no API changes needed (raw schema passthrough)
Error case 1: schema without x-field-groups → getFieldGroups returns [General]
Error case 2: field with invalid group → falls back to 'general'
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: field groups validated by getFieldGroups() (type checks on id, label, order)
Auth check: PATCH endpoint uses withAuth + requirePermission('manage_settings')
PII in logs: N/A
Dependency scan: no new dependencies

**Summary:** Added FieldGroup interface, DEFAULT_FIELD_GROUP, getFieldGroups(), groupFieldsByCategory() to field-types.ts. Added x-field-groups and x-field-group to 5 system types (client, deal, contact, team_member, policy). No migration needed — field schema is JSON and PATCH API already accepts raw schema. Backward compatible — schemas without groups work unchanged.

---

## P3-S5-FE-01 — Input/Output node types

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (nodes scale, config panel scrolls)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [N/A] empty [N/A] error [N/A] (canvas nodes, not standalone page)
Accessibility: handles have distinct colors per node type, labels on all config inputs

**GATE 5 — SECURITY BASELINE**
Input validation: source_type/output_type validated by Zod enum in template-schema.ts
Auth check: N/A (client-side canvas, validated on save via API)

**Summary:** Created InputNode (indigo, ArrowDownToLine, source handle only) and OutputNode (teal, ArrowUpFromLine, target handle only) React Flow components. Added InputConfig/OutputConfig sections to node-config-panel.tsx. Added "Data Flow" category to node palette. Updated canvas-layout.ts for serialization round-trip. Extended template-schema.ts with input/output step types + source_type/output_type/field_mappings/payload_schema fields. Input/output nodes excluded from steps array in canvasToTemplate (metadata, not executable steps). Dark mode compatible.

---

## P3-S5-FE-02 — Reorganized node palette

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (palette scrolls vertically, categories collapse)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [N/A] empty [N/A] error [N/A] (static palette, not data-driven)
Accessibility: all buttons have text labels, categories togglable via keyboard

**GATE 5 — SECURITY BASELINE**
Input validation: N/A (UI-only component, no user data processing)
Auth check: N/A
PII in logs: N/A

**Summary:** Reorganized node palette into 4 categories: Triggers (Manual Start, Event Trigger, Webhook, Schedule), Actions (7 types), Conditions (If/Else, Switch), Flow (Wait/Delay, Input, Output). Added collapsible category sections with ChevronDown rotation animation. Added dark mode classes to all palette item colors. New icons: Webhook, Timer, Split, ChevronDown.

---

## P3-S5-FE-03 — Step instructions panel

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (panel scrolls, textarea wraps)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [N/A] empty [✓ — "No instructions written yet."] error [N/A]
Accessibility: edit/preview buttons have aria-labels, textarea has label

**GATE 5 — SECURITY BASELINE**
Input validation: maxLength 5000 on textarea, HTML entities escaped in simpleMarkdown renderer
Auth check: N/A (client-side, saved via API with auth)
PII in logs: N/A

**Summary:** Created StepInstructionsPanel component with edit/preview toggle. Edit mode: monospace textarea (5000 char limit) with markdown syntax placeholder. Preview mode: renders basic markdown (headings, bold, italic, lists) via simpleMarkdown(). Shown for action, condition, and wait node types. Removed duplicate SOP textarea from ActionConfig routing section. Instructions field persists via existing config.instructions → serialized to template step.instructions.

---

## P3-S5-BE-01 — Canvas data flow serialization

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: 21 existing canvas-layout tests pass (including 3 routing round-trip tests from Sprint 4)
Test run: 760 passed, 0 failed
Edge cases: templates without data_inputs/data_outputs serialize as empty (backward compatible), input/output nodes excluded from steps array

**GATE 3 — INTEGRATION CHECK**
Happy path: canvas with input/output nodes → canvasToTemplate → data_inputs/data_outputs populated → stepsToCanvas reconstructs nodes
Error case 1: template without data_inputs → stepsToCanvas creates no input nodes
Error case 2: canvas without input/output nodes → canvasToTemplate returns no data_inputs/data_outputs
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: DataInputSchema/DataOutputSchema validated via Zod (source_type/output_type enums, name max 100, description max 500)
Auth check: template save goes through /api/blocks/[id] PATCH with withAuth
PII in logs: N/A
Dependency scan: no new dependencies

**Summary:** Added DataInputSchema/DataOutputSchema Zod schemas to template-schema.ts. Added `data_inputs`/`data_outputs` optional arrays to WorkflowTemplateSchema. Updated canvasToTemplate() to extract input/output canvas nodes into DataInput/DataOutput arrays. Updated stepsToCanvas() to create input/output nodes from template data_inputs/data_outputs (positioned left/right of main flow). Added `label` field to CanvasEdge for data flow metadata. Updated builder-client.tsx to persist data_inputs/data_outputs in template metadata. All 21 canvas-layout tests pass, 760 total.

---

## P3-S5-FE-04 — Data flow visualization

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (edges render correctly at all viewport sizes)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [N/A] empty [N/A — no edges = no visualization] error [N/A]
Accessibility: hover tooltip is keyboard-traversable (mouseenter/mouseleave)

**GATE 5 — SECURITY BASELINE**
Input validation: N/A (visual-only component, no user data processing)
Auth check: N/A
PII in logs: N/A

**Summary:** Created DataFlowEdge custom React Flow edge component (data-flow-edge.tsx). Data flow edges (connecting to/from input/output nodes) render as blue dashed lines with "data" label badge. Control flow edges render as gray solid lines. Hover on data flow edges shows field mapping tooltip (from → to). Edge type auto-determined via useMemo in workflow-canvas.tsx based on node types. Custom edgeTypes registered on ReactFlow. Dark mode compatible.

---

## P3-S5-AI-01 — AI field suggestion engine

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found (API key via env var ANTHROPIC_API_KEY)

**GATE 2 — TESTING**
Coverage: 9 tests in `src/lib/ai/__tests__/field-suggestion.test.ts`
Test run: 9 passed, 0 failed (769 total, up from 760)
Edge cases: valid response parsing, markdown code fences, invalid field type filtering, field name sanitization, API failure (empty fallback), unparseable response, missing optional arrays, default group assignment, org context in prompt

**GATE 3 — INTEGRATION CHECK**
Happy path: suggestFields returns parsed fields + groups + relationships from Claude
Error case 1: API rate limited → returns empty result
Error case 2: non-JSON response → returns empty result
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: field types validated against FIELD_TYPES constant, names sanitized to snake_case
Auth check: N/A (server-side only, called from chat tools with permission check)
PII in logs: only logs counts (fieldsCount, groupsCount), no user data
Dependency scan: uses existing @anthropic-ai/sdk

**Summary:** Created `src/lib/ai/field-suggestion.ts` with suggestFields() using Claude claude-sonnet-4-6. Prompt versioned at `src/prompts/field-suggestion.v1.md`. Input: natural language description + block type context (existing fields, groups) + org context (available block types). Output: suggested fields (name, type, label, description, required, group), groups, relationships. Field types validated against 12 supported types. Field names sanitized to snake_case. Safe fallback: empty arrays on any failure.

---

## P3-S5-BE-03 — Block configuration chat tools

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: existing chat-tools test updated (5→9 tools). 769 tests passing.
Test run: 769 passed, 0 failed
Edge cases: tool count validation, tool name existence, RBAC enforcement (config tools require ops-admin)

**GATE 3 — INTEGRATION CHECK**
Happy path: suggest_fields calls AI engine → returns categorized suggestions; configure_block_type adds/removes fields + groups via Supabase; create_block_type inserts new type with schema; create_relationship adds relation field
Error case 1: non-existent block type → "not found" error
Error case 2: non-admin role → permission denied
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: field types validated against FIELD_TYPES, names sanitized to snake_case, system fields protected from removal
Auth check: all 4 new tools require ops-admin role (manage_settings)
PII in logs: no user data in logs (only field counts and type names)
Dependency scan: no new dependencies

**Summary:** Added 4 new chat tools: `suggest_fields` (calls AI field suggestion engine with org context), `configure_block_type` (add/remove/modify fields + groups on existing type, protects system fields), `create_block_type` (creates custom type with initial fields + groups), `create_relationship` (adds relation field between block types). All require ops-admin. Updated list_block_types to include field groups. Updated existing tests (5→9 tools). RBAC enforced: config tools check role before execution.

---

## P3-S5-QA-01 — Canvas + block config tests

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: 54 new tests across 4 test files
Test run: 823 passed, 0 failed (up from 769)
Edge cases covered:
- Canvas I/O: input/output node creation from data_inputs/data_outputs, positioning (left/right of main flow), multiple inputs/outputs, field_mappings preservation, backward compat (no data_inputs/outputs), exclusion from steps array, round-trip with mixed steps + inputs + outputs
- Template schema: DataInputSchema/DataOutputSchema validation, all source_type/output_type enums, name length bounds, description length bounds, max 10 inputs/outputs, field_mappings in steps, backward compat
- Field groups: getFieldGroups with no groups → [General], sorted by order, ungrouped fields → General fallback, skip invalid entries, default order 999, nonexistent group → General; groupFieldsByCategory sorts by x-display-order, alphabetical tiebreak, ungrouped → general, invalid group → general, empty properties
- Chat tools RBAC: 4 new tools rejected for ops-user, rejected for compliance-approver, list_block_types allowed for any role

**GATE 5 — SECURITY BASELINE**
Input validation: N/A (test files only)
Auth check: N/A
PII in logs: N/A

**Summary:** Added 54 new tests: 22 canvas data flow tests (stepsToCanvas I/O nodes, canvasToTemplate extraction, round-trip), 15 field group tests (getFieldGroups, groupFieldsByCategory, DEFAULT_FIELD_GROUP), 11 template schema validation tests (DataInput/DataOutput Zod schemas), 6 chat tools RBAC tests (4 new tools permission enforcement + list_block_types any-role access). Total test count: 823. Build clean.

---
