# PRD Layer 06: Frontend Specification

> Last updated: 2026-03-04 | Author: Frontend Engineer | Status: DRAFT
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
  - "Trigger workflow" → workflow selection sheet → workflow.trigger action
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

## Archived

> Superseded screen specs and flows moved here. Never deleted.
