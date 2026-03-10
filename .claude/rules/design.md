---
paths:
  - "src/components/**"
  - "src/styles/**"
  - "src/app/**/page.tsx"
  - "prd/06-*"
---

# Design Rules

> Path-scoped — loads when working in component, style, or page files.
> Full standards: `.claude/standards/design-standards.md`

---

## Information Architecture
- Every page has a single primary purpose — if it does two things, it should be two pages
- Navigation should reflect user mental models: "My Work" (personal), "Workflows" (build/monitor), "Library" (browse resources)
- Maximum 2 clicks to reach any primary action from the dashboard

## Layout Patterns
- Use consistent page layout: page header (title + actions) → content area → optional sidebar
- Cards for browseable items (blocks, templates, documents)
- Tables for structured data (events, jobs, tasks)
- Detail panels (drawer or full page) for editing and viewing single items
- Modals only for quick confirmations or short forms — never for complex multi-step flows

## Responsive Design — All 4 Breakpoints Required
- `375px` — single column, stacked layout, hamburger nav
- `768px` — optional sidebar, 2-column where it helps
- `1280px` — primary target. Full sidebar, multi-column layouts
- `1920px` — max-width constraints, don't stretch content beyond readability

## Design System (shadcn/ui + Tailwind)
- Use shadcn/ui components as the baseline — don't reinvent buttons, inputs, dialogs
- Tailwind utility classes for layout and spacing — no custom CSS unless necessary
- Colour palette: gray scale for structure, accent colour for primary actions only
- Typography: consistent heading hierarchy (h1 page title, h2 section, h3 subsection)
- Icons: Lucide React only — consistent 16px (inline) or 20px (standalone) sizes

## Required UI States
Every data-driven page or component must implement:
1. **Loading** — skeleton placeholders that match the final layout shape
2. **Empty** — friendly message + primary CTA to create first item
3. **Error** — user-friendly message + retry action, never raw error text

## Accessibility (WCAG AA)
- Colour contrast: 4.5:1 for normal text, 3:1 for large text
- All interactive elements keyboard-accessible (Tab, Enter, Escape)
- Icon-only buttons must have `aria-label`
- Form inputs must have associated `<label>` elements
- Focus indicators must be visible on all interactive elements

## Canvas-Specific Rules
- Workflow canvas uses React Flow (@xyflow/react)
- Nodes have consistent sizing: minimum 180px width, 60px height
- Node colours indicate type: blue for triggers, green for actions, yellow for conditions, gray for wait
- Connection handles visible on hover, snap to grid
- Minimap always visible for orientation
- Zoom controls in bottom-right corner
