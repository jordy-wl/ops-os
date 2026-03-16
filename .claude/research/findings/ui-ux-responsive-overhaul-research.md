# UI/UX Responsive Overhaul Research

> **Purpose:** Pre-implementation research for Ops OS responsive layout system + visual polish
> **Date:** 2026-03-12
> **Status:** Research complete — ready for execution planning
> **Inspiration:** refero.design, Linear, Rippling, HubSpot, Deel, Notion

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Responsive Layout Strategy](#2-responsive-layout-strategy)
3. [Design Trends 2025-2026](#3-design-trends-2025-2026)
4. [Animation & Micro-Interactions](#4-animation--micro-interactions)
5. [Navigation Patterns](#5-navigation-patterns)
6. [Design System Recommendations](#6-design-system-recommendations)
7. [Anti-Patterns to Avoid](#7-anti-patterns-to-avoid)
8. [Prioritized Implementation Plan](#8-prioritized-implementation-plan)

---

## 1. Current State Assessment

### App Shell Architecture

The app uses a **persistent left sidebar + main content area** pattern:

```
┌──────────────────────────────────────────────┐
│ Root Layout: ClerkProvider + Geist fonts      │
│ ┌──────────────────────────────────────────┐ │
│ │ App Layout: SidebarProvider              │ │
│ │ ┌─────────┬────────────────────────────┐ │ │
│ │ │         │ Header (h-12)              │ │ │
│ │ │ App     │ SidebarTrigger + Separator │ │ │
│ │ │ Sidebar │────────────────────────────│ │ │
│ │ │         │ Main Content               │ │ │
│ │ │ 240px   │ animate-page-in            │ │ │
│ │ │ expanded│ ┌──────────────────────┐   │ │ │
│ │ │ 48px    │ │ PageContainer        │   │ │ │
│ │ │ rail    │ │ p-6 lg:p-8           │   │ │ │
│ │ │         │ │ max-w-6xl default     │   │ │ │
│ │ │         │ └──────────────────────┘   │ │ │
│ │ │         │                            │ │ │
│ │ │         │ ChatWidgetShell (fixed)    │ │ │
│ │ └─────────┴────────────────────────────┘ │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Sidebar Structure (3 nav groups)
- **Main:** Dashboard, My Work, Workflows
- **Library:** Blocks, Documents, Integrations
- **Settings** (single link)
- Footer: OrganizationSwitcher + UserButton (Clerk)
- Collapsible: `collapsible="icon"` (Cmd/Ctrl+B toggle)
- Mobile: converts to Sheet drawer via `useIsMobile()` hook (768px breakpoint)

### Current Responsive Patterns

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Sidebar | Icon rail on desktop, Sheet on mobile | Partially responsive |
| Dashboard cards | `grid-cols-2 lg:grid-cols-4` | Good |
| Block list | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | Good |
| Quick actions | `grid-cols-1 md:grid-cols-2` | Good |
| Padding | `p-6 lg:p-8` | Minimal but present |
| Chat widget | Fixed 480x600px bottom-left | **NOT responsive** |
| Search inputs | `w-full sm:w-80` | OK |
| Flex controls | `flex flex-wrap gap-3` | OK |

### Breakpoints in Use
- `sm` (640px) — minor adjustments
- `md` (768px) — primary mobile/tablet boundary
- `lg` (1024px) — desktop padding + layout shifts
- `xl` (1280px) — wide desktop (rarely used)

### Key Gaps for Responsive Overhaul
1. **Chat widget** — hardcoded 480x600px, no mobile adaptation
2. **No bottom navigation** — mobile relies solely on hamburger sheet
3. **No breadcrumbs** — back navigation depends on browser button
4. **Tables** — no horizontal scroll fallback on mobile
5. **Workflow builder** — no simplified mobile layout
6. **Block detail** — multi-panel layout doesn't collapse on mobile
7. **Settings** — will need secondary sidebar for Phase 3's 10 sections

### Existing Animation System (Tailwind Config)
```
fade-in, fade-out
slide-in-from-left, slide-in-from-bottom, slide-in-from-top
scale-in, shimmer, slide-up
accordion-down, accordion-up
```
Applied as: `animate-page-in`, `animate-slide-up`, `animate-fade-in`

### Dark Mode
- Fully implemented (Sprint 16 — 73 files converted)
- `darkMode: ["class"]` in tailwind config
- HSL CSS variables for all colors
- System preference detection + class toggle

---

## 2. Responsive Layout Strategy

### Core Principle: Horizontal → Vertical Stack

The fundamental responsive pattern: **horizontal arrangements collapse to vertical stacks** as viewport narrows.

### Breakpoint Strategy

```
┌─────────────────────────────────────────────────────────┐
│ DESKTOP (≥1280px)                                        │
│ Full sidebar (240px) + content area + optional right panel│
│ 4-column grids, side-by-side layouts                     │
├─────────────────────────────────────────────────────────┤
│ LAPTOP (1024-1279px)                                     │
│ Collapsed sidebar (icon rail 48px) + full-width content  │
│ 3-column grids, stacked right panels                     │
├─────────────────────────────────────────────────────────┤
│ TABLET (768-1023px)                                      │
│ Hidden sidebar (hamburger overlay) + full-width content  │
│ 2-column grids                                           │
├─────────────────────────────────────────────────────────┤
│ MOBILE (375-767px)                                       │
│ Bottom tab bar (4 items) + full-width single column      │
│ Stacked everything, bottom sheet for modals              │
└─────────────────────────────────────────────────────────┘
```

### Layout Transformation Examples

#### Dashboard (Stat Cards)
```
Desktop (≥1280px):     [Card 1] [Card 2] [Card 3] [Card 4]   ← grid-cols-4
Laptop (1024-1279px):  [Card 1] [Card 2] [Card 3] [Card 4]   ← grid-cols-4
Tablet (768-1023px):   [Card 1] [Card 2]                      ← grid-cols-2
                       [Card 3] [Card 4]
Mobile (<768px):       [Card 1]                                ← grid-cols-2
                       [Card 2]                                   (compact)
                       [Card 3]
                       [Card 4]
```

#### Block Detail Page
```
Desktop:     ┌─────────────────────────┬──────────────┐
             │ Main Content (tabs)     │ Metadata     │
             │ Overview | Timeline |   │ Properties   │
             │ Graph | Workflow        │ Connections   │
             └─────────────────────────┴──────────────┘

Mobile:      ┌────────────────────────────────────────┐
             │ [Overview] [Timeline] [Graph] [More ▾] │ ← scrollable tabs
             ├────────────────────────────────────────┤
             │ Main Content                           │
             ├────────────────────────────────────────┤
             │ ▸ Properties (accordion)               │
             │ ▸ Connections (accordion)               │
             └────────────────────────────────────────┘
```

#### Settings Page (Phase 3: 10 sections)
```
Desktop:     ┌──────────┬──────────────────────────────┐
             │ Settings │ Section Content               │
             │ Sidebar  │                               │
             │          │                               │
             │ General  │ [Form fields, toggles, etc]   │
             │ Team     │                               │
             │ Roles    │                               │
             │ Routing  │                               │
             │ Notifs   │                               │
             │ API Keys │                               │
             │ Audit    │                               │
             └──────────┴──────────────────────────────┘

Mobile:      ┌────────────────────────────────────────┐
             │ ← Settings                             │
             ├────────────────────────────────────────┤
             │ ▸ General                              │
             │ ▸ Team                                 │
             │ ▸ Roles & Permissions                  │
             │ ▸ Routing Policies                     │
             │ ▸ Notifications                        │
             │ ▸ API Keys                             │
             │ ▸ Audit Log                            │
             └────────────────────────────────────────┘
             (Tap → drills into full-screen section)
```

#### Chat Widget
```
Desktop:     Fixed bottom-left, 480×600px, collapsible to FAB

Tablet:      Fixed bottom-left, 400×500px, collapsible

Mobile:      Full-screen overlay (100vw × 100vh - header)
             Bottom sheet pattern: slides up from bottom
             FAB trigger stays at bottom-right corner
```

### Navigation Transformation

```
Desktop/Laptop:    Left Sidebar (expanded or icon rail)
                   ┌──────────┐
                   │ Logo     │
                   │──────────│
                   │ Dashboard│
                   │ My Work  │
                   │ Workflows│
                   │──────────│
                   │ Blocks   │
                   │ Docs     │
                   │ Integr.  │
                   │──────────│
                   │ Settings │
                   │──────────│
                   │ Org/User │
                   └──────────┘

Mobile:            Header bar + bottom tab bar
                   ┌────────────────────────────┐
                   │ ☰  Ops OS    🔔  👤        │  ← compact header
                   ├────────────────────────────┤
                   │                            │
                   │     Content Area           │
                   │                            │
                   ├────────────────────────────┤
                   │ 🏠   📋   ⚡   📚   ⋯    │  ← bottom tabs
                   │Home  Work  Flow  Lib  More │
                   └────────────────────────────┘
```

### Content Reflow Patterns

| Desktop Pattern | Mobile Pattern | When |
|----------------|----------------|------|
| Side-by-side panels | Vertical stack | Block detail, settings |
| Horizontal tabs | Scrollable tabs | Block detail, workflows |
| Data table | Card list | Block list, event log |
| Right sidebar metadata | Accordion below content | Block detail |
| Multi-column grid | 1-2 column grid | Dashboard, library |
| Modal dialog | Bottom sheet | Create forms, confirmations |
| Floating chat | Full-screen overlay | Chat widget |
| Command palette | Full-screen search | Cmd+K |
| Hover tooltips | Long-press or inline text | Icon buttons |

---

## 3. Design Trends 2025-2026

### Visual Direction: "Muted Minimalism with Strategic Accent"

The dominant aesthetic for B2B SaaS in 2025-2026 is professional minimalism with one strong brand accent color.

### Color Philosophy

**Backgrounds:**
- Light mode: off-white (`#FAFAFA`, `#F9FAFB`) — NOT pure white (causes eye strain)
- Dark mode: very dark gray (`#0A0A0A`, `#111111`) — NOT pure black (harsh on OLED)
- Card surfaces: slightly elevated from page bg (light: `#FFFFFF` on `#FAFAFA`; dark: `#1A1A1A` on `#0A0A0A`)

**Accent Strategy:**
- Single strong accent color used sparingly: primary buttons, active states, focus rings
- Status colors remain standardized: green (success), amber (warning), red (error), blue (info)
- Gradients only for branded/marketing areas — never on functional UI

### Typography Trends
- **Font choice:** System-optimized variable fonts (Inter, Geist). Ops OS already uses Geist — correct.
- **Size scale:** 13-14px body (dense data apps use 13), 18-24px page titles, 12px muted text
- **Weight:** Semi-bold (600) for headings, not bold (700). Regular (400) body. Medium (500) labels.
- **Hierarchy through spacing and color, not size jumps**

### Container Styling: "Soft Containers with Subtle Borders"
- **Current trend:** Flat with 1px low-contrast border. Minimal shadow.
- **Dead:** Glassmorphism (peaked 2022), neumorphism (never took hold in business apps)
- **Corners:** `rounded-lg` (8px) standard for cards, `rounded-xl` (12px) for modals
- **Shadows:** Almost none by default. `shadow-sm` on hover. `shadow-md` for popovers. `shadow-lg` for modals only.

### Information Density
- "Comfortable density" — not Bloomberg Terminal, not a marketing page
- Card padding: 16-20px (`p-4` to `p-5`)
- Card gaps: 12-16px (`gap-3` to `gap-4`)
- Section spacing: 24-32px (`space-y-6` to `space-y-8`)
- For Ops OS (operations tool for capital markets): lean toward Linear's density — ops leads want data, not white space

### Dark Mode
- **Three-way toggle is now standard:** Light / Dark / System
- Layered grays in dark mode (not flat)
- Text: `#EDEDED` primary, `hsl(0 0% 60%)` muted — NOT pure white
- Borders: slightly more visible in dark mode
- Shadows: removed or replaced with subtle glow in dark mode

### Reference Apps by Design Relevance to Ops OS

| Rank | App | Why |
|------|-----|-----|
| 1 | **Linear** | Speed, density, keyboard-first, dark mode, sidebar pattern |
| 2 | **Rippling** | Compound BOS navigation, cross-domain workflows, approval routing |
| 3 | **HubSpot** | Record page layout (timeline + metadata sidebar + associations) |
| 4 | **Deel** | Clean sidebar, jurisdiction awareness, document management |
| 5 | **Notion** | Inline editing, flexible views, AI integration approaches |

**Do NOT reference:** Monday.com (too playful for capital markets), ClickUp (too dense/overwhelming), Airtable (too spreadsheet-focused)

---

## 4. Animation & Micro-Interactions

### Page Transitions
- **Entry:** Fade in + slide up 8-16px, 200-300ms ease-out (already have `animate-page-in`)
- **Exit:** None (instant). Users perceive exit animations as lag.
- **Route change:** content area fades; shell (sidebar + header) stays static

### Loading States
- **Skeleton screens are universal standard.** Spinners are almost fully replaced.
- **Progressive loading:** Show shell immediately → skeletons for data regions → replace with content
- **Staggered skeleton entry:** 50ms offset per skeleton row/card for visual smoothness
- **Inline spinners:** Small (16-20px) only for button actions (submit, save)
- **Optimistic updates:** Show change immediately, revert on error

### Component Interactions

| Element | Hover | Active/Press | Focus |
|---------|-------|-------------|-------|
| Button (primary) | Darken 10%, 150ms | Scale 98%, 50ms | Ring 2px offset |
| Button (ghost) | Bg muted, 150ms | Bg muted/foreground | Ring 2px offset |
| Card | `shadow-sm` + slight bg change | — | Ring 2px |
| Sidebar item | Bg highlight, 100ms | Bg accent, 50ms | Ring inset |
| Table row | Bg muted, 100ms | — | — |
| Input | Border primary on focus, 150ms | — | Ring 2px |

### Sidebar Animation
- **Expand/collapse:** 200-300ms ease-out expand, 150-200ms ease-in collapse
- **Content area resizes smoothly** (CSS transition on margin/width)
- **Icon labels:** fade in/out during transition
- **Mobile sheet:** slide in from left, 250ms ease-out + backdrop fade

### Toast/Notification
- **Entry:** Slide in from right + fade, 200ms
- **Exit:** Fade out, 150ms
- **Auto-dismiss:** 4-5s for success, persist for errors
- **Stack:** Multiple toasts stack vertically

### List Animations (consider Framer Motion for these)

```tsx
// Staggered list entry
<motion.div
  variants={{ show: { transition: { staggerChildren: 0.05 } } }}
  initial="hidden" animate="show"
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0 }
      }}
    />
  ))}
</motion.div>

// Presence animation for mount/unmount
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    />
  )}
</AnimatePresence>

// Layout animation for reordering
<motion.div layout layoutId={item.id} />
```

### When to Use Framer Motion vs CSS-Only

| Use Case | Approach |
|----------|----------|
| Page fade-in | CSS (existing `animate-page-in`) |
| Hover/focus states | CSS transitions |
| Skeleton shimmer | CSS (existing `animate-shimmer`) |
| Sidebar expand/collapse | CSS transitions |
| Toast entry/exit | CSS or Sonner (already handled) |
| **List stagger on mount** | **Framer Motion** |
| **List item reorder** | **Framer Motion** |
| **Presence animations (mount/unmount)** | **Framer Motion** |
| **Panel slide-in/out** | **Framer Motion** |
| **Workflow node animations** | **Framer Motion** |

---

## 5. Navigation Patterns

### Primary: Left Sidebar (Current — Keep)
- Full sidebar at ≥1280px (240px)
- Icon rail at 1024-1279px (48px)
- Sheet overlay at <1024px
- Keyboard toggle: Cmd/Ctrl+B

### New: Bottom Tab Bar (Mobile <768px)

```
Proposed tabs:
┌──────────────────────────────────────┐
│  🏠      📋      ⚡      📚     ⋯   │
│ Home   My Work  Flows   Library  More│
└──────────────────────────────────────┘

"More" overflow menu:
├── Settings
├── Notifications
├── Org Switcher
└── Profile
```

- 4 primary tabs + "More" overflow
- Active tab: filled icon + accent color underline
- Badge indicators on My Work (pending tasks) and Notifications
- Safe area padding for iOS notch/home indicator

### New: Breadcrumbs in Header

```
Desktop:  Dashboard / Blocks / Thornfield Capital
Mobile:   ← Thornfield Capital  (back arrow + current page only)
```

- Show on pages >1 level deep
- Collapse intermediate levels to `...` dropdown on narrow viewports
- Place after SidebarTrigger + Separator in existing header

### New: Command Palette (Cmd+K)

```
┌──────────────────────────────────────┐
│ 🔍 Search blocks, navigate, actions…│
├──────────────────────────────────────┤
│ RECENT                               │
│   📊 Thornfield Capital              │
│   📋 Client Onboarding              │
│   ⚡ New Deal Workflow               │
├──────────────────────────────────────┤
│ NAVIGATION                           │
│   🏠 Dashboard                       │
│   📋 My Work                         │
│   ⚡ Workflows                       │
├──────────────────────────────────────┤
│ ACTIONS                              │
│   ➕ Create Block                     │
│   ➕ Create Workflow                  │
│   🌙 Toggle Dark Mode                │
└──────────────────────────────────────┘
```

- Trigger: Cmd+K (Mac) / Ctrl+K (Windows)
- Built on shadcn `Command` component (cmdk)
- Sections: Recent, Navigation, Actions, Search results
- Keyboard nav: arrows to move, Enter to select, Esc to close
- On mobile: full-screen overlay with search input

### Settings Navigation (Phase 3)

10 settings sections need secondary navigation:
- Desktop: left sidebar within settings layout
- Mobile: list view → drill into section (full-screen)
- Sections: General, Team, Roles & Permissions, Routing Policies, Notifications, API Keys, Audit Log, Block Types, Brand Kit, Integrations

---

## 6. Design System Recommendations

### Brand Color Options

For a BOS targeting capital markets (trust, precision, operational intelligence):

**Option A — Indigo (recommended):**
```css
--primary: 234 89% 57%;     /* #4F46E5 */
--primary-hover: 234 89% 50%;
--primary-foreground: 0 0% 100%;
```
Conveys intelligence and trust. Differentiates from Salesforce (lighter blue), HubSpot (orange), Monday (purple).

**Option B — Teal:**
```css
--primary: 172 66% 40%;     /* #0D9488 */
--primary-hover: 172 66% 35%;
--primary-foreground: 0 0% 100%;
```
Conveys growth and clarity. More unique in the BOS space.

### Spacing System (4px base)

```
gap-1:  4px   → compact list items, inline elements
gap-2:  8px   → related items, form field gaps
gap-3:  12px  → card gaps, control groups
gap-4:  16px  → section gaps within a card
gap-6:  24px  → major section gaps
gap-8:  32px  → page-level section gaps
```

### Border Radius Scale

```
rounded-sm:  4px   → badges, tags, small elements
rounded-md:  6px   → buttons, inputs
rounded-lg:  8px   → cards, containers
rounded-xl:  12px  → modals, large containers, bottom sheets
```

### Shadow Scale (Minimal)

```
shadow-none  → default for all elements
shadow-sm    → cards on hover, elevated surfaces
shadow-md    → dropdowns, popovers, floating elements
shadow-lg    → modals, command palette, bottom sheets
```

### Three-Way Theme Toggle

```
[☀️ Light] [🌙 Dark] [💻 System]
```

Replace binary toggle with segmented control. Store preference in localStorage + cookie for SSR.

---

## 7. Anti-Patterns to Avoid

1. **Hamburger menu as only desktop nav** — always show the sidebar on desktop
2. **Full-page loading spinners** — use skeleton screens for data regions
3. **Modal from modal** — use slide-over panels instead of stacking modals
4. **Custom scrollbars** — browser defaults work correctly
5. **Tooltip overload** — only on icon-only buttons and abbreviated labels
6. **Gradient backgrounds on data areas** — never on tables, lists, or forms
7. **Auto-playing decorative animations** — only loading shimmer should loop
8. **Infinite scroll without position memory** — use pagination for audit-critical lists
9. **Hidden keyboard shortcuts** — show them in command palette and a `?` overlay
10. **Inconsistent empty states** — every list needs an empty state with CTA
11. **Pure white / pure black** — use off-white and very dark gray
12. **Heavy box-shadows** — `shadow-sm` maximum for cards
13. **Exit animations on navigation** — instant exits feel faster
14. **Wrapping horizontal tabs to multiple lines** — scroll horizontally instead

---

## 8. Prioritized Implementation Plan

### Phase A: Foundation (Do First)

| Item | Description | Effort | Files |
|------|-------------|--------|-------|
| Bottom tab bar component | Mobile nav with 4 tabs + More | MEDIUM | New: `src/components/shell/bottom-tab-bar.tsx` |
| Responsive sidebar logic | Auto-collapse at 1024px, hide at 768px | LOW | Edit: `app-sidebar.tsx`, `(app)/layout.tsx` |
| Breadcrumbs in header | Context-aware breadcrumb trail | LOW | Edit: `(app)/layout.tsx`, new: breadcrumb component |
| Chat widget responsive | Full-screen on mobile, bottom sheet pattern | MEDIUM | Edit: `chat-widget-shell.tsx` |
| Three-way theme toggle | Light/Dark/System segmented control | LOW | Edit: theme provider |

### Phase B: Content Reflow

| Item | Description | Effort | Files |
|------|-------------|--------|-------|
| Block detail responsive | Metadata panel → accordion on mobile | MEDIUM | Edit: block detail page |
| Settings secondary nav | Left sidebar desktop, drill-down mobile | MEDIUM | New: settings layout |
| Table → card conversion | Responsive data display utility | MEDIUM | New: responsive table component |
| Workflow builder mobile | Simplified read-only mobile view | HIGH | Edit: builder components |

### Phase C: Polish & Interactions

| Item | Description | Effort | Files |
|------|-------------|--------|-------|
| Command palette (Cmd+K) | Search + navigate + actions | MEDIUM | New: command palette component |
| Framer Motion for lists | Staggered entry, presence, reorder | LOW | Add: framer-motion, edit list components |
| Skeleton screens everywhere | Loading states for all data pages | MEDIUM | Edit: all page loading.tsx files |
| Staggered animations | List items fade in with 50ms stagger | LOW | Edit: list components |
| Keyboard shortcut overlay | `?` key shows shortcuts panel | LOW | New: shortcuts overlay |

### Phase D: Refinement

| Item | Description | Effort | Files |
|------|-------------|--------|-------|
| Brand color finalization | Apply chosen accent color system-wide | LOW | Edit: globals.css |
| Density toggle | Compact/Default/Comfortable | MEDIUM | New: density context |
| Mobile gesture support | Swipe to navigate, pull to refresh | MEDIUM | Add: gesture library |
| Performance audit | Ensure animations don't cause jank | LOW | Profiling pass |

---

## Appendix: File Reference

### Current Layout Files
- `src/app/layout.tsx` — root layout (ClerkProvider, fonts)
- `src/app/(app)/layout.tsx` — app shell (sidebar + header + content)
- `src/components/shell/app-sidebar.tsx` — sidebar navigation
- `src/components/shell/page-container.tsx` — page wrapper (padding, max-width, fade-in)
- `src/components/shell/page-header.tsx` — page title + actions
- `src/components/shell/content-section.tsx` — section wrapper

### Styling Files
- `tailwind.config.js` — breakpoints, colors, animations, dark mode config
- `src/app/globals.css` — CSS variables, base styles

### Key Hooks
- `src/hooks/use-mobile.jsx` — `useIsMobile()` (768px breakpoint)
- `src/components/ui/sidebar.tsx` — shadcn sidebar with mobile sheet fallback

### Sprint 10 UX Research
- `.claude/research/findings/ux-research-sprint-10.md` — existing audit with 12 findings

### Design Spec
- `.claude/prd/06-frontend-spec.md` — frontend specification
- `.claude/research/findings/competitive-analysis.md` — competitive landscape

---

## Inspiration: refero.design

**About:** refero.design is a curated UI/UX inspiration library featuring real screenshots from production apps. Categories include dashboards, SaaS tools, settings pages, navigation patterns, data tables, and mobile layouts. The site supports dark mode and organizes designs by app and category.

**How to use for Ops OS:** Browse the following categories when implementing each phase:
- **Dashboard** — stat card layouts, metric displays, activity feeds
- **Settings** — secondary nav patterns, form layouts, toggle groups
- **Navigation** — sidebar variations, breadcrumbs, bottom tabs
- **Tables** — responsive data display, sort/filter UI
- **Cards** — container styles, hover states, information density
- **Dark mode** — color palette choices, contrast levels, surface elevation

Filter by apps similar to Ops OS's target aesthetic: Linear, Notion, Figma, Stripe Dashboard, Vercel Dashboard.