# PRD Layer 06: Frontend Specification

> Last updated: 2026-03-12 | Author: Frontend Engineer | Status: DRAFT
> Cross-references: `prd/05-api-contracts.md` (data source), `prd/02-user-research.md` (user journeys).
> Frontend engineer: read this before claiming tasks.

---

## Design System Reference

**Framework:** Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui

**Designs:** No Figma designs in Phase 1 — shadcn/ui components provide the baseline. Tailwind for layout and spacing. Functional over beautiful; correctness over aesthetics in Phase 1.

**Breakpoints (all components tested at all 4):**
- 375px — mobile
- 768px — tablet
- 1280px — desktop (primary target for ops-lead persona)
- 1920px — large desktop

**Primary UI target:** Desktop (1280px+). Primary persona (capital markets ops lead) uses desktop. Mobile is a Phase 3+ concern.

**Component library:** shadcn/ui — Dialog, Table, Form, Badge, Sheet, Tabs, Command, Toast
**Styling:** Tailwind utility classes. No custom CSS unless unavoidable.
**Data fetching:** TanStack Query (React Query) for client-side; Next.js Server Components for initial load
**Form handling:** react-hook-form + zod for validation

---

## Core User Flows

### Flow 1: Dashboard — Ops Overview

```
Screen: Dashboard (route: /)
Purpose: Overview of all active business entities and their status
Key elements:
  - Header with org name and user avatar
  - Stats strip: total active blocks, pending workflow steps, recent events (last 24h)
  - Block list table: name, type, status, jurisdiction, last event, workflow progress
  - Filter controls: by type, status, jurisdiction
  - "New Block" button
Actions: Click block → Block Detail | Click "New Block" → Create Block sheet | Filter blocks
```

---

### Flow 2: Block Detail — Entity Deep Dive

```
Screen: Block Detail (route: /blocks/[id])
Purpose: Full view of one business entity: its data, graph connections, event timeline, workflow status
Key elements:
  - Block header: name, type badge, status badge, jurisdiction
  - Tabs: Overview | Timeline | Graph | Workflow
  - Overview tab: block data fields (rendered dynamically from block_type_definitions.field_schema in Phase 2; hardcoded per type in Phase 1), related blocks (graph edges)
  - Timeline tab: chronological event log — event type, actor, payload summary, timestamp
  - Graph tab: visual list of connected blocks (text-based in Phase 1; canvas in Phase 3)
  - Workflow tab: current workflow instance status, step history, task queue items, approve/reject controls
  - Tasks tab (Phase 2): pending task_queue_items for this block's active workflow instances
Actions:
  - "Edit block" → inline form for block.update action
  - "Approve step" → triggers workflow.step.approve action → toast confirmation
  - "Add connection" → block.edge.create sheet
  - "Start Onboarding" button (Phase 1, client blocks only) → POST /api/actions/onboarding.start → toast + redirect to /workflows. This is the primary workflow trigger path in Phase 1 — no separate workflow discovery screen exists until Phase 2.
  - "Trigger workflow" → workflow selection sheet → workflow.trigger action (Phase 2+)
```

---

### Flow 3: AI Chat — Control Plane

```
Screen: Chat (route: /chat or sidebar panel accessible from all screens)
Purpose: Natural language interface for querying the business graph and executing actions
Key elements:
  - Message input (fixed at bottom)
  - Message thread: user messages + AI responses
  - AI response with suggested action: action card with "Approve" button
  - Block context chip: current context block (changes when viewing a block)
  - Streaming text rendering (SSE from /api/ai/chat)
Actions:
  - Type query → stream AI response
  - Click "Approve" on suggested action → POST /api/actions/[type]
  - Click referenced block name in response → navigate to Block Detail
State requirements:
  - Chat history persists within session (not persisted to DB in Phase 1)
  - Context block ID sent with each message
  - Loading state while AI is streaming
  - Error state if streaming fails (show retry option)
```

---

### Flow 4: Create Block

