# Design Standards — Ops OS

> **Reading guard:** Read this file at session start if you are the Design Lead,
> or when you need detailed design guidance for a component or page.
> For quick reference, use `.claude/rules/design.md` instead.

---

## 1. Design Philosophy

Ops OS is a Business Operating System for operations teams. The design must be:
- **Professional** — capital markets / financial services audience. Clean, structured, trustworthy.
- **Efficient** — power users who work in the app all day. Minimise clicks, maximise information density.
- **Clear** — operations involve complex workflows. The UI must make complexity manageable, not hide it.
- **Consistent** — every page should feel like part of the same application.

**Anti-patterns to avoid:**
- Consumer SaaS playfulness (bouncy animations, excessive colour, emoji-heavy)
- Enterprise bloat (too many nested menus, modal-in-modal, wizard fatigue)
- Dashboard-for-dashboard's-sake (metrics without actionability)

---

## 2. Page Architecture

### Standard Page Layout
```
┌─────────────────────────────────────────────────┐
│ AppNav (sticky top bar)                          │
├─────────────────────────────────────────────────┤
│ Page Header                                      │
│  Title          [Actions: Button, Dropdown, etc] │
├─────────────────────────────────────────────────┤
│                                                  │
│  Content Area                                    │
│  (cards, tables, canvas, forms)                  │
│                                                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Page Types
1. **List page** — browse a collection (blocks, templates, documents)
   - Header: title + create button + filters
   - Content: card grid or table with sort/filter
   - Empty state with CTA

2. **Detail page** — view/edit a single entity (block detail, workflow instance)
   - Header: entity name + status badge + action menu
   - Content: tabbed sections or two-column layout
   - Sidebar: related items, connections, metadata

3. **Builder page** — construct something (workflow canvas, document template editor)
   - Header: entity name + save/discard buttons
   - Content: full-width canvas or editor
   - Sidebar: palette, config panel, or properties

4. **Hub page** — personal dashboard (My Work, Dashboard)
   - Header: greeting or summary
   - Content: sectioned cards for different concerns (tasks, workflows, activity)

---

## 3. Navigation Structure

### Primary Navigation (AppNav)
```
Dashboard | My Work | Workflows | Library ▾ | Chat
```

- **Dashboard** — org-level overview: metrics, recent activity, quick actions
- **My Work** — personal hub: my tasks, my workflows, my blocks, recent activity
- **Workflows** — workflow templates list + workflow canvas builder
- **Library** — dropdown with sub-items:
  - Blocks — browse and manage all blocks
  - Integrations — capability-focused integration catalog
  - Documents — document templates and generated documents
- **Chat** — AI assistant

### Navigation Principles
- Current page highlighted in nav (active state)
- Breadcrumbs on detail/builder pages for back navigation
- Deep links work (every page has a stable URL)
- Keyboard navigation: Tab through nav items, Enter to activate

---

## 4. Component Patterns

### Cards
Used for browseable collections (blocks, templates, integrations).
```
┌─────────────────────────┐
│ Icon  Title        Badge │
│ Description text (1-2ln) │
│ Meta: date, type, etc.   │
└─────────────────────────┘
```
- Clickable entire card (not just title)
- Hover: subtle background change
- Consistent card height in grid (use `min-h` or truncation)

### Tables
Used for structured data (events, jobs, tasks).
- Sticky header row
- Sortable columns (click header)
- Row hover highlight
- Action column (rightmost) with icon buttons or dropdown

### Action Menu (Block Detail)
Dropdown button on entity detail pages.
```
[Actions ▾]
  ├── Send Email
  ├── Generate Document
  ├── Book Meeting
  ├── Run Workflow
  └── Custom Action...
