# Sprint 12 Dependencies

## Internal Dependencies (within sprint)

```
BE-01 (field types + schema builder)
  ├── BE-02 (field management API) — needs field type definitions for validation
  ├── FE-01 (dynamic field renderer V2) — needs field type metadata for rendering
  └── QA-01 (field tests) — needs both BE-01 and FE-01 for integration tests

BE-02 (field management API)
  ├── FE-02 (field config UI) — needs API endpoints for field CRUD
  └── QA-01 (field tests) — needs API for endpoint tests

FE-01 (dynamic field renderer V2)
  └── FE-03 (block detail enhancement) — needs V2 renderer
```

## External Dependencies (from other sprints)

| Dependency | Sprint | Status | Impact |
|-----------|--------|--------|--------|
| Sidebar layout | Sprint 11 (FE-03) | DONE | Settings pages need sidebar-aware layout |
| PageContainer component | Sprint 11 (FE-06) | DONE | New settings pages use PageContainer |
| Block type CRUD API | Sprint 5 (BE) | DONE | Existing endpoints extended, not replaced |
| JSON Schema validation | Sprint 5 (BE) | DONE | AJV validator reused with `strict: false` |
| DynamicFieldRenderer V1 | Sprint 5 (FE) | DONE | Rewritten, not patched |
| Block detail page | Sprint 5 (FE) | DONE | Enhanced, not replaced |

## Critical Path

**Longest chain:** BE-01 → BE-02 → FE-02 (3 sequential tasks)
**Parallel work:** FE-01 can start once BE-01 is DONE (parallel with BE-02)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AJV `strict: false` breaks existing schema validation | Medium | High | Test existing schemas pass with new AJV config |
| Relation fields create circular dependencies | Low | Medium | Prevent self-referencing at API level, 1-hop limit |
| Drag-to-reorder requires new dependency (dnd-kit or similar) | Medium | Low | Use native HTML5 drag-and-drop, or a lightweight lib |
| Field schema migration for existing blocks when type changes | Medium | High | Don't migrate — new fields get default values, removed fields are preserved in metadata |
