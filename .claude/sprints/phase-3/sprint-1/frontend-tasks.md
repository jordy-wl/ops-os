# Sprint 1 — Frontend Tasks

## P3-S1-FE-01 — Move Chat Widget to Bottom-Right

**Complexity:** LOW
**Priority:** 1 (start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G4
**Assigned Role:** Frontend Engineer
**Estimate:** 0.5 days

### Description

The chat widget is currently positioned in the bottom-left corner, which conflicts with the sidebar navigation. Move it to the bottom-right corner for better UX.

### What to Change

In `src/components/chat/chat-widget.tsx`:
- **Line ~183 (collapsed state):** Change `left-5` to `right-5`
- **Line ~200 (expanded state):** Change `left-5` to `right-5`

### Files to Modify

- `src/components/chat/chat-widget.tsx`

### Acceptance Criteria

- [ ] Chat widget renders in bottom-right corner when collapsed
- [ ] Chat widget renders in bottom-right corner when expanded
- [ ] Widget does not overlap with sidebar navigation at any breakpoint
- [ ] Slide-up animation still works correctly from the new position
- [ ] Tested at 375px, 768px, 1280px, 1920px

---

## P3-S1-FE-02 — Add Dark/Light Mode Toggle

**Complexity:** LOW
**Priority:** 1 (start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G4
**Assigned Role:** Frontend Engineer
**Estimate:** 1 day

### Description

Create a visible theme toggle component so users can switch between dark and light mode. Currently dark mode is driven by CSS variables but there is no accessible user-facing toggle.

### What to Build

1. **New component `src/components/ui/theme-toggle.tsx`:**
   - Sun icon for light mode, Moon icon for dark mode (use Lucide icons)
   - Toggles `.dark` class on `<html>` element
   - Persists preference to `localStorage` under key `theme`
   - Reads system preference (`prefers-color-scheme`) as default when no localStorage value
2. **Place in app header:** Top-right of the main layout, accessible from every page

### Files to Create

- `src/components/ui/theme-toggle.tsx`

### Files to Modify

- `src/app/layout.tsx` or equivalent header component -- add ThemeToggle

### Acceptance Criteria

- [ ] ThemeToggle component renders Sun/Moon icon based on current theme
- [ ] Clicking toggles between dark and light mode instantly
- [ ] Preference persists across page reloads via localStorage
- [ ] System preference (`prefers-color-scheme: dark`) used as default for first-time visitors
- [ ] No flash of wrong theme on page load (script in `<head>` or equivalent strategy)

---

## P3-S1-FE-03 — Fix UI Responsiveness Issues

**Complexity:** MEDIUM
**Priority:** 1 (start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G4
**Assigned Role:** Frontend Engineer
**Estimate:** 2 days

### Description

Audit all pages at the four standard breakpoints (375px, 768px, 1280px, 1920px) and fix all responsiveness issues including overlapping components, card overflows, and text truncation.

### What to Do

1. **Audit pass:** Open every page at each breakpoint, screenshot or note every issue
2. **Fix categories:**
   - Overlapping components (especially sidebar + content on mobile)
   - Card content overflow (long text, missing truncation/wrapping)
   - Text truncation without tooltips or ellipsis
   - Touch targets too small on mobile (<44px)
   - Tables not scrollable horizontally on narrow viewports
3. **Common patterns to apply:**
   - `overflow-x-auto` on data tables
   - `truncate` with `title` attribute on long text
   - `min-w-0` on flex children to prevent overflow
   - Responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

### Files to Modify

- All page files under `src/app/` that show layout issues
- Component files under `src/components/` as needed

### Acceptance Criteria

- [ ] All pages render correctly at 375px (mobile) with no horizontal overflow
- [ ] All pages render correctly at 768px (tablet) with proper column stacking
- [ ] All pages render correctly at 1280px (desktop) with full layouts
- [ ] All pages render correctly at 1920px (wide) without excessive whitespace
- [ ] No overlapping components at any breakpoint
- [ ] Long text content truncates gracefully with tooltips or wrapping
