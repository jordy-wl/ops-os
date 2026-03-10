# Design Spec — Sprint 10 UI Polish

> P2-S10-UI-01 deliverable. Guides FE-01, FE-02, FE-03.
> Priority: HIGH = do first, MED = if time, LOW = defer.

---

## 1. Navigation Improvements (FE-01)

### 1.1 Breadcrumb Component — HIGH
Add a `<Breadcrumb>` component rendered below the nav bar on every page.

```
Dashboard / Library / Blocks          ← 3 levels
Dashboard / Blocks / Meridian Holdings ← block detail
Dashboard / Workflows / Builder        ← canvas
```

**Implementation:**
- Create `src/components/shell/breadcrumb.tsx`
- Parse `usePathname()` segments into breadcrumb items
- Map route segments to display names: `blocks` → "Blocks", `library` → "Library"
- For dynamic segments (`[id]`), pass page title as prop
- Tailwind: `text-sm text-gray-500` with `text-gray-900` for current page
- Separator: `/` or `ChevronRight` icon (4px lucide)

### 1.2 Active Library Sub-Page in Nav — HIGH
When on `/library/blocks`, the Library dropdown button label should show which sub-page is active.

**Current:** `Library ▾` (always)
**Proposed:** `Library: Blocks ▾` when on `/library/blocks`

In `app-nav.tsx`, compute active sub-label:
```tsx
const activeLibraryLabel = LIBRARY_LINKS.find(l => pathname.startsWith(l.href))?.label
// Button text: activeLibraryLabel ? `Library: ${activeLibraryLabel}` : 'Library'
```

### 1.3 Standardize Page Header — HIGH
Every page should use a consistent header component:

```
┌──────────────────────────────────────────────┐
│ [Page Title]                    [Action Btns] │
│ [Subtitle / description]                      │
│ [Breadcrumb]                                  │
├──────────────────────────────────────────────┤
│ [Page Content]                                │
└──────────────────────────────────────────────┘
```

Create `src/components/shell/page-header.tsx`:
```tsx
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode  // buttons on the right
  breadcrumbs?: { label: string; href?: string }[]
}
```

Tailwind:
- Title: `text-2xl font-semibold text-gray-900`
- Subtitle: `text-sm text-gray-500 mt-1`
- Actions wrapper: `flex items-center gap-2`
- Breadcrumbs: `text-sm text-gray-500 mt-2` with links `hover:text-gray-700`
- Bottom border: `border-b pb-4 mb-6`

### 1.4 Loading Skeletons — HIGH
Add `animate-pulse` skeleton placeholders to every server-fetched page.

**Pattern** — create `src/components/ui/skeleton.tsx`:
```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-gray-100 animate-pulse rounded', className)} />
}
```

Usage per page:
- Dashboard: 4-card grid of `h-24 w-full` skeletons + `h-64` event feed skeleton
- My Work: 4 section skeletons (`h-48` each)
- Block Detail: `h-8 w-48` title + `h-64` data panel + `h-48` events
- Library pages: 6x `h-32 w-full` card skeletons in grid

Add `loading.tsx` files to each `(app)/` route for Next.js streaming:
- `src/app/(app)/dashboard/loading.tsx`
- `src/app/(app)/my-work/loading.tsx`
- `src/app/(app)/blocks/[id]/loading.tsx`
- `src/app/(app)/library/blocks/loading.tsx`
- `src/app/(app)/library/documents/loading.tsx`
- `src/app/(app)/library/integrations/loading.tsx`

---

## 2. Dashboard Overhaul (FE-03)

### 2.1 Dashboard Layout — HIGH

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                              [+ New Block] [+ WF] │
│ Your workspace at a glance                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ ## Blocks │ │ ## Active │ │ ## Events│ │ ## Tasks │       │
│  │ Total    ▸│ │ Workflows│ │ (24h)   ▸│ │ Pending ▸│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Recent Activity                           [View All] │    │
│  │ ────────────────────────────────────────────────────  │    │
│  │ ● block.created  Meridian Holdings    2 min ago      │    │
│  │ ● email.sent     Pacific Ventures     15 min ago     │    │
│  │ ● document.gen   Meridian Holdings    1 hr ago       │    │
│  │ ● workflow.done  Client Onboarding    3 hrs ago      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────┐      │
│  │ Quick Actions         │ │ Block Types              │      │
│  │ ─────────────────────│ │ ──────────────────────── │      │
│  │ [+ Create Block]      │ │ Clients: 5              │      │
│  │ [+ New Workflow]       │ │ Projects: 3             │      │
│  │ [Open Library]         │ │ Contacts: 8             │      │
│  │ [View Integrations]    │ │ Deals: 2                │      │
│  └──────────────────────┘ └──────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Stat Cards — HIGH
Each stat card is clickable (navigates to relevant page):
- Blocks → `/library/blocks`
- Active Workflows → `/workflows`
- Events (24h) → scroll to activity feed
- Tasks → `/my-work`

Tailwind for stat card:
```
rounded-lg border p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer
```
- Number: `text-3xl font-bold text-gray-900`
- Label: `text-sm text-gray-500 mt-1`
- Arrow icon: `text-gray-400` on the right

### 2.3 Recent Activity Feed — HIGH
Show last 10 events with:
- Event type icon (colored dot by category)
- Event type label (human-readable)
- Block name (linked to block detail)
- Relative time (`2 min ago`, `1 hr ago`)

Event type colors:
- `block.*` → blue-500
- `email.*` → green-500
- `document.*` → amber-500
- `workflow.*` → purple-500
- `onboarding.*` → cyan-500