```
Screen: Slide-over sheet triggered from Dashboard "New Block" button
Purpose: Create a new business entity
Key elements:
  - Block type selector: system types + org custom types (fetched from GET /api/block-types in Phase 2)
  - Name field (required)
  - Jurisdiction selector (GB | US | SG | AU | Other)
  - Dynamic data fields: Phase 1 = hardcoded per type; Phase 2 = rendered from block_type_definitions.field_schema (JSON Schema → form fields via react-jsonschema-form or equivalent)
  - "Create Block" submit button
Actions:
  - Submit → POST /api/actions/block.create → close sheet → navigate to new block
  - Cancel → close sheet
Validation (Zod):
  - name: string, min 2 chars, max 200 chars
  - type: enum of valid block types
  - jurisdiction: optional, ISO code
```

---

### Flow 5: Event Timeline (Standalone / Audit Export)

```
Screen: Events (route: /events or /blocks/[id]/events)
Purpose: Compliance-grade audit trail view
Key elements:
  - Date range filter
  - Event type filter
  - Actor type filter
  - Paginated chronological list: timestamp, event type, actor, payload summary
  - Export button (CSV — Phase 2; JSON log view in Phase 1)
Actions:
  - Filter events → re-query with params
  - Click event → expand payload details
  - Export → download JSON of filtered events
```

---

### Flow 6: Block Type Configuration (Phase 2)

```
Screen: Block Type Manager (route: /settings/block-types)
Purpose: Create and manage custom block types with field schemas
Key elements:
  - List of all block types (system + custom) with icon, name, field count
  - System types shown as read-only with lock icon
  - "New Block Type" button → opens configuration sheet
  - Configuration sheet:
    - Type key (machine name, validated: lowercase, underscores only)
    - Display name
    - Icon selector (from icon library)
    - Colour picker
    - Field schema builder: add fields (text, number, date, enum, boolean), set required, set defaults
  - Preview: shows what a Create Block form would look like with this schema
Actions:
  - Create type → POST /api/block-types → records block_type.created event
  - Edit type → PUT /api/block-types/:id → records block_type.updated event
  - Cannot delete system types; can archive custom types
```

---

### Flow 7: Task Queue (Phase 2)

```
Screen: My Tasks (route: /tasks)
Purpose: View and manage task_queue_items assigned to the current user
Key elements:
  - Task list: name, workflow instance, entity block, priority, due date, status
  - Filters: status (pending/claimed/completed), priority, workflow type
  - Sort: by due date (default), priority, created date
  - Task detail panel (slide-over):
    - Task context: which workflow step, which entity block, step instructions
    - Action buttons: "Claim" (if pending), "Complete" (if claimed), "Reassign"
    - Outcome form: approval/rejection with notes field
    - Related block link → navigate to Block Detail
  - Badge count in sidebar nav showing pending task count
Actions:
  - Claim task → POST /api/tasks/:id/claim → toast confirmation
  - Complete task → POST /api/tasks/:id/complete → advances workflow instance
  - Reassign → POST /api/tasks/:id/reassign → select user/role
```

---

### Flow 8: Visual Workflow Builder (Phase 3)

```
Screen: Workflow Builder (route: /workflows/[id]/edit)
Purpose: Visual canvas for composing workflow templates using drag-and-drop
Key elements:
  - React Flow canvas with node types: trigger, action step, condition, branching
  - Left sidebar: composable menu with categories:
    - Triggers (6 types): manual, event, schedule, webhook, api_signal, workflow_completion
    - Actions (10 types): create_block, update_block, create_edge, route_human, route_agent, generate_doc, send_notify, call_api, start_workflow, wait
    - Conditions (5 types): field_condition, status_condition, time_condition, role_condition, graph_condition
    - Branching (5 types): if_else, switch, parallel, loop, approval_gate
  - Node configuration panel (right sidebar): opens when a node is selected; form for step config
  - Template variable autocomplete: {{block.*}}, {{context.*}}, {{now}}, {{org.*}}, {{trigger.*}}
  - Top bar: template name, "Save Draft" button, "Publish" button, "Test Run" button
  - Mini-map for large workflows
Actions:
  - Drag node from sidebar → drop on canvas → creates step/trigger/condition
  - Connect nodes → draw edge between them
  - Click node → open config panel
  - Save → PUT /api/workflow-templates/:id
  - Publish → POST /api/actions/workflow.template.publish
  - Test Run → spawns a workflow instance in test mode
```

---

### Flow 9: Document Generation (Phase 3)

