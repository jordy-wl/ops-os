# Sprint 10 Tasks — UX Research, Polish, Demo Data & Manual Test Readiness

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations
**Sprint:** 10
**Sprint Goal:** UX research to inform targeted polish, UI improvements across all pages, seed demo data, E2E test, manual test plan. Last sprint before Phase 2 exit evaluation.
**Target Duration:** ~2 weeks
**Carried Over:** P2-S7-UI-01 (UX Research — deferred from Sprint 7)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S10-UI-01 | UX Research + Design Spec | Design Lead | HIGH | — | OPEN |
| P2-S10-FE-01 | UI polish — navigation + layout | Frontend | MED | UI-01 | OPEN |
| P2-S10-FE-02 | UI polish — blocks + workflows | Frontend | MED | UI-01 | OPEN |
| P2-S10-FE-03 | Dashboard overhaul | Frontend | MED | UI-01 | OPEN |
| P2-S10-BE-01 | Seed demo data script | Backend | MED | S7-S9 | OPEN |
| P2-S10-QA-01 | E2E workflow test | QA | HIGH | BE-01 | OPEN |
| P2-S10-QA-02 | Manual test checklist | QA | LOW | — | OPEN |
| P2-S10-ORC-01 | Update coordination files | Orchestrator | LOW | All | OPEN |

**Total:** 8 tasks (1 UI, 3 FE, 1 BE, 2 QA, 1 ORC)
**Critical path:** UI-01 → FE-01/02/03 (polish) | BE-01 → QA-01 → ORC-01

---

## Task Details

### P2-S10-UI-01 — UX Research + Design Spec (HIGH)

**What:** Research best-in-class workflow builders and BOS tools. Audit our current UI. Produce a design spec with concrete improvement recommendations that guide the FE polish tasks.

**Files:**
- `.claude/research/findings/ux-research-sprint-10.md` — research notes
- `.claude/sprints/phase-2/sprint-10/design-spec.md` — actionable design spec

**Details:**

**Research phase (competitive analysis):**
- **Workflow builders:** n8n, Make/Integromat, Zapier — canvas UX, node configuration, execution feedback
- **BOS / work management:** Monday.com, Notion, ClickUp — dashboard layouts, "My Work" hub patterns, navigation
- **Integration libraries:** Zapier app directory, Make integrations — capability-focused UI patterns
- **Document generation:** PandaDoc, Proposify — template editors, brand kit management, generation flows

**Audit phase (our current pages):**
- Review each page: Dashboard, My Work, Workflows, Canvas Builder, Block Detail, Block Library, Integration Library, Document Library, Brand Kit, Chat
- Identify: layout inconsistencies, missing states (loading/empty/error), navigation friction, visual hierarchy issues
- Score each page against Nielsen's 10 usability heuristics

**Output — Design Spec must include:**
1. **Navigation improvements** — specific changes to nav structure, breadcrumbs, page transitions
2. **Page-by-page layout recommendations** — ASCII wireframes for Dashboard, My Work, Block Detail at minimum
3. **Component patterns to standardise** — page headers, card layouts, list/grid views, empty states, loading skeletons
4. **Responsive breakpoint fixes** — specific issues found at 375/768/1280/1920px
5. **Interaction improvements** — hover states, transitions, feedback patterns
6. **Priority ranking** — which improvements have the highest user impact for the FE tasks

**Gates:** G4, G5

---

### P2-S10-FE-01 — UI Polish: Navigation + Layout (MED)

**What:** Implement navigation and layout improvements from the design spec.

**Deps:** UI-01 (design spec guides what to change)

**Files:**
- All layout components in `src/components/shell/`
- Page wrappers in `src/app/(app)/*/page.tsx`

**Details:**
- Implement design spec recommendations for navigation
- Add loading skeletons for all server-fetched pages
- Standardise page header pattern (title + subtitle + actions)
- Verify Library dropdown works at all breakpoints
- Fix layout inconsistencies identified in audit

**Gates:** G1, G4, G5

---

### P2-S10-FE-02 — UI Polish: Blocks + Workflows (MED)

**What:** Polish block list, block detail, workflow list, canvas per design spec.

**Deps:** UI-01

**Files:**
- `src/app/(app)/blocks/[id]/page.tsx`
- `src/components/workflows/`
- `src/components/canvas/`

**Details:**
- Implement design spec improvements for blocks and workflow pages
- Add proper empty states for blocks, workflows, events lists
- Add error boundary components
- Loading states for action menu, block detail data
- Canvas polish: node styling, connection handles, zoom controls per spec

**Gates:** G1, G4, G5

---

### P2-S10-FE-03 — Dashboard Overhaul (MED)

**What:** Redesign dashboard with real metrics and quick actions per design spec.

**Deps:** UI-01

**Files:**
- `src/app/(app)/dashboard/page.tsx`

**Details:**
- Implement dashboard layout from design spec
- Block count by type (card grid)
- Active workflows count
- Pending tasks count
- Recent events feed (last 10)
- Quick actions: Create Block, New Workflow, View Library

**Gates:** G1, G4, G5

---

### P2-S10-BE-01 — Seed Demo Data Script (MED)

**What:** Create realistic demo scenario with workflow templates, document templates, brand kit, sample blocks.

**Files:**
- `scripts/seed-demo.ts`

**Details:**
- Create 3 document templates (contract, proposal, report) with variable placeholders
- Create 1 brand kit with realistic brand identity
- Create 2 workflow templates (one with email + document steps)
- Create 5+ blocks with realistic metadata
- Create sample events and edges

**Gates:** G1, G2, G5

---

### P2-S10-QA-01 — E2E Workflow Test (HIGH)

**What:** Full workflow test: create template on canvas → create block → trigger workflow → send email → generate document.

**Files:**
- `tests/integration/e2e-workflow.test.ts`

**Details:**
- Create workflow template with email + document generation steps
- Create source block
- Trigger workflow instance
- Verify email step executes (mocked Gmail)
- Verify document generation step executes (mocked Claude)
- Verify all events recorded

**Gates:** G1, G2, G3, G5, G6

---

### P2-S10-QA-02 — Manual Test Checklist (LOW)

**What:** Step-by-step testing guide for the user to manually verify all features.

**Files:**
- `.claude/sprints/phase-2/manual-test-plan.md`

**Details:**
- Google OAuth connection
- Send test email from action menu
- Book test meeting
- Create document template in Document Library
- Set up brand kit
- Generate document (template + AI)
- Create workflow on canvas with email + document steps
- Run workflow end-to-end

**Gates:** G1

---

### P2-S10-ORC-01 — Update Coordination Files (LOW)

**What:** Update phases.md, shared-state.md, ROADMAP.md with final Phase 2 status.

**Files:**
- `.claude/sprints/phases.md`
- `.claude/sprints/shared-state.md`
- `.claude/roadmap/ROADMAP.md`

**Details:**
- Phase 2 exit condition final evaluation
- Sprint 10 retro
- Phase 3 planning recommendations

**Gates:** G7

---

## Dependencies

```
UI-01 (UX Research + Design Spec) ──────┐
  ├── FE-01 (nav + layout polish)       │
  ├── FE-02 (blocks + workflows polish) │  ← research-informed polish
  └── FE-03 (dashboard overhaul)        │

BE-01 (seed demo data) ─── independent, can run parallel with UI-01
  └── QA-01 (E2E test) ─── needs demo data patterns

QA-02 (manual test plan) ─── independent

ORC-01 ─── after all other tasks
```