### 2.4 Quick Actions Panel — MED
Grid of 4 action buttons:
- Create Block → opens create block dialog or navigates to `/library/blocks`
- New Workflow → navigates to `/workflows` with create intent
- Open Library → `/library/blocks`
- View Integrations → `/library/integrations`

Tailwind: `flex flex-col gap-2`, each button `flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 border`

---

## 3. Blocks + Workflows Polish (FE-02)

### 3.1 Block Detail Breadcrumb — HIGH
Add breadcrumb to block detail: `Blocks / [Block Name]`

### 3.2 Empty States — HIGH
For blocks list, workflows list, events timeline, task list:

**Pattern:**
```
┌─────────────────────────────────────┐
│         [Illustration/Icon]          │
│                                      │
│     No [items] yet                   │
│     [Helpful description]            │
│                                      │
│     [+ Create First Item]            │
└─────────────────────────────────────┘
```

Create `src/components/ui/empty-state.tsx`:
```tsx
interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  action?: { label: string; href: string }
}
```

Tailwind:
- Wrapper: `flex flex-col items-center justify-center py-12 text-center`
- Icon: `h-12 w-12 text-gray-300 mb-4`
- Title: `text-lg font-medium text-gray-900 mb-1`
- Description: `text-sm text-gray-500 mb-4 max-w-sm`
- Action button: `inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800`

### 3.3 Canvas Node Styling — MED
Differentiate node types visually:
- **Trigger nodes:** Blue border + blue header (`border-blue-200 bg-blue-50`)
- **Action nodes:** Green border (`border-green-200 bg-green-50`)
- **Condition nodes:** Amber border, diamond-shape hint (`border-amber-200 bg-amber-50`)
- **Wait nodes:** Gray border, clock icon (`border-gray-200 bg-gray-50`)
- **End nodes:** Red border (`border-red-200 bg-red-50`)

Each node header: type icon + step type label. Body: step name.

### 3.4 Workflow List Improvements — MED
Add status badges to workflow templates and instances:
- Template: show step count badge
- Instance: colored status badge (running=blue, done=green, failed=red, pending=gray)

### 3.5 Error Boundary — MED
Create `src/components/ui/error-boundary.tsx` wrapping each main page section.
On error: show "Something went wrong" + retry button instead of crashing.

---

## 4. Component Patterns to Standardize

### 4.1 Toast Notifications — HIGH
Add a toast system for action feedback (send email, generate document, save brand kit).

Use existing shadcn toast pattern or create `src/components/ui/toast.tsx`:
- Position: bottom-right
- Auto-dismiss: 4 seconds
- Types: success (green), error (red), info (blue)
- Animation: slide in from right

### 4.2 Consistent Card Component — MED
Standardize the card pattern used in library pages:

```tsx
interface CardProps {
  title: string
  subtitle?: string
  badge?: { label: string; color: string }
  icon?: React.ElementType
  href?: string
  actions?: React.ReactNode
}
```

Tailwind: `rounded-lg border p-4 hover:border-gray-300 hover:shadow-sm transition-all`

---

## 5. Responsive Breakpoint Notes

### 375px (Mobile)
- Nav: Currently uses horizontal scroll (`overflow-x-auto`) — OK but Library dropdown is hard to tap
- Library pages: Single column grid — GOOD
- Block detail: Single column stack — GOOD
- Canvas: Not usable on mobile — add a "Desktop required" message
- **Fix needed:** Library dropdown needs larger tap target on mobile (min 44px)

### 768px (Tablet)
- Nav: All items visible — GOOD
- Library pages: 2-column grid — GOOD
- Dashboard: Stats should be 2x2 grid, not 4-across

### 1280px (Desktop)
- All pages: GOOD
- Dashboard: 4 stat cards in row, activity feed below

### 1920px (Wide)
- Max-width container should be `max-w-7xl` (not `max-w-4xl` as block detail currently uses)
- Library pages: 4-column grid at this width
- Dashboard: Consider side-by-side layout for activity + quick actions

---

## 6. Priority Ranking

| # | Improvement | Task | Priority | Impact |
|---|------------|------|----------|--------|
| 1 | Loading skeletons on all pages | FE-01 | HIGH | Prevents content flash, professional feel |
| 2 | Page header component (title + subtitle + actions) | FE-01 | HIGH | Consistent look across all pages |
| 3 | Dashboard stat cards (real metrics) | FE-03 | HIGH | Dashboard becomes useful, not decorative |
| 4 | Dashboard recent activity feed | FE-03 | HIGH | Shows system is alive |
| 5 | Dashboard quick actions | FE-03 | HIGH | Reduces navigation friction |
| 6 | Empty states for all list views | FE-02 | HIGH | Guides new users |
| 7 | Breadcrumb on block detail | FE-02 | HIGH | Navigation context |
| 8 | Toast notifications for actions | FE-01 | HIGH | User feedback on mutations |
| 9 | Nav active Library sub-page label | FE-01 | MED | Visual clarity |
| 10 | Canvas node type colors | FE-02 | MED | Visual differentiation |
| 11 | Workflow status badges | FE-02 | MED | Quick status scanning |
| 12 | Breadcrumb component (all pages) | FE-01 | MED | Full navigation context |
| 13 | Error boundary component | FE-02 | MED | Graceful error handling |
| 14 | Responsive fixes (375px tap targets, 1920px max-width) | FE-01 | MED | Edge case polish |
| 15 | Block type breakdown on dashboard | FE-03 | MED | Richer dashboard data |

---

## Task Assignment Summary

**FE-01 (Navigation + Layout):** Items 1, 2, 8, 9, 12, 14
**FE-02 (Blocks + Workflows):** Items 6, 7, 10, 11, 13
**FE-03 (Dashboard Overhaul):** Items 3, 4, 5, 15