```
Screen: Document Templates (route: /settings/documents)
Purpose: Create and manage document templates that workflow steps can generate
Key elements:
  - Template list: name, type (PDF/email/letter), associated block types
  - Template editor: rich text with template variable insertion ({{block.name}}, etc.)
  - Preview: render with sample block data
Actions:
  - Create template → stores in document_templates table
  - Edit template → updates template content
  - Generate from workflow → generate_doc step type creates document as attachment
```

---

## Component Inventory

| Component | Purpose | Used On | shadcn/ui Base |
|-----------|---------|---------|---------------|
| `BlockCard` | Summary card for a block | Dashboard | Card |
| `BlockTable` | Paginated table of blocks | Dashboard, search results | Table |
| `EventRow` | Single event in the timeline | Timeline tab, Events page | — |
| `EventTimeline` | Scrollable event list with filters | Block Detail (Timeline tab) | ScrollArea |
| `WorkflowStepCard` | Current step with approve/reject | Block Detail (Workflow tab) | Card + Button |
| `BlockTypeBadge` | Coloured badge for block type | Block table, block header | Badge |
| `StatusBadge` | Coloured badge for status | Block table, block header | Badge |
| `JurisdictionBadge` | Short jurisdiction code badge | Block table | Badge |
| `ChatMessage` | User or AI message bubble | Chat | — |
| `ActionSuggestionCard` | AI-suggested action with approve button | Chat | Card + Button |
| `CreateBlockSheet` | Slide-over for creating a block | Dashboard | Sheet + Form |
| `AddEdgeSheet` | Slide-over for creating a block connection | Block Detail | Sheet + Form |
| `WorkflowSelector` | Choose workflow template to trigger | Block Detail | Dialog + Select |
| **Phase 2 Components** | | | |
| `BlockTypeManager` | List and manage custom block types | Settings | Table + Sheet |
| `FieldSchemaBuilder` | Visual field schema editor for block types | Block Type config | Custom (form builder) |
| `DynamicBlockForm` | Renders form fields from block_type_definitions.field_schema | Create Block, Block Detail | react-jsonschema-form or custom |
| `TaskQueueList` | Paginated list of task_queue_items with filters | My Tasks page | Table + Filters |
| `TaskDetailPanel` | Task context, claim/complete/reassign controls | My Tasks (slide-over) | Sheet + Form |
| `TaskBadge` | Pending task count badge in sidebar | Sidebar nav | Badge |
| `WorkflowInstanceCard` | Instance status, current step, progress | Block Detail (Workflow tab) | Card |
| `WorkflowInstanceTimeline` | Step-by-step execution history for an instance | Block Detail (Workflow tab) | Timeline |
| `IntegrationConnectorCard` | Connector status, last sync, test button | Settings | Card + Button |
| **Phase 3 Components** | | | |
| `WorkflowCanvas` | React Flow canvas for workflow composition | Workflow Builder | React Flow |
| `WorkflowNodePalette` | Sidebar with draggable node types | Workflow Builder | Custom |
| `WorkflowNodeConfig` | Right-panel config form for selected node | Workflow Builder | Form |
| `TemplateVariableAutocomplete` | Autocomplete for {{block.*}} etc. in config fields | Workflow Builder, Document Templates | Custom |
| `DocumentTemplateEditor` | Rich text editor with variable insertion | Document Templates | Custom |

---

## Page/Screen List

| Screen | Route | Auth Required | Notes |
|--------|-------|--------------|-------|
| Sign In | `/sign-in` | NO | Clerk-hosted or embedded |
| Dashboard | `/` | YES | Primary landing screen |
| Block Detail | `/blocks/[id]` | YES | 4-tab view |
| Events | `/events` | YES | Org-wide event log |
| Chat | `/chat` | YES | Full-page chat (also available as sidebar) |
| Settings | `/settings` | YES | Org settings, user management (Phase 2) |
| Block Type Manager | `/settings/block-types` | YES | Custom block type CRUD (Phase 2) |
| My Tasks | `/tasks` | YES | Task queue for current user (Phase 2) |
| Workflow Builder | `/workflows/[id]/edit` | YES | Visual workflow canvas (Phase 3) |
| Workflow Templates | `/workflows` | YES | List workflow templates (Phase 2) |
| Integrations | `/settings/integrations` | YES | Integration connector management (Phase 2) |
| Document Templates | `/settings/documents` | YES | Document template management (Phase 3) |

