# Frontend Tasks — Phase 6, Sprint 22: Workflow Builder UX Foundation

> Tasks for Frontend Engineer. All tasks COMPLETE.
> Sprint 22 is the architecture decomposition sprint — no new features, pure restructuring.

---

## Sprint Header

**Phase:** 6 | **Sprint:** 22 | **Role:** FRONTEND-ENGINEER
**Sprint Goal:** Decompose the 1,697-line `node-config-panel.tsx` monolith into maintainable per-node config components and reusable shared primitives. Build foundation components (duration picker, condition builder, variable picker, schedule config, AI template picker) for Sprint 23 per-node improvements.
**Critical path:** A1 (primitives) + A2 (routing) → A3 (decomposition) → A4–A8 (shared components, parallel)

---

## P6-S22-FE-01: Extract Shared Form Primitives

**Status:** DONE
**Complexity:** LOW
**File:** `src/components/canvas/panels/shared/form-primitives.tsx`

**What was built:**
- FieldLabel, TextInput, TextArea, SelectInput, NumberInput, EntitySelect, CheckboxInput
- All re-exported from a single file, used by all config components
- Also created `panels/types.ts` with NodeConfigProps interface, getNodeData(), makeConfigUpdater() helpers

**Applicable Gates:** G1

---

## P6-S22-FE-02: Extract Routing Section

**Status:** DONE
**Complexity:** LOW
**File:** `src/components/canvas/panels/shared/routing-section.tsx`

**What was built:**
- RoutingSection component with ROUTING_MODE_OPTIONS, ROUTING_ICONS, PERM_LABELS constants
- Reusable in ActionConfig and TaskConfig

**Applicable Gates:** G1

---

## P6-S22-FE-03: Split Config Panel into Per-Node Components

**Status:** DONE
**Complexity:** HIGH
**Files:**
- `src/components/canvas/panels/configs/trigger-config.tsx`
- `src/components/canvas/panels/configs/action-config.tsx` (723 lines, handles all 16 action types)
- `src/components/canvas/panels/configs/condition-config.tsx`
- `src/components/canvas/panels/configs/wait-config.tsx`
- `src/components/canvas/panels/configs/input-config.tsx`
- `src/components/canvas/panels/configs/output-config.tsx`
- `src/components/canvas/panels/configs/task-config.tsx`
- `src/components/canvas/panels/configs/step-instructions-panel.tsx`
- `src/components/canvas/panels/configs/index.ts`
- `src/components/canvas/panels/node-config-panel.tsx` (rewritten: 1,697 → ~90 lines)

**What was built:**
- All config logic extracted from monolith into dedicated per-node components
- Barrel export via index.ts
- Main dispatcher now only handles: header, label field, type-specific component routing, step instructions panel
- Zero TypeScript errors

**Applicable Gates:** G1, G5

---

## P6-S22-FE-04: Build Duration Picker

**Status:** DONE
**Complexity:** MEDIUM
**File:** `src/components/canvas/panels/shared/duration-picker.tsx`

**What was built:**
- Amount (1-99) + Unit (minutes/hours/days/weeks) inputs
- Bidirectional seconds ↔ amount+unit conversion (prefers largest unit that divides evenly)
- Human-readable summary: "This step will wait 2 days"
- Edge cases: 0 seconds defaults to 1 hour, stable IDs via useId()

**Applicable Gates:** G1

---

## P6-S22-FE-05: Build Condition Builder

**Status:** DONE
**Complexity:** HIGH
**File:** `src/components/canvas/panels/shared/condition-builder.tsx`

**What was built:**
- 3-mode progressive disclosure: Simple (single condition) → Compound (AND/OR groups) → Advanced (raw expression)
- 8 operators: is, is_not, contains, not_contains, greater_than, less_than, is_empty, is_not_empty
- Mode switching preserves data (simple→compound copies condition, compound→simple takes first)
- ConditionValue type: { mode, simple?, compound?, advanced? }

**Applicable Gates:** G1

---

## P6-S22-FE-06: Build Inline Variable Picker

**Status:** DONE
**Complexity:** HIGH
**File:** `src/components/canvas/panels/shared/variable-picker.tsx`

**What was built:**
- VariablePickerButton: `{ }` button with searchable grouped dropdown
- VariablePickerInput: TextInput with inline picker button, cursor-position insertion of `{{variable.path}}`
- Click-outside/Escape dismissal, ARIA attributes, search filtering
- Default variable groups (Source Record, Workflow Context) as fallback
- Exported types: Variable, VariableGroup, VariablePickerButtonProps, VariablePickerInputProps

**Applicable Gates:** G1

---

## P6-S22-FE-07: Build Schedule Config

**Status:** DONE
**Complexity:** MEDIUM
**File:** `src/components/canvas/panels/shared/schedule-config.tsx`

**What was built:**
- 6 presets: every_hour, every_day, every_week, every_month, every_quarter, custom
- Conditional fields per preset (time picker, day of week, day of month, frequency+unit)
- 14 timezone options (Australia-first, then APAC, Europe, Americas, UTC)
- Human-readable summary: "Runs every Monday at 9:00 AM"
- No cron syntax exposed anywhere

**Applicable Gates:** G1

---

## P6-S22-FE-08: Build AI Template Picker + Templates Data

**Status:** DONE
**Complexity:** HIGH
**Files:**
- `src/components/canvas/panels/shared/ai-template-picker.tsx`
- `src/lib/workflow/ai-prompt-templates.ts`

**What was built:**
- 14 built-in AI prompt templates across 4 node types (3 analysis, 3 classify, 4 summarise, 4 risk)
- AITemplatePicker component with: template dropdown (filtered by nodeType), prompt textarea, tag-style category inputs (for classify/risk), org policies toggle (risk), output format toggle (analysis), save destination selector
- getTemplatesForNodeType() helper function
- Selecting template pre-fills all fields; all fields remain editable

**Applicable Gates:** G1
