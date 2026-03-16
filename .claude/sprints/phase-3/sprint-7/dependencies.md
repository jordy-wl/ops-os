# Sprint 7 Dependencies

## Dependency Graph

```
AI-01 (delta engine) ---------- independent (foundational) --+
                                                              |
AI-02 (insights generator) ---- depends on AI-01 -----------+
BE-01 (auto task generation) -- depends on AI-01 -----------+
AI-03 (delta-aware chat) ------ depends on AI-01 -----------+
BE-02 (notification system) --- depends on AI-01 -----------+
                                                              |
FE-01 (insights panel) -------- depends on AI-02 -----------+
                                                              |
QA-01 (tests) ----------------- depends on ALL ---------------+
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 4 complete | REQUIRED | Routing engine needed for auto-task routing |
| Sprint 5 complete | REQUIRED | Task cards needed for insights panel layout |
| Workflow runtime | DONE | Sprint 5 (Phase 2) |
| Task queue + routing | DONE | Sprint 5 (Phase 2) + Sprint 4 (Phase 3) |
| Chat tools infrastructure | DONE | Sprint 14 (Phase 2) |
| Context assembly | DONE | Sprint 14 (Phase 2) |
| Block detail pages | DONE | Sprint 2 (Phase 1) |
| Event subscription | DONE | Sprint 1 (Phase 1) |

## Inter-Sprint Dependencies

| Sprint | Dependency | Impact |
|--------|-----------|--------|
| Sprint 4 | Routing engine + routing policies | BE-01 routes auto-generated tasks through routing engine |
| Sprint 5 | Task cards on canvas | FE-01 insights panel layout assumes task card patterns exist |
| Sprint 8 | Notification preferences | BE-02 creates the foundation that Sprint 8 FE-03 builds preferences on |

## Parallelization

Phase 1 -- AI-01 starts alone (all others depend on it):
1. AI-01 (Delta calculation engine)

Phase 2 -- Four tasks in parallel after AI-01:
2. AI-02 (AI Insights generator)
3. BE-01 (Auto task generation from deltas)
4. AI-03 (Delta-aware chat context)
5. BE-02 (Notification system foundation)

Phase 3 -- After AI-02:
6. FE-01 (AI Insights panel component)

Phase 4 -- After all:
7. QA-01 (Delta engine tests)
