# Frontend Standards — Reference

> **Reading guide:** At session start, skim section headers only — do not read in full.
> Full file: load only when actively implementing a task that requires these standards.
> Auto-load: `/focus-context [task-id]` reads this file when your task's role or gate requires it.
> Skipping at session start saves significant context tokens.

Stack placeholders: `[FRONTEND_FRAMEWORK]`, `[CSS_APPROACH]`, `[STATE_LIBRARY]`
Confirmed stack recorded in `prd/03-system-architecture.md` after researcher recommendation.

---

## Component Architecture

### When to Split a Component
Split a component when ANY of these are true:
- The component exceeds 200 lines
- The same JSX structure appears in 2+ places
- The component handles 2+ unrelated responsibilities
- A sub-section has its own distinct state

### Component Structure Template
```typescript
// 1. Imports — external, then internal, then styles
// 2. Types — props interface and any local types
// 3. Constants — component-level constants
// 4. Component function — single export default
// 5. Helper functions — small functions used only by this component

interface UserCardProps {
  userId: string
  onSelect: (id: string) => void
  isDisabled?: boolean
}

export default function UserCard({ userId, onSelect, isDisabled = false }: UserCardProps) {
  // ...
}
```

### Props Rules
- All props must have a TypeScript interface — no untyped props
- Optional props must have a default value in destructuring
- Callback props: `onAction` naming convention, not `handleAction`
- No prop spreading (`...props`) unless wrapping a native element intentionally
- No more than 7 props — if you need more, group related ones into an object prop

---

## State Management

### When to Use Local State
Use `useState` for:
- UI-only state: modal open/closed, tab selection, hover
- Form state that doesn't need to persist beyond the component
- Loading/error state for a single request in a single component

### When to Use Global State
Introduce context or a state library when:
- 3+ components in different parts of the tree need the same data
- Data needs to persist across page navigations
- Data is shared between tabs or windows

### Anti-Patterns
- No prop drilling beyond 2 levels — introduce context or restructure
- No storing derived data in state — compute it from source during render
- No `useEffect` for data that can be computed synchronously
- `useEffect` dependency arrays must be complete — no suppressed exhaustive-deps warnings

---

## Responsive Breakpoints — All 4 Required

```css
/* Mobile first */
/* Base styles: 375px and up */

/* Tablet */
@media (min-width: 768px) { ... }

/* Desktop */
@media (min-width: 1280px) { ... }

/* Large desktop */
@media (min-width: 1920px) { ... }
```

Every component must be tested at all 4 breakpoints before Gate 4 passes.
Missing a breakpoint = Gate 4 failure.

---

## Accessibility — WCAG AA Baseline

### Semantic HTML
```html
<!-- BAD: div soup -->
<div class="nav"><div class="nav-item" onclick="...">Home</div></div>

<!-- GOOD: semantic HTML -->
<nav><a href="/">Home</a></nav>
```

Required semantic elements: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`, `<button>`, `<a>` (for navigation)

### Keyboard Navigation
- All interactive elements reachable by `Tab` key
- Focus states visible — never `outline: none` without a custom replacement
- Modal dialogs: trap focus inside while open, return focus to trigger on close
- Skip link for main content on pages with navigation

### ARIA
- Icon-only buttons: `<button aria-label="Close dialog"><CloseIcon /></button>`
- Images: `alt="Description"` for informational images, `alt=""` for decorative
- Status updates: `role="status"` or `role="alert"` for dynamic content
- Loading spinners: `aria-label="Loading..."` + `role="status"`

### Colour Contrast
- Normal text (< 18pt): minimum 4.5:1 ratio
- Large text (≥ 18pt or bold ≥ 14pt): minimum 3:1 ratio
- Interactive element boundaries: minimum 3:1 against adjacent colours

---

## Performance Budgets

| Metric | Target |
|--------|--------|
| Initial JS bundle (gzipped) | < 150KB |
| LCP (Largest Contentful Paint) | < 2.5s on 4G |
| CLS (Cumulative Layout Shift) | < 0.1 |
| FID (First Input Delay) | < 100ms |

To prevent layout shift:
- Set explicit `width` and `height` on all `<img>` elements
- Reserve space for async-loaded content (skeleton loaders)
- Avoid inserting content above existing content without user interaction

---

## Required UI States

Every component that fetches or mutates data must implement all three:

**Loading state**
```tsx
if (isLoading) return <UserCardSkeleton />
```

**Empty state**
```tsx
if (users.length === 0) return <EmptyState message="No users yet" action={<AddUserButton />} />
```

**Error state**
```tsx
if (error) return <ErrorState message="Failed to load users" onRetry={refetch} />
```

Shipping a component without all three = Gate 4 failure.

---

## Storybook Requirement

Any component used in 2 or more places must have a Storybook story.

Story must include these variations as separate stories:
- `Default` — standard usage
- `Loading` — loading state
- `Empty` — empty state
- `Error` — error state
- `AllVariants` — all key prop combinations in one view

---

## CSS and Styling

Confirmed approach in `prd/03-system-architecture.md`. Common options:

| Approach | When to use |
|----------|-------------|
| Utility classes (e.g. Tailwind) | New projects, speed of development priority |
| CSS Modules | Need scoping, colocated with component |
| CSS-in-JS | Dynamic styles based on props, complex theming |

**Universal rules regardless of approach:**
- No inline styles for layout — use your CSS approach's mechanism
- No `!important` — fix the specificity
- No magic numbers for spacing/colours — use design tokens or the framework's scale
- Mobile-first breakpoints — base styles for mobile, add complexity for larger screens

---

## Forbidden Patterns

| Pattern | Problem | Alternative |
|---------|---------|-------------|
| `any` TypeScript type | Defeats type safety | Use `unknown` and narrow it |
| `document.querySelector()` | Bypasses React's model | Use `useRef` |
| `style={{ display: 'flex' }}` inline for layout | Not maintainable | Use CSS classes |
| `!important` in CSS | Specificity hacks | Fix selector specificity |
| `// eslint-disable` | Hides real problems | Fix the underlying issue |
| Props drilling 3+ levels | Creates coupling | Use context or lift state |
| Unaccessioned `useEffect` | Silent bugs | Always complete dependency arrays |