---

## State Management Requirements

| State | Scope | Library | Notes |
|-------|-------|---------|-------|
| Auth / user session | Global | Clerk hooks | Provided by Clerk SDK |
| Block list | Server / cache | TanStack Query | Invalidated on block mutations |
| Block detail | Server / cache | TanStack Query | Invalidated on action execution |
| Event timeline | Server / cache | TanStack Query | Append-only; invalidated on new events |
| Chat messages | Local (session) | React useState | Not persisted to DB in Phase 1 |
| Form state | Local | react-hook-form | Never global |
| UI state (sheet open/closed, tab) | Local | React useState | — |

**Rules:**
- Auth state: Clerk SDK (global, automatic)
- Server data: TanStack Query (cache + invalidation)
- Form state: always local — never in global state
- No Redux, Zustand, or custom global state stores in Phase 1

---

## Real-Time Requirements

| Feature | What Updates | Method | Priority |
|---------|-------------|--------|---------|
| Event timeline | New events appear without page refresh | Supabase Realtime subscription on events table | HIGH |
| Workflow step status | Step status changes reflected live | Supabase Realtime on workflow_jobs table | MEDIUM |
| Dashboard stats | Active block count and pending steps | Polling every 30s (Realtime in Phase 2) | LOW |

---

## Offline Requirements

Phase 1: None. Ops OS requires internet connection. No offline mode.

---

## Internationalisation (i18n)

Phase 1: English only. No i18n framework needed. Multi-language support is Phase 3+.

Jurisdiction-specific content (workflow step names, compliance labels) is data-driven from the workflow templates — not hardcoded UI strings.

---

## Frontend Performance Targets

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s on 4G |
| Initial JS bundle (gzipped) | < 150KB |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Time to Interactive | < 3.5s on 4G |
| Block detail page load (including events) | < 1s on fast connection |

---

## Accessibility Requirements (WCAG AA)

- Semantic HTML: `<main>`, `<nav>`, `<table>` with proper headers, `<form>` with labels
- All icon-only buttons: `aria-label` required
- Focus rings visible on all interactive elements
- Colour contrast ratio ≥ 4.5:1 for text (Tailwind defaults satisfy this)
- Screen reader testing: VoiceOver (Mac) before Phase 1 launch

---

## Loading, Empty, and Error States

Every data-fetching component must implement all three states:

| Component | Loading State | Empty State | Error State |
|-----------|-------------|------------|------------|
| BlockTable | Skeleton rows | "No blocks yet. Create your first block." | "Failed to load blocks. Retry." |
| EventTimeline | Skeleton rows | "No events recorded yet." | "Failed to load events. Retry." |
| ChatMessage | Typing indicator animation | — | "Failed to send message. Retry." |
| WorkflowStepCard | Skeleton | "No active workflow." | "Failed to load workflow. Retry." |

---

## Animation and Interaction

| Interaction | Behaviour | Priority |
|------------|-----------|---------|
| Sheet open/close | shadcn Sheet default (slide from right) | HIGH |
| Toast notifications | Top-right, auto-dismiss after 4s | HIGH |
| Form submission | Loading spinner on submit button, disabled state | HIGH |
| Tab switch | Instant (no animation needed in Phase 1) | LOW |
| Streaming chat | Text appears character by character (SSE) | HIGH |
| Page transitions | None in Phase 1 | LOW |

---

## Phase 3 Flows & Components

### Flow: Settings Page Restructure
**Route:** `/settings` with sidebar layout
**Sections:**
1. **Org Profile** — name, logo, default settings
2. **Team** (`/settings/team`) — list members, invite, assign roles, set reporting-to hierarchy
3. **Roles** (`/settings/roles`) — create/edit custom roles, checkbox permission matrix. System roles read-only.
4. **Block Types** (`/settings/block-types`) — existing page, integrated into new sidebar
5. **Brand Kit** (`/settings/brand`) — existing page, integrated into new sidebar
6. **Integrations** (`/settings/integrations`) — existing page, integrated into new sidebar
7. **Routing Policies** (`/settings/routing`) — confidence slider, risk level matrix (grid: risk × confidence → route). Preview routing decision at each combination.
8. **Notifications** (`/settings/notifications`) — per-user preferences: event types, delivery method (in-app/email), frequency (immediate/daily digest)
9. **API Keys** (`/settings/api-keys`) — generate/revoke keys, show prefix only, usage stats
10. **Audit Log** (`/settings/audit-log`) — paginated event viewer, filters (actor, event type, date range, block). Read-only.

