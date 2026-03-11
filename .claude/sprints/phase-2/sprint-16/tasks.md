# Sprint 16 Tasks — Polish + Regression + Production

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 16 (FINAL)
**Sprint Goal:** Visual polish pass, dark mode verification, dead code cleanup, full regression suite, performance audit. Phase 2 exit.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 15 (Integration + AI Entity Creation) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S16-FE-01 | Visual polish pass | Frontend | MED | — | OPEN |
| P2-S16-FE-02 | Dark mode verification | Frontend | LOW | — | OPEN |
| P2-S16-FE-03 | Dead code cleanup | Frontend | LOW | — | OPEN |
| P2-S16-QA-01 | Full regression suite | QA | HIGH | FE-01, FE-02, FE-03 | OPEN |
| P2-S16-OPS-01 | Performance audit | DevOps | MED | — | OPEN |

**Total:** 5 tasks (3 FE, 1 QA, 1 OPS)
**Critical path:** FE-01 + FE-02 + FE-03 → QA-01

---

## Task Details

### P2-S16-FE-01 — Visual Polish Pass (MED)

**What:** Final visual consistency pass across all pages. Consistent spacing, typography, hover states, focus rings, animations.

**Key areas:**
- Sidebar nav: hover/active states consistent
- All pages: heading sizes, padding, margins uniform
- Cards/lists: consistent border, shadow, hover treatment
- Buttons: consistent sizing, disabled states
- Form inputs: consistent focus rings
- Animations: fade-in on page load, slide transitions where appropriate

**Gates:** G1, G4

---

### P2-S16-FE-02 — Dark Mode Verification (LOW)

**What:** Verify all new components (Sprint 11-15) respect dark mode CSS variables. Add dark mode toggle to sidebar if not present.

**Key checks:**
- Chat widget: background, text, borders in dark mode
- Onboarding wizard: all step states readable in dark mode
- Block creation preview: green/amber/red states visible in dark mode
- @mention dropdown: readable in dark mode
- Field renderer components: all 12 field types

**Gates:** G1, G4

---

### P2-S16-FE-03 — Dead Code Cleanup (LOW)

**What:** Remove unused files and exports left from Phase 2 refactoring.

**Candidates:**
- Old `app-nav.tsx` (if still exists — replaced by sidebar in Sprint 11)
- Unused shadcn components (audit `src/components/ui/` for imports)
- Any orphaned onboarding references (removed in Sprint 13)
- Verify no unused imports across `src/`

**Gates:** G1, G5

---

### P2-S16-QA-01 — Full Regression Suite (HIGH)

**What:** All 550+ tests pass. Add E2E scenario: login → nav → create block → add field → create workflow → update_block → chat.

**Test targets:**
- All existing tests pass (550+)
- New integration test: workflow creates block via update_block step → verify metadata changed
- Chat widget E2E: open widget → send message → verify response renders
- Build succeeds with zero warnings

**Gates:** G1, G2, G5, G6

---

### P2-S16-OPS-01 — Performance Audit (MED)

**What:** Measure and document bundle size, Vercel function sizes, layout shift, chat widget load impact.

**Deliverables:**
- Bundle size report (next build output)
- Identify any page with First Load JS > 200kB
- Chat widget lazy-load verification (not in initial bundle if not opened)
- Field component code-splitting check

**Gates:** G1, G5
