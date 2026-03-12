# Sprint 1 Tasks — Bug Fixes & Quick Wins

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 1
**Sprint Goal:** Fix workflow creation 400 error, reposition chat widget, add theme toggle, fix responsive issues. Clean sprint to stabilize before new feature work.
**Target Duration:** ~1 week
**Depends On:** Phase 2 CODE COMPLETE (Sprint 16)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S1-BE-01 | Fix workflow creation 400 error | Backend | LOW | -- | DONE |
| P3-S1-FE-01 | Move chat widget to bottom-right | Frontend | LOW | -- | DONE |
| P3-S1-FE-02 | Add dark/light mode toggle | Frontend | LOW | -- | DONE |
| P3-S1-FE-03 | Fix UI responsiveness issues | Frontend | MEDIUM | -- | DONE |
| P3-S1-QA-01 | Regression test Sprint 1 fixes | QA | MEDIUM | BE-01, FE-01, FE-02, FE-03 | DONE |
| P3-S1-ORC-01 | Phase 3 coordination setup | Orchestrator | LOW | -- | DONE |

**Total:** 6 tasks (1 BE, 3 FE, 1 QA, 1 ORC)
**Critical path:** All BE/FE tasks independent and parallel --> QA-01 regression after all complete

---

## Sprint Notes

- All engineering tasks are independent and can start in parallel
- QA-01 is the only gated task -- waits for all fixes to land before regression
- ORC-01 is pre-completed as part of Phase 3 scaffold
- This sprint is intentionally lightweight to build confidence before the schema-heavy Sprint 2
