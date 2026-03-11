# Sprint 16 — Frontend Tasks

## P2-S16-FE-01 — Visual Polish Pass (MED)

**Priority:** 1 (independent, start immediately)
**Deps:** None
**Gates:** G1, G4

### What to Build
Final visual consistency pass across all pages built in Sprints 11-15.

### Key Areas
- All pages: consistent heading sizes (text-2xl font-semibold for h1), padding (p-6 lg:p-8), margins
- Cards/lists: consistent border-gray-200, hover:border-gray-400, hover:shadow-sm
- Buttons: consistent h-9 px-4, disabled:opacity-50
- Focus rings: all interactive elements have focus-visible:ring-2 focus-visible:ring-gray-900
- Animations: animate-fade-in on page mount where appropriate

### Acceptance Criteria
- [ ] Visual consistency verified across all 15+ pages
- [ ] No orphaned styles or inconsistent spacing
- [ ] All hover/focus states present on interactive elements
- [ ] Lint clean

---

## P2-S16-FE-02 — Dark Mode Verification (LOW)

**Priority:** 1 (independent)
**Deps:** None
**Gates:** G1, G4

### What to Build
Verify all Sprint 11-15 components work in dark mode.

### Key Files
- `src/components/chat/chat-widget.tsx`, `chat-input.tsx`, `block-creation-preview.tsx`
- `src/components/integrations/onboarding-wizard.tsx`, `connection-test.tsx`
- All field renderer components in `src/components/blocks/fields/`
- Sidebar: verify dark mode toggle exists

### Acceptance Criteria
- [ ] All new components readable in dark mode
- [ ] Green/amber/red status colors visible against dark backgrounds
- [ ] Form inputs have appropriate dark mode backgrounds
- [ ] Dark mode toggle accessible from sidebar

---

## P2-S16-FE-03 — Dead Code Cleanup (LOW)

**Priority:** 1 (independent)
**Deps:** None
**Gates:** G1, G5

### What to Build
Remove unused files and imports.

### Key Targets
- Audit `src/components/ui/` — remove unused shadcn components
- Remove `app-nav.tsx` if it still exists
- Run `npx next lint` and fix any unused import warnings
- Verify no unused onboarding references

### Acceptance Criteria
- [ ] No unused files remain
- [ ] Lint clean with no unused import warnings
- [ ] Build clean
