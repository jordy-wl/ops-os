# Sprint 5 Tasks — Workflow Canvas Enhancements

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 5
**Sprint Goal:** Input/Output node types, reorganized node palette with categories, step instructions panel, and data flow visualization on the workflow canvas.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 4 complete (routing config in node panel)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S5-FE-01 | Input/Output node types | Frontend | HIGH | -- | OPEN |
| P3-S5-FE-02 | Reorganized node palette | Frontend | MEDIUM | -- | OPEN |
| P3-S5-BE-01 | Canvas data flow serialization | Backend | MEDIUM | FE-01 | OPEN |
| P3-S5-FE-03 | Step instructions panel | Frontend | MEDIUM | -- | OPEN |
| P3-S5-FE-04 | Data flow visualization | Frontend | HIGH | FE-01 | OPEN |
| P3-S5-QA-01 | Canvas enhancement tests | QA | MEDIUM | FE-01, FE-02, BE-01, FE-03, FE-04 | OPEN |

**Total:** 6 tasks (1 BE, 4 FE, 1 QA)
**Critical path:** FE-01 (Input/Output nodes) --> BE-01 (serialization) + FE-04 (data flow viz) --> QA-01

---

## Parallelization

Three tasks can start immediately in parallel:
1. FE-01 (Input/Output node types) -- no intra-sprint deps
2. FE-02 (Reorganized node palette) -- no deps
3. FE-03 (Step instructions panel) -- no deps

Then:
4. BE-01 (Canvas data flow serialization) -- after FE-01
5. FE-04 (Data flow visualization) -- after FE-01
6. QA-01 (Canvas enhancement tests) -- after all tasks complete

---

## Critical Files

- `src/components/canvas/` -- all canvas node components
- `src/lib/workflow/canvas-layout.ts` -- serialization logic
- `src/lib/workflow/template-schema.ts` -- template type definitions
- `src/components/canvas/node-palette.tsx` -- node palette (if exists)
- `src/components/canvas/config-panel.tsx` -- config panel (if exists)