### Flow: Enhanced Task Cards
**Where:** Task list in My Work hub and block detail task tab
**Components:**
- `TaskCard` — container showing full context
- `TaskCardHeader` — task title + routing badge (Human/Agent/Auto icons) + confidence badge (green/yellow/red)
- `TaskCardBody` — context summary (block info, step info, input data) + AI recommendation (expandable)
- `TaskCardActions` — Approve (green primary), Reject (red secondary), Edit (opens inline form to modify AI recommendation before approval)

**Behavior:**
- On Approve: execute the AI-recommended action, log `task.approved` event
- On Reject: log `task.rejected` event, move to next routing fallback
- On Edit: modify recommendation text/params → then Approve modified version, log `task.modified` event

### Flow: Canvas Input/Output Nodes (Archived — superseded by Sprint 22 palette)
**Note:** Input/Output nodes merged into trigger configs (input) and action configs (output) during the Sprint 22 Workflow Builder UX Redesign. See "Workflow Builder UX Redesign" section below.

**Palette restructure (Phase 6, Sprint 22):**
See the "Workflow Builder Node Palette (27 nodes, 8 categories)" section below for the current palette structure.

### Flow: Document Preview
**Component:** `DocumentPreview` — artifact-like right-side drawer or modal
- Shows generated document with brand kit CSS variables applied
- Inline editing via contenteditable sections with formatting toolbar
- Download as PDF button
- Send via email action button
- Version history dropdown (previous versions from events)
- Accessible from block detail page document tab

### Flow: AI Insights Panel
**Component:** `AIInsightsPanel` — right-side collapsible panel on block detail pages
**Sections (from delta engine):**
1. Progress bar (completed/total steps across active workflow instances)
2. "What's Done" — completed milestones (max 3 bullets)
3. "What's Next" — upcoming steps with timing (max 3 bullets)
4. "What's at Risk" — overdue items, stalled workflows (max 3 bullets, red indicators)
5. "Recommendations" — actionable suggestions (max 3 bullets)

**Behavior:** Lazy-loaded on panel open. Polls every 5 minutes while visible. Shows skeleton while loading.

### Component: Theme Toggle
**Location:** App header, top-right corner
**Component:** `ThemeToggle` — Sun/Moon icon button
- Click toggles `.dark` class on `<html>`
- Persists to `localStorage` key `theme`
- Default: system preference via `prefers-color-scheme`
- Transitions: 200ms ease for background/text color changes

### Phase 3 UI State Requirements
| Component | Loading | Empty | Error |
|-----------|---------|-------|-------|
| Settings sidebar | Skeleton nav items | N/A | "Failed to load settings." |
| Team list | Skeleton rows | "No team members yet. Invite your first member." | "Failed to load team." |
| Role matrix | Skeleton grid | System roles always shown | "Failed to load roles." |
| Task card list | Skeleton cards | "No tasks assigned." | "Failed to load tasks." |
| AI Insights panel | Skeleton sections | "No active workflows for insights." | "Insights unavailable. Retry." |
| Document preview | Loading spinner | "No document generated yet." | "Failed to load document." |
| Notification list | Skeleton items | "No notifications." | "Failed to load notifications." |
| Audit log | Skeleton rows | "No events recorded." | "Failed to load audit log." |

---

---

## Workflow Builder UX Redesign (Phase 6, Sprints 22–23)

> Added 2026-03-18. Comprehensive UX overhaul of the visual workflow builder config panel.

### Design Principles

1. **Dropdown before free text** — every field that CAN be a select/dropdown SHOULD be
2. **Select from existing entities** — blocks, connectors, block types, field definitions, workflow templates
3. **Minimal technical terminology** — no snake_case, no raw template variables, no seconds-based durations
4. **Context-aware auto-fill** — every node knows the source record type and auto-suggests the most likely field (e.g., Send Email → auto-fills `{{block.email}}`)
5. **Variable picker as PRIMARY input** — `{{variable}}` insertion via inline picker button, not manual typing

