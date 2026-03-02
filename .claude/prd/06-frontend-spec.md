# PRD Layer 06: Frontend Specification

> Last updated: 2026-03-02 | Author: Frontend Engineer | Status: DRAFT
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
  - Overview tab: block data fields (from JSONB), related blocks (graph edges)
  - Timeline tab: chronological event log — event type, actor, payload summary, timestamp
  - Graph tab: visual list of connected blocks (text-based in Phase 1; canvas in Phase 2+)
  - Workflow tab: current workflow step, step history, approve/reject controls
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
  - Block type selector: client | deal | project | contract | contact
  - Name field (required)
  - Jurisdiction selector (GB | US | SG | AU | Other)
  - Dynamic data fields: rendered based on selected type
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
