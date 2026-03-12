---
paths:
  - "src/frontend/**"
  - "src/components/**"
  - "src/styles/**"
  - "src/app/**"
  - "src/pages/**"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Frontend Rules

> Path-scoped — loads when working in frontend files.
> Full standards: `.claude/standards/frontend-standards.md`

---

## Component Rules
- One component per file — if it needs its own state or logic, it's its own component
- Max 200 lines per component file — split if longer
- All props must have a TypeScript interface defined in the same file
- Export component as default; export types as named exports
- No direct DOM manipulation — use React refs only when necessary

## State Management
- Local state (`useState`) for UI-only state (open/closed, hover, loading)
- Global state only when 3+ unrelated components need the same data
- No prop drilling beyond 2 levels — introduce context or lift state
- Async state: always handle loading, error, and empty cases — all three, no exceptions

## Responsive Design — All 4 Breakpoints Required
Every UI component must be tested and functional at:
- `375px` — mobile
- `768px` — tablet
- `1280px` — desktop
- `1920px` — large desktop

Missing a breakpoint = Gate 4 failure.

## Accessibility Baseline (WCAG AA)
- Semantic HTML: use `<button>` not `<div onClick>`, `<nav>` not `<div className="nav">`
- All icon-only buttons must have `aria-label`
- All images must have meaningful `alt` text (empty string `""` for decorative images)
- Focus states must be visible — never `outline: none` without a custom focus style
- Colour contrast ratio: 4.5:1 for normal text, 3:1 for large text

## Performance
- No layout shift on initial load — set explicit dimensions on images and embedded content
- Lazy load images and heavy components that are below the fold
- No `useEffect` with missing or incorrect dependency arrays
- Avoid inline functions in JSX props for frequently re-rendered components

## Required UI States
Every data-fetching component must implement all three:
1. **Loading state** — skeleton or spinner while data loads
2. **Empty state** — message when data exists but list is empty
3. **Error state** — user-friendly message + retry action when fetch fails

## Storybook
Any reusable component (used in 2+ places) must have a Storybook story.
Story must cover: default state, loading, empty, error, and all key variants.

## Forbidden Patterns
- `any` TypeScript type — use `unknown` and narrow it
- Inline styles for layout (`style={{ display: 'flex' }}`) — use CSS classes
- Direct `document.querySelector` or `getElementById` — use refs
- `!important` in CSS — fix the specificity instead

---

## Phase 3 — New Frontend Patterns

### React Flow Custom Nodes
- All custom nodes in `src/components/canvas/nodes/` — one file per node type
- Consistent Handle positioning: inputs on left, outputs on right
- Every node has a config panel component: `{NodeType}ConfigPanel.tsx`
- Node state syncs to server on config panel close (debounced, not on every keystroke)
- Categories in palette: Triggers, Actions, Conditions, Flow — use collapsible groups

### Theme Toggle
- `ThemeToggle` component: Sun/Moon icon button in app header top-right
- Toggle `.dark` class on `<html>` element
- Persist preference to `localStorage` key `theme`
- Default: system preference via `prefers-color-scheme` media query
- Never conditionally import theme CSS — use CSS variables (already in `src/index.css`)

### Settings Page Sidebar Nav
- Settings uses sidebar layout: nav on left, content on right
- Sections: Org Profile, Team, Roles, Block Types, Brand Kit, Integrations, Routing Policies, Notifications, API Keys, Audit Log
- Use Next.js layout.tsx for sidebar + `children` pattern
- Active section highlighted in sidebar nav

### Task Card Component Structure
- `TaskCard` → `TaskCardHeader` (title + routing badge) + `TaskCardBody` (context + AI recommendation) + `TaskCardActions` (Approve/Reject/Edit)
- Confidence badge: color-coded (green ≥0.8, yellow ≥0.5, red <0.5)
- Routing indicator: Human (user icon), Agent (bot icon), Auto (zap icon)
- Edit mode: inline form for modifying AI recommendation before approval