```
- Actions filtered by: entity type + connected integrations
- Each action opens a modal with a pre-filled form
- Disabled actions show tooltip explaining why (e.g., "Connect Google to enable")

### Modals
- Width: `max-w-md` for simple forms, `max-w-lg` for complex forms, `max-w-2xl` for previews
- Always: title, close button (X), primary action button, cancel button
- Escape key and backdrop click to close
- Never nest modals — use page navigation for complex flows

### Empty States
```
┌─────────────────────────────────┐
│        [Illustration/Icon]       │
│                                  │
│     No [items] yet               │
│     [Helpful description]        │
│                                  │
│     [Create First Item]          │
└─────────────────────────────────┘
```
- Centre-aligned
- Friendly but professional tone
- Primary CTA to create the first item

---

## 5. Workflow Canvas Standards

### Canvas Layout
```
┌─────────────────────────────────────────────────┐
│ Header: Template Name    [Save] [Discard] [Run] │
├──────┬──────────────────────────────────────────┤
│      │                                           │
│ Node │        Canvas Area (React Flow)           │
│ Pale-│                                           │
│ tte  │     [Trigger] → [Action] → [Condition]   │
│      │                     ↓            ↓        │
│      │              [Wait]    [Action]           │
│      │                                           │
│      │                      [Minimap]  [Zoom]    │
├──────┴──────────────────────────────────────────┤
│ Config Panel (shows when node selected)          │
│ [Node Type] [Fields...] [Delete Node]            │
└─────────────────────────────────────────────────┘
```

### Node Design
- All nodes: rounded rectangle, subtle border, icon + label
- **Trigger nodes** (blue-50 bg, blue-600 border): Manual Start, Event Trigger, Email Received
- **Action nodes** (green-50 bg, green-600 border): Emit Event, Send Email, Generate Document, Book Meeting, Run Action, Call API
- **Condition nodes** (amber-50 bg, amber-600 border): diamond shape or split-path visual
- **Wait nodes** (gray-50 bg, gray-400 border): timer icon, duration label
- **End node** (red-50 bg, red-400 border): termination point

### Node Palette
- Left sidebar, collapsible
- Grouped by category: Triggers, Actions, Flow Control
- Drag to add to canvas
- Search/filter for large palettes

### Config Panel
- Bottom panel or right sidebar, shows when a node is selected
- Form fields vary by node type
- Validation inline (red border + message on invalid fields)
- Changes auto-save or explicit save button (be consistent)

---

## 6. My Work Hub Design

### Layout
```
┌─────────────────────────────────────────────────┐
│ My Work                              [Filters]   │
├─────────────────────────────┬───────────────────┤
│ My Tasks (3 open)           │ Recent Activity    │
│ ┌─────────────────────────┐ │ • Created block X  │
│ │ Task: Review KYC docs   │ │ • Completed task Y │
│ │ Workflow: Onboarding    │ │ • Workflow Z done  │
│ │ [Claim] [View]          │ │ • ...              │
│ └─────────────────────────┘ │                    │
│ ┌─────────────────────────┐ │                    │
│ │ Task: Approve contract  │ │                    │
│ └─────────────────────────┘ │                    │
├─────────────────────────────┤                    │
│ My Workflows (2 active)     │                    │
│ [Instance cards...]          │                    │
├─────────────────────────────┤                    │
│ My Blocks (recently edited) │                    │
│ [Block cards...]             │                    │
└─────────────────────────────┴───────────────────┘
```

### Sections
1. **My Tasks** — open and claimed task_queue_items assigned to current user
2. **My Workflows** — workflow instances the user created or is involved in
3. **My Blocks** — blocks created by or recently edited by the user
4. **Recent Activity** — event feed filtered to user's actions

### Key Interactions
- Task cards: claim, complete, view detail (inline or navigate)
- Workflow cards: view instance status, navigate to template
- Block cards: navigate to block detail
- Activity feed: click to navigate to related block

---

## 7. Library Pages

### Block Library (`/library/blocks`)
- Header: "Blocks" + type filter dropdown + search + create button + grid/list toggle
- Card grid by default, table view optional
- Cards show: icon (from block_type_definitions), name, type badge, last modified date
- Type filter: all | client | deal | project | contact | contract | custom types
- Click card → navigate to block detail

### Integration Library (`/library/integrations`)
- Organised by capability, not by provider:
  - **Email** — Send, Receive, Attachments (provider: Google/Microsoft)
  - **Calendar** — Book Meeting, View Schedule (provider: Google/Microsoft)
  - **Documents** — Create, Store, Generate (provider: Google Drive/OneDrive)
  - **Webhooks** — Inbound triggers, Outbound notifications
- Each capability card shows: icon, name, connected status, available actions
- "Connect" button for unconnected capabilities → opens OAuth flow

### Document Library (`/library/documents`)
- Two tabs: Templates | Generated Documents
- Templates: card grid with template name, output format, last modified, variable count
- Generated: table with doc name, source block, template used, generated date, download link
- Create template button → opens template editor
- Generate button → opens generation modal

---

## 8. Colour and Typography

### Colour Usage
- **Gray scale** (gray-50 through gray-900): all structural elements, text, borders
- **Blue** (blue-500/600): primary actions, links, trigger nodes
- **Green** (green-500/600): success states, action nodes, connected status
- **Amber/Yellow** (amber-500): warnings, condition nodes, pending states
- **Red** (red-500): errors, destructive actions, failed states
- Avoid: purple, pink, teal — keep the palette narrow and professional

### Typography
- Font: system font stack (Tailwind default)
- Page title: `text-2xl font-semibold text-gray-900`
- Section heading: `text-lg font-semibold text-gray-900`
- Body text: `text-sm text-gray-700`
- Muted text: `text-sm text-gray-500`
- Monospace (for IDs, code): `font-mono text-xs`

---

## 9. User-Provided UI Libraries

> **Placeholder:** The user will provide specific UI libraries and examples.
> When provided, add them here with usage guidelines and integration patterns.
> Until then, use shadcn/ui + Tailwind as the baseline.

---

## 10. Research References

When doing UX research, study these tools for specific patterns:
- **n8n / Make** — workflow canvas patterns (node palette, connections, config panels)
- **Monday.com / ClickUp** — work hub patterns (My Work, task management, views)
- **Notion** — information architecture, clean professional aesthetics
- **Retool** — builder UI patterns (drag-drop, property panels)
- **Zapier** — integration library patterns (capability-focused, not provider-focused)
- **Linear** — minimal, fast, professional UI for work management
