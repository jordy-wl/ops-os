# Frontend Tasks — Phase 6, Sprint 23: Workflow Builder UX — Per-Node Improvements

> Tasks for Frontend Engineer (+ 1 Backend task). All tasks OPEN.
> Sprint 23 uses the Phase A shared components to upgrade every node's config panel.
> Full design spec: `.claude/plans/ancient-hopping-crown.md`

---

## Sprint Header

**Phase:** 6 | **Sprint:** 23 | **Role:** FRONTEND-ENGINEER, BACKEND-ENGINEER
**Sprint Goal:** Wire all Sprint 22 shared components into the per-node configs. Add 2 new node types (Route, For Each). Replace condition handler stub. Make every config panel context-aware, entity-driven, and non-technical-user-friendly.
**Critical path:** B1 (triggers) + B2 (labels) → B3 (route node) + B4 (AI templates) → B10 (variable picker) → B13 (auto-fill)
**Dependencies:** Sprint 22 (all 8 tasks DONE)

---

## P6-S23-FE-01: Trigger Configs — Event, Schedule, Webhook

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S22-FE-07 (ScheduleConfig), P6-S22-FE-05 (ConditionBuilder)

**Description:** Upgrade TriggerConfig to support 4 trigger types with full config:
- **Manual:** No additional config (just the label field from dispatcher)
- **Event:** Searchable dropdown grouped by category (Record/Workflow/Integration/System events). Event scope: "All records" / "Records matching filters" (uses ConditionBuilder) / "Specific record" (EntitySelect)
- **Webhook:** Connector dropdown (from entities.connectors), auto-generated webhook URL with copy button, expected payload field definitions (name + type rows)
- **Schedule:** ScheduleConfig integration (presets, timezone, conditional fields)

**Acceptance Criteria:**
- [ ] TriggerConfig renders 4 distinct UIs based on trigger type
- [ ] Event trigger scope works with condition builder for filter mode
- [ ] Schedule config uses ScheduleConfig shared component (no raw inputs)
- [ ] Webhook shows full config with connector picker + URL + payload schema
- [ ] Manual trigger shows "No configuration needed" message

**Files:** `src/components/canvas/panels/configs/trigger-config.tsx`
**Applicable Gates:** G1, G2, G4

---

## P6-S23-FE-02: Node Label Renames

**Status:** OPEN
**Complexity:** LOW
**Depends on:** None

**Description:** Rename all palette items and config panel labels to user-friendly names:
- `emit_event` → "Log Event"
- `call_api` → "External Action"
- `route_human` / `route_agent` → consolidated into "Create Task" routing mode
- `wait` → "Wait / Delay"
- `run_sub_workflow` → "Run Sub-Workflow"
- Ensure NODE_TYPE_LABELS in node-config-panel.tsx matches palette labels
- Update node-palette.tsx category and item labels

**Acceptance Criteria:**
- [ ] All palette items use user-friendly names
- [ ] Config panel headers match palette labels
- [ ] No snake_case visible in any user-facing label

