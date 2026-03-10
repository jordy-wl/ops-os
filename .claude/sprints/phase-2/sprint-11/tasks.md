# Sprint 11 Tasks — UI Foundation: Sidebar, Font, Animations

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 11
**Sprint Goal:** Replace horizontal top nav with persistent collapsible left sidebar, adopt Geist font, establish animation patterns, convert shadcn JSX→TSX, standardize page layout components.
**Target Duration:** ~1 week
**Branch:** `feature/P2-S11-ui-foundation`
**PR:** #34

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S11-FE-01 | Geist font integration | Frontend | LOW | — | DONE |
| P2-S11-FE-02 | Design token refinement | Frontend | MED | — | DONE |
| P2-S11-FE-03 | Sidebar navigation shell | Frontend | HIGH | FE-01, FE-02 | DONE |
| P2-S11-FE-04 | Global animation system | Frontend | MED | — | DONE |
| P2-S11-FE-05 | Loading skeleton standardization | Frontend | LOW | FE-03, FE-06 | DONE |
| P2-S11-FE-06 | Page layout components | Frontend | MED | — | DONE |
| P2-S11-QA-01 | Navigation regression tests | QA | MED | FE-03 | DONE |

**Total:** 7 tasks (6 FE, 1 QA)
**Critical path:** FE-01/02 → FE-03 → FE-05 + QA-01

---

## Task Details

### P2-S11-FE-01 — Geist Font Integration (LOW)

**What:** Integrate Geist and Geist Mono fonts via `next/font/google` with CSS custom properties.

**Files modified:**
- `src/app/layout.tsx` — added Geist/Geist_Mono imports, body className
- `src/app/globals.css` — replaced Arial with `var(--font-geist-sans)`
- `tailwind.config.js` — added `fontFamily.sans` and `fontFamily.mono`

**Gates:** G1, G4, G5

---

### P2-S11-FE-02 — Design Token Refinement (MED)

**What:** Align HSL values with Untitled UI principles, add transition CSS variables and animation keyframes.

**Files modified:**
- `tailwind.config.js` — added 7 keyframes and matching animation utilities
- `src/index.css` — added `@layer utilities` with interactive transition classes

**Gates:** G1, G4, G5

---

### P2-S11-FE-03 — Sidebar Navigation Shell (HIGH)

**What:** Replace `<AppNav />` horizontal nav with persistent collapsible left sidebar using shadcn SidebarProvider. Cookie-based state persistence, mobile Sheet overlay, Cmd+B toggle, icon-only collapsed mode.

**Files created:**
- `src/components/shell/app-sidebar.tsx` — main sidebar component with 3 nav sections (Main, Library, Settings), Clerk OrganizationSwitcher/UserButton

**Files modified:**
- `src/app/(app)/layout.tsx` — complete rewrite with SidebarProvider + AppSidebar + SidebarInset
- `src/components/ui/sidebar.tsx` — complete TypeScript rewrite (JSX→TSX, 764 lines, 20+ typed components)
- `src/components/ui/separator.tsx` — converted JSX→TSX with Radix primitive types
- `src/components/ui/button.tsx` — converted JSX→TSX
- `src/components/ui/input.tsx` — converted JSX→TSX
- `src/components/ui/sheet.tsx` — converted JSX→TSX
- `src/components/ui/tooltip.tsx` — converted JSX→TSX

**Deleted:**
- `src/components/ui/sidebar.jsx`
- `src/components/ui/separator.jsx`
- `src/components/ui/button.jsx`
- `src/components/ui/input.jsx`
- `src/components/ui/sheet.jsx`
- `src/components/ui/tooltip.jsx`

**Gates:** G1, G2, G4, G5, G6

---

### P2-S11-FE-04 — Global Animation System (MED)

**What:** Define animation keyframes and utility classes for page transitions, hover effects, and loading states.

**Files modified:**
- `tailwind.config.js` — keyframes: fade-in, fade-out, slide-in-from-left, slide-in-from-bottom, slide-in-from-top, scale-in, shimmer
- `src/index.css` — utilities: .transition-interactive, .hover-card, .active-press, .animate-page-in, .shimmer

**Gates:** G1, G4, G5

---

### P2-S11-FE-05 — Loading Skeleton Standardization (LOW)

**What:** Update all loading.tsx files for sidebar-aware layout, add shimmer animation.

**Files modified:**
- `src/components/ui/skeleton.tsx` — extended props to `React.HTMLAttributes<HTMLDivElement>`, changed bg to `bg-muted`
- All 9 `loading.tsx` files — replaced outer `<div className="p-6 lg:p-8">` with `<PageContainer>`

**Gates:** G1, G4, G5

---

### P2-S11-FE-06 — Page Layout Components (MED)

**What:** Create standardized page wrapper and content section components.

**Files created:**
- `src/components/shell/page-container.tsx` — max-width variants, HTML attribute pass-through
- `src/components/shell/content-section.tsx` — reusable section with title/description/actions

**Gates:** G1, G4, G5

---

### P2-S11-QA-01 — Navigation Regression Tests (MED)

**What:** Unit tests for sidebar nav config structure and active state logic.

**Files created:**
- `src/components/shell/__tests__/app-sidebar.test.tsx` — 14 tests

**Details:**
- Nav config: 7 items, no duplicate hrefs/labels, correct section grouping
- Active state: exact match for /dashboard, prefix match for all others, only one active at a time

**Gates:** G1, G2, G5

---

## Dependencies

```
FE-01 (Geist font) ──┐
FE-02 (tokens)   ────┤
FE-04 (animations)   │── FE-03 (sidebar shell) ──── QA-01 (nav tests)
                      │                         │
FE-06 (page layout) ─┘                         └── FE-05 (loading skeletons)
```
