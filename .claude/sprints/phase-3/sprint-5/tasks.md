# Sprint 5 Tasks — Workflow Canvas Enhancements + Block Config Foundation

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 5
**Sprint Goal:** Input/Output node types, reorganized node palette with categories, step instructions panel, data flow visualization on the workflow canvas. PLUS field group schema extension, AI field suggestion engine, and block configuration chat tools.
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
| P3-S5-BE-02 | Field group schema extension + API | Backend | MEDIUM | -- | OPEN |
| P3-S5-AI-01 | AI field suggestion engine | AI/ML | HIGH | BE-02 | OPEN |
| P3-S5-BE-03 | Block configuration chat tools | Backend | MEDIUM | AI-01 | OPEN |
| P3-S5-QA-01 | Canvas + block config tests | QA | HIGH | ALL | OPEN |

**Total:** 9 tasks (3 BE, 4 FE, 1 AI, 1 QA)
**Critical path A (canvas):** FE-01 → BE-01 + FE-04 → QA-01
**Critical path B (block config):** BE-02 → AI-01 → BE-03 → QA-01

---

## Parallelization

Four tasks can start immediately in parallel:
1. FE-01 (Input/Output node types) -- no intra-sprint deps
2. FE-02 (Reorganized node palette) -- no deps
3. FE-03 (Step instructions panel) -- no deps
4. BE-02 (Field group schema extension) -- no deps

Then:
5. BE-01 (Canvas data flow serialization) -- after FE-01
6. FE-04 (Data flow visualization) -- after FE-01
7. AI-01 (AI field suggestion engine) -- after BE-02
8. BE-03 (Block configuration chat tools) -- after AI-01
9. QA-01 (Canvas + block config tests) -- after all tasks complete

---

## Critical Files

### Canvas Tasks
- `src/components/canvas/` -- all canvas node components
- `src/lib/workflow/canvas-layout.ts` -- serialization logic
- `src/lib/workflow/template-schema.ts` -- template type definitions
- `src/components/canvas/panels/node-config-panel.tsx` -- config panel

### Block Config Tasks
- `src/lib/block-types/field-types.ts` -- field type definitions (add group support)
- `src/app/api/block-types/[id]/route.ts` -- PATCH endpoint (add group management)
- `src/lib/block-types/system-types.ts` -- system type definitions (add default groups)
- New: `src/lib/ai/field-suggestion.ts` -- AI field suggestion engine
- New: `src/prompts/field-suggestion.v1.md` -- versioned prompt
- `src/lib/chat/chat-tools.ts` -- chat tools (4 new tools)