**Files:** `src/components/canvas/node-palette.tsx`, `src/components/canvas/panels/node-config-panel.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-03: Route Node (New)

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S23-FE-02

**Description:** Create a new Route node type with:
- "Route based on" dropdown showing any context value (record fields, AI classification results, previous step outputs)
- Dynamic branch list: each branch has "when [value]" + optional label + remove button
- "Add Branch" button, "Default" branch always present (cannot be removed)
- N output handles (one per branch + default), visually labeled
- When preceded by a Classify node, auto-suggest classification categories as branches
- Backend handler: evaluates route_field against context, returns matched branch index

**Acceptance Criteria:**
- [ ] Route node renders on canvas with N output handles
- [ ] Config panel shows field selector + dynamic branch list
- [ ] Default branch cannot be removed
- [ ] New branches can be added/removed
- [ ] Schema updated: `route` step type, `route_field`, `route_branches`, `route_default_label`
- [ ] Backend handler: `src/lib/workflow/step-handlers/route.ts`
- [ ] Handler registered in `registry.ts`

**Files:** `src/components/canvas/nodes/route-node.tsx` (new), `src/components/canvas/panels/configs/route-config.tsx` (new), `src/lib/workflow/step-handlers/route.ts` (new), `src/lib/workflow/template-schema.ts`, `src/components/canvas/workflow-canvas.tsx`, `src/lib/workflow/canvas-layout.ts`
**Applicable Gates:** G1, G2, G3, G5

---

## P6-S23-FE-04: AI Template Picker Integration

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** P6-S22-FE-08 (AITemplatePicker)

**Description:** Wire AITemplatePicker into all 4 AI node config sections within ActionConfig:
- `ai_analysis` → AITemplatePicker with nodeType='ai_analysis', outputFormat toggle
- `ai_classify` → AITemplatePicker with nodeType='ai_classify', categories tag input
- `ai_summarize` → AITemplatePicker with nodeType='ai_summarise', no extra config
- `ai_risk_assessment` → AITemplatePicker with nodeType='ai_risk', risk categories + org policies
- All: save result destination selector

**Acceptance Criteria:**
- [ ] Each AI node shows template dropdown with filtered templates
- [ ] Selecting template pre-fills prompt, categories, format, etc.
- [ ] Prompt always editable after template selection
- [ ] Categories show as tag pills with add/remove (classify + risk)
- [ ] Save destination dropdown works

**Files:** `src/components/canvas/panels/configs/action-config.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-05: External Action Consolidation

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** P6-S23-FE-02

