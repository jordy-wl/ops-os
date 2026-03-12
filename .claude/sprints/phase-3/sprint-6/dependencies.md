# Sprint 6 Dependencies

## Dependency Graph

```
BE-01 (template storage) ------ independent --------+
BE-02 (doc storage/versioning) - independent --------+
                                                     |
AI-01 (context-aware gen) ----- depends on BE-01 ---+
FE-01 (template library) ------ depends on BE-01 ---+
                                                     |
FE-02 (doc preview) ----------- depends on AI-01 + BE-02
                                                     |
QA-01 (tests) ----------------- depends on ALL ------+
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Document generation handler | DONE | `document-generate.ts` from Sprint 9 (Phase 2) |
| Document renderer | DONE | `renderer.ts` from Sprint 9 (Phase 2) |
| Brand kit system | DONE | Sprint 9 (Phase 2) |
| Supabase Storage | DONE | Configured in Sprint 8 (Phase 2) for Google Drive |
| Block edges (graph traversal) | DONE | Sprint 1 (Phase 1) |
| Embeddings / events | DONE | Sprint 1 (Phase 1) |
| Library page structure | DONE | Sprint 8 (Phase 2) |

## Inter-Sprint Dependencies

| Sprint | Dependency | Impact |
|--------|-----------|--------|
| Sprint 5 | None | Sprint 6 is fully independent of Sprint 5 |

## Parallelization

Two tasks can start immediately in parallel:
1. BE-01 (Reference template storage) -- no deps
2. BE-02 (Document storage & versioning) -- no deps

Then:
3. AI-01 (Context-aware generation) -- after BE-01
4. FE-01 (Template library page) -- after BE-01
5. FE-02 (Document preview component) -- after AI-01 + BE-02
6. QA-01 (Document generation tests) -- after all tasks complete
