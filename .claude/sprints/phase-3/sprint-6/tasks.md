# Sprint 6 Tasks — Document Generation V2

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 6
**Sprint Goal:** Reference template storage with AI structure extraction, context-aware document generation, template library page, document preview component, and document storage with versioning.
**Target Duration:** ~2 weeks
**Depends On:** Independent of Sprint 5 (can run in parallel if capacity allows)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S6-BE-01 | Reference template storage | Backend | HIGH | -- | OPEN |
| P3-S6-AI-01 | Context-aware document generation | AI/ML | HIGH | BE-01 | OPEN |
| P3-S6-FE-01 | Template library page | Frontend | MEDIUM | BE-01 | OPEN |
| P3-S6-FE-02 | Document preview component | Frontend | HIGH | AI-01, BE-02 | OPEN |
| P3-S6-BE-02 | Document storage & versioning | Backend | MEDIUM | -- | OPEN |
| P3-S6-QA-01 | Document generation tests | QA | MEDIUM | BE-01, AI-01, FE-01, FE-02, BE-02 | OPEN |

**Total:** 6 tasks (2 BE, 1 AI, 2 FE, 1 QA)
**Critical path:** BE-01 (template storage) --> AI-01 (context-aware gen) --> FE-02 (preview) --> QA-01

---

## Parallelization

Two tasks can start immediately in parallel:
1. BE-01 (Reference template storage) -- no intra-sprint deps
2. BE-02 (Document storage & versioning) -- no intra-sprint deps

Then:
3. AI-01 (Context-aware generation) -- after BE-01 (needs template structure)
4. FE-01 (Template library page) -- after BE-01 (needs API for templates)
5. FE-02 (Document preview) -- after AI-01 + BE-02 (needs generated docs + versioning)
6. QA-01 (Tests) -- after all tasks complete

---

## Critical Files

- `src/lib/actions/handlers/document-generate.ts` -- existing document generation handler
- `src/lib/documents/renderer.ts` -- existing document renderer (if exists)
- `src/app/(app)/library/` -- library pages
- Supabase Storage -- document and template file storage
