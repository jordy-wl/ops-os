# Sprint 6 Tasks — Document Generation V2 + Block Config UI

**Phase:** 3 — Platform Evolution
**Sprint:** 6
**Sprint Goal:** Reference template storage with AI structure extraction, context-aware document generation, template library page, document preview component, document storage with versioning. PLUS field group UI in field manager + block detail, and AI-assisted block creation modal.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 5 complete (field group schema, AI suggestion engine, chat tools)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S6-BE-01 | Reference template storage | Backend | HIGH | -- | OPEN |
| P3-S6-AI-01 | Context-aware document generation | AI/ML | HIGH | BE-01 | OPEN |
| P3-S6-FE-01 | Template library page | Frontend | MEDIUM | BE-01 | OPEN |
| P3-S6-FE-02 | Document preview component | Frontend | HIGH | AI-01, BE-02 | OPEN |
| P3-S6-BE-02 | Document storage & versioning | Backend | MEDIUM | -- | OPEN |
| P3-S6-FE-03 | Field group UI in field manager + block detail | Frontend | HIGH | S5-BE-02 (done) | OPEN |
| P3-S6-FE-04 | AI-assisted block creation modal | Frontend | HIGH | S5-BE-03 (done), S5-AI-01 (done) | OPEN |
| P3-S6-QA-01 | Document generation + block config UI tests | QA | MEDIUM | ALL | OPEN |

**Total:** 8 tasks (2 BE, 1 AI, 4 FE, 1 QA)
**Critical path A (doc gen):** BE-01 → AI-01 → FE-02 → QA-01
**Critical path B (block config UI):** FE-03 + FE-04 can start immediately (Sprint 5 deps done) → QA-01

---

## Parallelization

Four tasks can start immediately in parallel:
1. BE-01 (Reference template storage) -- no intra-sprint deps
2. BE-02 (Document storage & versioning) -- no intra-sprint deps
3. FE-03 (Field group UI) -- Sprint 5 BE-02 complete
4. FE-04 (AI-assisted block creation) -- Sprint 5 BE-03 + AI-01 complete

Then:
5. AI-01 (Context-aware generation) -- after BE-01
6. FE-01 (Template library page) -- after BE-01
7. FE-02 (Document preview) -- after AI-01 + BE-02
8. QA-01 (Tests) -- after all tasks complete

---

## Critical Files

### Document Generation Tasks
- `src/lib/actions/handlers/document-generate.ts` -- existing document generation handler
- `src/lib/documents/renderer.ts` -- existing document renderer
- `src/app/(app)/library/` -- library pages
- Supabase Storage -- document and template file storage

### Block Config UI Tasks
- `src/components/settings/field-manager.tsx` -- field management UI (add group management)
- `src/components/settings/field-config-panel.tsx` -- per-field config (add group dropdown)
- `src/components/blocks/dynamic-field-renderer.tsx` -- block detail rendering (add grouped sections)
- `src/components/blocks/block-create-dialog.tsx` or equivalent -- AI-assisted creation flow
- `src/lib/ai/field-suggestion.ts` -- AI suggestion engine (Sprint 5, reuse)
- `src/lib/ai/chat-tools.ts` -- suggest_fields tool (Sprint 5, reuse)