### Architecture (Sprint 22 — COMPLETE)

**Before:** Single 1,697-line monolith `node-config-panel.tsx` containing all node config UIs.

**After:** Decomposed into 3 layers:

| Layer | Path | Files | Purpose |
|-------|------|-------|---------|
| Dispatcher | `panels/node-config-panel.tsx` | 1 (~90 lines) | Thin router: label field + type-specific config component |
| Per-node configs | `panels/configs/` | 8 + barrel index.ts | TriggerConfig, ActionConfig, ConditionConfig, WaitConfig, InputConfig, OutputConfig, TaskConfig, StepInstructionsPanel |
| Shared components | `panels/shared/` | 7 | form-primitives, routing-section, duration-picker, condition-builder, variable-picker, schedule-config, ai-template-picker |
| Types + helpers | `panels/types.ts` | 1 | NodeConfigProps, getNodeData(), makeConfigUpdater() |
| AI templates | `lib/workflow/ai-prompt-templates.ts` | 1 | 14 built-in templates across 4 AI node types |

### Shared Component Inventory

| Component | File | Props | Purpose |
|-----------|------|-------|---------|
| `FieldLabel` | form-primitives.tsx | htmlFor, children | Consistent label styling |
| `TextInput` | form-primitives.tsx | value, onChange, id?, placeholder? | Single-line text input |
| `TextArea` | form-primitives.tsx | value, onChange, id?, placeholder?, rows? | Multi-line text input |
| `SelectInput` | form-primitives.tsx | value, onChange, options[], id? | Dropdown select |
| `NumberInput` | form-primitives.tsx | value, onChange, min?, max?, id? | Numeric input |
| `EntitySelect` | form-primitives.tsx | value, onChange, entities[], id?, placeholder? | Entity picker dropdown |
| `CheckboxInput` | form-primitives.tsx | checked, onChange, id?, label | Checkbox with label |
| `RoutingSection` | routing-section.tsx | config, updateConfig, entities? | Routing mode + permission config |
| `DurationPicker` | duration-picker.tsx | value (seconds), onChange | Amount + unit → seconds, human-readable summary |
| `ConditionBuilder` | condition-builder.tsx | value (ConditionValue), onChange, fields? | 3-mode progressive: simple → compound → advanced |
| `VariablePickerButton` | variable-picker.tsx | variables[], onSelect | `{ }` button with searchable dropdown |
| `VariablePickerInput` | variable-picker.tsx | value, onChange, variables[], autoSuggestion? | TextInput with inline variable picker |
| `ScheduleConfig` | schedule-config.tsx | value (ScheduleValue), onChange | 6 presets, conditional fields, timezone, no cron |
| `AITemplatePicker` | ai-template-picker.tsx | nodeType, onSelect, prompt, categories?, etc. | Template dropdown + prompt + tag inputs + output config |

### Workflow Builder Node Palette (27 nodes, 8 categories)

**Triggers (4):**
- **Manual Trigger** — No config. Start button only.
- **Event Trigger** — Searchable dropdown grouped by category (Record/Workflow/Integration/System events). Event scope: all records / matching filters / specific record.
- **Webhook Trigger** — Connector dropdown, auto-generated webhook URL with copy, expected payload field definitions.
- **Schedule Trigger** — Presets (hourly/daily/weekly/monthly/quarterly/custom) + timezone. No cron syntax.

**Actions (6):**
- **Log Event** — Activity-focused dropdown (Note Added, Call Logged, Meeting Held, etc.) + custom option.
- **Send Email** — Context-aware: auto-suggests source record email. To/CC/BCC with variable picker. Subject/body with variable picker. Email template dropdown. Send-as connector.
- **Generate Document** — Data source picker (fields or blocks). Prompt with variable picker. Template dropdown. Output format (HTML/PDF).
- **Book Meeting** — Title with variable picker. Duration dropdown. Attendees auto-suggested. Location toggle. Buffer time. Calendar connector.
- **Update Record** — "Which record?" selector. Field picker + value inputs with variable picker. Each row: field dropdown + value.
- **Create Task** — Title, assignee (routing engine/user/role), priority, dynamic form fields, decision buttons, attachments (records/URLs/files/context), routing mode.

