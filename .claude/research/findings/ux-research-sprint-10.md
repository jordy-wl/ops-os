# UX Research — Sprint 10

> P2-S10-UI-01: Competitive analysis + current UI audit
> Date: 2026-03-10

---

## 1. Workflow Builder UX Patterns

### n8n
- **Canvas:** Free-form infinite canvas, nodes snap to grid. Zoom via scroll, minimap bottom-right.
- **Node palette:** Left sidebar with searchable categories (Triggers, Actions, Logic). Drag-to-add.
- **Node config:** Click node opens right panel. Form fields auto-populate from connected API.
- **Execution feedback:** Green checkmark overlay per node on success, red X on failure. Execution data visible per-node.
- **Takeaway:** Execution status overlaid on nodes is powerful feedback. Our canvas has no execution status indicators.

### Make (Integromat)
- **Canvas:** Linear left-to-right flow. Circular node icons. Connection lines are thick and animated during execution.
- **Node palette:** "Add another module" button at chain end, or right-click to insert.
- **Config:** Bottom sheet panel. Rich form with API-connected dropdowns.
- **Takeaway:** Linear layout simpler to understand for non-technical users. Animated connections during execution provide "alive" feel.

### Zapier
- **Canvas:** Strictly vertical 1-column. Step-by-step wizard, no free-form canvas.
- **Config:** Inline — each step expands to show its config. Test each step individually.
- **Takeaway:** Step-by-step testing per node is excellent for debugging. Our canvas has no per-step test capability.

---

## 2. BOS / Work Management Patterns

### Monday.com
- **Dashboard:** Customizable widgets: chart, number, timeline. User picks what to show.
- **My Work:** "My Work" view aggregates items assigned to you across all boards. Filter by status, due date.
- **Navigation:** Left sidebar with collapsible workspace sections. Top bar for search + notifications.
- **Takeaway:** Widget-based dashboard lets users customize their view. Our dashboard is static.

### Notion
- **Navigation:** Left sidebar with nested pages. Favorites section at top. Recent pages auto-tracked.
- **Dashboard:** User-built from database views, not a fixed layout.
- **Takeaway:** Recent/favorites pattern reduces navigation friction. We have no favorites or recent tracking.

### ClickUp
- **My Work:** "Home" view with: assigned tasks, recent activity, agenda, notepad. Four quadrants.
- **Navigation:** Left sidebar with Spaces > Folders > Lists hierarchy. Quick switcher (Cmd+K).
- **Takeaway:** Quick switcher (Cmd+K) is a power-user pattern we're missing. Four-quadrant home layout is effective.

---

## 3. Integration Library Patterns

### Zapier App Directory
- **Layout:** Grid of app tiles with icons. Category tabs at top (Marketing, Sales, Support).
- **Capability focus:** Each app card shows "X triggers and Y actions available."
- **Search:** Prominent search bar, auto-complete with app icons.
- **Takeaway:** Showing trigger/action counts per integration gives users a quick capability overview.

### Make Integrations
- **Layout:** Left category sidebar + right card grid. Filter by "Most Popular" / "Recently Added."
- **Detail view:** Each integration expands to show all available modules (actions/triggers).
- **Takeaway:** Category sidebar + sort options good for discovery. Our Integration Library has flat cards.

---

## 4. Document Generation Patterns

### PandaDoc
- **Template editor:** WYSIWYG editor with drag-and-drop content blocks. Variable insertion via "@" mention syntax.
- **Brand kit:** Global settings: logo, colors, fonts applied to all templates. Per-template override available.
- **Generation flow:** Select template > select recipient > auto-fill variables > preview > send.
- **Takeaway:** "@" mention for variable insertion is more intuitive than our `{{variable}}` syntax.

### Proposify
- **Template editor:** Section-based editor. Drag sections to reorder. Content library for reusable blocks.
- **Brand kit:** "Design Settings" panel: colors, fonts, logo. Applied automatically to all proposals.
- **Takeaway:** Section-based editing with reusable content blocks is a more advanced pattern. Our template editor is text-only.

---

## 5. Current UI Audit

### Audit Methodology
Reviewed each page against Nielsen's 10 usability heuristics. Scored informally (GOOD/OK/NEEDS_WORK).

### Dashboard (`/dashboard`)
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility of system status | OK | Shows block counts + events but no loading skeleton |
| Match between system and real world | GOOD | Terms are clear |
| User control and freedom | NEEDS_WORK | No quick actions — users have to navigate away to do anything |
| Consistency and standards | OK | Follows general card pattern |
| Error prevention | GOOD | Error state handled |
| Recognition rather than recall | NEEDS_WORK | No shortcuts or recently-visited links |
| Flexibility | NEEDS_WORK | Static layout, no customization |
| Aesthetic and minimalist design | NEEDS_WORK | Very sparse — lots of unused whitespace, no visual hierarchy |

### My Work (`/my-work`)
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility of system status | OK | Shows task/workflow/block lists |
| User control | OK | Claim/complete actions available |
| Consistency | NEEDS_WORK | No page header pattern matching other pages |
| Recognition | OK | Shows related workflow instance names |
| Aesthetic | OK | Four sections but could use visual differentiation |

### Canvas Builder (`/workflows/[id]/builder`)
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility of system status | NEEDS_WORK | No execution status on nodes, no save indicator |
| User control | GOOD | Undo/redo via React Flow, drag-and-drop |
| Error prevention | OK | Canvas validates on save |
| Aesthetic | OK | Clean but nodes are unstyled — all look the same |

### Block Detail (`/blocks/[id]`)
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility | GOOD | Shows data, events, connections |
| User control | GOOD | Action menu, onboarding button |
| Consistency | NEEDS_WORK | No breadcrumb (can't easily go back to block list) |
| Aesthetic | OK | Grid layout works but metadata panel could be richer |

### Block Library, Integration Library, Document Library
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility | OK | Search + filter working |
| Consistency | NEEDS_WORK | Three library pages have slightly different header patterns |
| Empty states | OK | Present but could be more helpful |
| Loading states | NEEDS_WORK | No loading skeletons on any library page |

### Brand Kit (`/settings/brand`)
| Heuristic | Score | Issue |
|-----------|-------|-------|
| Visibility | GOOD | Live preview |
| Error prevention | GOOD | Required fields validated |
| Aesthetic | GOOD | Clean layout with preview |

---

## 6. Key Findings Summary

**HIGH PRIORITY:**
1. No loading skeletons on any page — content pops in
2. Dashboard has no quick actions — dead-end page
3. No breadcrumbs anywhere — back navigation relies on browser button
4. Library pages have inconsistent headers
5. Canvas nodes have no visual differentiation by type

**MEDIUM PRIORITY:**
6. No Cmd+K quick switcher for power users
7. No toast/notification system for action feedback
8. Empty states could be more actionable (link to create resources)
9. Nav doesn't show active Library sub-page name

**LOW PRIORITY:**
10. No dark mode (users haven't requested)
11. No keyboard shortcuts documentation
12. Mobile nav could use a hamburger menu
