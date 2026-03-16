# Sprint 5 Dependencies

## Dependency Graph

```
FE-01 (Input/Output nodes) ---- independent --------+
FE-02 (node palette) ---------- independent --------+
FE-03 (instructions panel) ---- independent --------+
                                                     |
BE-01 (serialization) --------- depends on FE-01 ---+
FE-04 (data flow viz) --------- depends on FE-01 ---+
                                                     |
QA-01 (tests) ----------------- depends on ALL ------+
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 4 complete | REQUIRED | Routing config in node panel must exist first |
| React Flow canvas infrastructure | DONE | `src/components/canvas/` from Sprint 7 (Phase 2) |
| Canvas serialization layer | DONE | `canvas-layout.ts` from Sprint 7 (Phase 2) |
| Template schema | DONE | `template-schema.ts` from Sprint 5 (Phase 2) |
| Node palette component | DONE | Sprint 7 (Phase 2) |
| Config panel component | DONE | Sprint 7 (Phase 2) |

## Parallelization

Three tasks can start immediately in parallel:
1. FE-01 (Input/Output node types) -- no intra-sprint deps
2. FE-02 (Reorganized node palette) -- no intra-sprint deps
3. FE-03 (Step instructions panel) -- no intra-sprint deps

Then:
4. BE-01 (Canvas data flow serialization) -- after FE-01 defines node shapes
5. FE-04 (Data flow visualization) -- after FE-01 provides node handles
6. QA-01 (Canvas enhancement tests) -- after all implementation tasks complete