**Description:** Consolidate external action palette items into a single "External Action" node with:
- Step 1: Connector dropdown (from org's configured connectors)
- Step 2: Provider-specific action templates (Xero: Create Invoice, Update Contact; HubSpot: Create Deal; etc.)
- Step 3: Template pre-fills method, path, body_template; user can customise
- Manual config fallback: method dropdown, path, body (with variable picker), timeout, retries
- Create `src/lib/workflow/connector-templates.ts` with provider-specific action templates

**Acceptance Criteria:**
- [ ] Single "External Action" in palette (replaces call_api / store_file / webhook_send)
- [ ] Connector selection drives available action templates
- [ ] Manual config available for unknown connectors
- [ ] Template data file created

**Files:** `src/components/canvas/panels/configs/action-config.tsx`, `src/lib/workflow/connector-templates.ts` (new), `src/components/canvas/node-palette.tsx`
**Applicable Gates:** G1, G2, G4

---

## P6-S23-FE-06: Data Operations Abstraction

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** P6-S22-FE-06 (VariablePicker)

**Description:** Upgrade data operation node configs to use domain language:
- **Create Record:** Record type dropdown (from entities.blockTypes), auto-populate matching fields from source record, auto-link toggle (default ON), relationship type dropdown
- **Change Status:** Record selector (default: triggering record), status dropdown from lifecycle stages (from org settings), optional note textarea
- **Link Records:** From/To record selectors, relationship dropdown (Belongs to, Related to, Assigned to, Depends on, Part of, Parent of, Stakeholder of, Custom)
- **Search/Filter:** Record type dropdown, filter conditions (condition builder), max results, save-results-as variable name

**Acceptance Criteria:**
- [ ] All data op nodes use entity-driven dropdowns (not free text)
- [ ] Create Record auto-populates matching fields
- [ ] Status dropdown populated from org lifecycle stages
- [ ] Link Records relationship uses predefined options + custom fallback

**Files:** `src/components/canvas/panels/configs/action-config.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-07: Human Interaction Improvements

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** P6-S22-FE-04 (DurationPicker)

**Description:** Upgrade human interaction node configs:
- **Approval Request:** Pre-configure as Create Task with auto-filled title ("Approval Required") + Approve/Reject buttons. Same full config underneath.
- **Send Notification:** Channel radio (in-app/email/both), title/body with variable picker, type dropdown (info/success/warning/error). Collapsible email settings section when email selected.
- **Share Link:** Block picker, link type (view/fill/sign), expiry duration picker, permissions (field picker or full record), auth/password toggles, branding toggle.
- **Create Task attachments:** Add attachments section — type selector (Related Record / URL / File / Context Summary) + value input per attachment.

**Acceptance Criteria:**
- [ ] Approval Request auto-fills sensible defaults
- [ ] Notification channel toggle shows/hides email section
- [ ] Share Link uses duration picker for expiry
- [ ] Task attachments support 4 attachment types

**Files:** `src/components/canvas/panels/configs/action-config.tsx`, `src/components/canvas/panels/configs/task-config.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-08: Wait/Delay Duration Picker Integration

**Status:** OPEN
**Complexity:** LOW
**Depends on:** P6-S22-FE-04 (DurationPicker)

**Description:** Replace the raw number input in WaitConfig with DurationPicker:
- Import DurationPicker from shared components
- Replace the wait_seconds NumberInput with DurationPicker(value=wait_seconds, onChange)
- Remove manual formatDuration helper (DurationPicker handles display)

**Acceptance Criteria:**
- [ ] WaitConfig uses DurationPicker component
- [ ] Duration displays as amount + unit (not raw seconds)
- [ ] Human-readable summary shown below
- [ ] Backwards compatible: existing wait_seconds values render correctly

**Files:** `src/components/canvas/panels/configs/wait-config.tsx`
**Applicable Gates:** G1

---

## P6-S23-FE-09: Sub-Workflow Preview Dropdown

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** None

**Description:** Upgrade the Run Sub-Workflow node config:
- Workflow template dropdown: all published templates in org (fetched via useOrgEntities enhancement)
- Mini read-only step preview below dropdown: vertical list of step names + type icons
- "Wait for completion?" toggle (default OFF)
- Optional input mapping: map current context variables to sub-workflow inputs
- Enhance useOrgEntities to fetch workflow templates

**Acceptance Criteria:**
- [ ] Workflow dropdown populated from org's published templates
- [ ] Mini preview shows step names + icons when template selected
- [ ] Wait toggle works
- [ ] useOrgEntities returns workflow templates

**Files:** `src/components/canvas/panels/configs/action-config.tsx`, `src/components/canvas/hooks/use-org-entities.ts`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-10: Variable Picker Wiring (All Configs)

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S22-FE-06 (VariablePicker), P6-S23-FE-01 through P6-S23-FE-09

**Description:** Replace TextInput with VariablePickerInput across all config components where template variables are relevant:
- Send Email: To, CC, BCC, Subject, Body, Reply-To
- Generate Document: Prompt
- Book Meeting: Title, Description, Attendees
- Create Task: Title
- All AI nodes: Prompt
- Update Record: Field values
- Create Record: Field values
- Notifications: Title, Body
- Populate variable groups from source record type field definitions + workflow context

**Acceptance Criteria:**
- [ ] All template-variable-enabled fields use VariablePickerInput
- [ ] Variable groups populated from actual entity field definitions
- [ ] `{ }` button visible on all variable-enabled inputs
- [ ] Inserting variable works at cursor position

**Files:** `src/components/canvas/panels/configs/action-config.tsx`, `src/components/canvas/panels/configs/task-config.tsx`, `src/components/canvas/panels/configs/trigger-config.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-11: For Each Node (New)

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S23-FE-03 (Route node — similar pattern)

**Description:** Create a new For Each node type:
- "For each item in" dropdown: search results from previous Search/Filter step, list field on source record, API response array
- Subsequent connected steps execute per item
- "Max parallel" dropdown: 1 / 5 / 10 / 25
- Safety: max iterations limit (default 100, configurable)
- Backend handler: iterates over list, spawns sub-executions per item
- Schema changes: `for_each` step type, `for_each_source`, `for_each_max_parallel`, `for_each_max_iterations`

**Acceptance Criteria:**
- [ ] For Each node renders on canvas
- [ ] Config panel shows source dropdown + max parallel + max iterations
- [ ] Schema updated with for_each fields
- [ ] Backend handler created and registered
- [ ] Canvas layout handles for_each node

**Files:** `src/components/canvas/nodes/for-each-node.tsx` (new), `src/components/canvas/panels/configs/for-each-config.tsx` (new), `src/lib/workflow/step-handlers/for-each.ts` (new), `src/lib/workflow/template-schema.ts`, `src/components/canvas/workflow-canvas.tsx`, `src/lib/workflow/canvas-layout.ts`
**Applicable Gates:** G1, G2, G3, G5

---

## P6-S23-FE-12: Workflow Completion Config

**Status:** OPEN
**Complexity:** LOW
**Depends on:** P6-S22-FE-04 (DurationPicker)

**Description:** Add workflow-level completion behavior config (not a node — in workflow settings):
- "When this workflow completes": Do nothing (default) / Restart after delay (DurationPicker) / Trigger another workflow (workflow dropdown)
- Add to template schema: `completion_behavior`, `completion_delay_seconds`, `completion_trigger_template_id`
- Surface in workflow builder settings panel (or top bar)

**Acceptance Criteria:**
- [ ] Completion behavior dropdown in workflow settings
- [ ] "Restart after delay" shows DurationPicker
- [ ] "Trigger another workflow" shows workflow dropdown
- [ ] Schema updated with completion fields

**Files:** `src/components/canvas/workflow-canvas.tsx` (or new settings panel), `src/lib/workflow/template-schema.ts`
**Applicable Gates:** G1

---

## P6-S23-FE-13: Context-Aware Auto-Fill

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S23-FE-10 (Variable picker wired)

**Description:** Implement smart defaults based on source record type:
- **Send Email:** Auto-suggest `{{block.email}}` in To field when source type has email field
- **Book Meeting:** Auto-suggest `{{block.name}} Meeting` in title, auto-suggest contacts as attendees
- **Generate Document:** Auto-suggest `{{block.name}}` in title
- **Create Record:** Auto-populate fields where source record field names match new record type fields
- **Create Task:** Auto-suggest block name in title
- Use VariablePickerInput `autoSuggestion` prop for the placeholder hints

**Acceptance Criteria:**
- [ ] Send Email auto-fills recipient from block's email field
- [ ] Book Meeting auto-fills title and suggests contacts
- [ ] Create Record auto-populates matching fields
- [ ] Auto-suggestions shown as dimmed placeholders, not forced values

**Files:** `src/components/canvas/panels/configs/action-config.tsx`
**Applicable Gates:** G1, G4

---

## P6-S23-FE-14: External Action Test + Preview

**Status:** OPEN
**Complexity:** MEDIUM
**Depends on:** P6-S23-FE-05 (External action consolidated)

**Description:** Add a "Test + Preview" button to External Action config:
- Shows full request preview: URL, headers (redacted auth), body with sample data from source record
- "Send Test" button executes the request and shows response inline
- Response displayed in a collapsible section (status code, headers, body)
- Use source record's actual data for preview interpolation

**Acceptance Criteria:**
- [ ] "Preview Request" button shows formatted request
- [ ] "Send Test" executes and shows response
- [ ] Auth headers redacted in preview
- [ ] Error states handled (timeout, connection refused, etc.)

**Files:** `src/components/canvas/panels/configs/action-config.tsx`
**Applicable Gates:** G1, G5

---

## P6-S23-BE-15: Condition Handler Implementation

**Status:** OPEN
**Complexity:** HIGH
**Depends on:** P6-S22-FE-05 (ConditionBuilder — defines the data format)
**Role:** BACKEND-ENGINEER

**Description:** Replace the condition handler stub (`src/lib/workflow/step-handlers/condition.ts`) with a real expression evaluator:
- Parse ConditionValue from step config
- Simple mode: evaluate field/operator/value against workflow context
- Compound mode: evaluate AND/OR groups
- Advanced mode: evaluate raw expression with `{{variable}}` interpolation
- Support all 8 operators: is, is_not, contains, not_contains, greater_than, less_than, is_empty, is_not_empty
- Return boolean result that determines which output branch the workflow follows

**Acceptance Criteria:**
- [ ] Simple conditions evaluate correctly (all 8 operators)
- [ ] Compound AND conditions: all must be true
- [ ] Compound OR conditions: any must be true
- [ ] is_empty/is_not_empty work for null, undefined, empty string
- [ ] Template variables in values are interpolated from context
- [ ] Unit tests cover all operators + AND/OR + edge cases
- [ ] Existing workflows with condition steps still work

**Files:** `src/lib/workflow/step-handlers/condition.ts`
**Applicable Gates:** G1, G2, G3, G5