**Data Operations (4):**
- **Create Record** — Record type dropdown. Auto-populate matching fields. Auto-link toggle (default ON).
- **Change Status** — Record selector. Status dropdown from lifecycle stages. Optional note.
- **Link Records** — From/To record selectors. Relationship dropdown.
- **Search / Filter** — Record type. Filter conditions (field + operator + value). Max results. Save results as variable.

**Human Interaction (3):**
- **Approval Request** — Pre-configured Create Task (auto-fills Approve/Reject buttons). Fully customisable.
- **Send Notification** — Channel (in-app/email/both). Title/body with variable picker. Type (info/success/warning/error). Collapsible email settings.
- **Share Link** — Block picker. Link type (view/fill/sign). Expiry duration. Permissions. Auth/password toggles. Branding toggle.

**AI & Analysis (4):**
All use template-first approach with 14 built-in templates. Results auto-saved + available to downstream nodes.
- **AI Analysis** — Template dropdown (Pipeline Risk, Client Health, Deal Qualification, Custom). Prompt. Output format (JSON/text).
- **Classify / Route** — Template dropdown (Priority Triage, Client Tier, Compliance Risk, Custom). Categories (tag input, min 2). Auto-suggests Route node branches.
- **Summarise** — Template dropdown (Executive Summary, Meeting Notes, Deal Progress, Quick Update, Custom). Smart context inclusion per template.
- **Risk Assessment** — Template dropdown (AML/KYC, Deal Risk, Regulatory, Operational, Custom). Risk categories. Org policies toggle.

**External (1):**
- **External Action** — Connector dropdown → provider-specific action templates (Xero: Create Invoice; HubSpot: Create Deal; etc.). Manual config fallback. Test + Preview button.

**Conditions (2):**
- **If / Else** — Condition builder: simple mode (field/operator/value), compound mode (AND/OR groups), advanced mode (raw expression). True/False output handles.
- **Route** — "Route based on" dropdown (any context value). Dynamic branch list with labels. Auto-suggests from Classify node. N output handles.

**Flow (3):**
- **Wait / Delay** — Duration picker: amount (1-99) + unit (min/hr/day/week). Human-readable summary.
- **Run Sub-Workflow** — Workflow template dropdown. Mini read-only step preview. Wait-for-completion toggle. Input mapping.
- **For Each** — Source dropdown (search results/list field/API response). Max parallel (1/5/10/25). Max iterations (default 100).

**Workflow-Level Config (settings, not a node):**
- Completion behavior: Do nothing / Restart after delay / Trigger another workflow.

### AI Prompt Templates (14 built-in)

| ID | Node Type | Name | Pre-fills |
|----|-----------|------|-----------|
| analysis-pipeline-risk | ai_analysis | Pipeline Risk Analysis | prompt + outputFormat: json |
| analysis-client-health | ai_analysis | Client Health Check | prompt + outputFormat: json |
| analysis-deal-qualification | ai_analysis | Deal Qualification Score | prompt + outputFormat: json |
| classify-priority-triage | ai_classify | Priority Triage | prompt + categories: Critical/High/Medium/Low |
| classify-client-tier | ai_classify | Client Tier Classification | prompt + categories: Enterprise/Premium/Standard/Starter |
| classify-compliance-risk | ai_classify | Compliance Risk Level | prompt + categories: High Risk/Medium Risk/Low Risk/Compliant |
| summarise-executive | ai_summarise | Executive Summary | prompt (includes all context) |
| summarise-meeting-notes | ai_summarise | Meeting Notes Summary | prompt (extracts decisions + action items) |
| summarise-deal-progress | ai_summarise | Deal Progress Summary | prompt (stage changes + milestones) |
| summarise-quick-update | ai_summarise | Quick Update | prompt (last 5 events only) |
| risk-aml-kyc | ai_risk | AML/KYC Risk | prompt + riskCategories + includeOrgPolicies: true |
| risk-deal-score | ai_risk | Deal Risk Score | prompt + riskCategories |
| risk-regulatory-compliance | ai_risk | Regulatory Compliance Check | prompt + riskCategories + includeOrgPolicies: true |
| risk-operational | ai_risk | Operational Risk Review | prompt + riskCategories |

---

## Archived

> Superseded screen specs and flows moved here. Never deleted.
