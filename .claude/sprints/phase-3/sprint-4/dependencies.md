# Sprint 4 Dependencies

## Dependency Graph

```
BE-01 (policy schema) --------+     BE-03 (template schema) --- independent
                               |                |
                               v                v
                        BE-02 (routing engine)  FE-01 (routing config UI)
                               |
                    +----------+----------+
                    |                     |
                    v                     v
             BE-04 (task model)    AI-01 (confidence scoring)
                    |
                    v
             FE-02 (task card UI)
                    |
                    v
             QA-01 (routing tests) <--- also depends on FE-01, BE-02
```

## Critical Path

**BE-01 --> BE-02 --> BE-04 --> FE-02 --> QA-01**

Secondary path: BE-03 --> FE-01 (can run in parallel with critical path)

## Parallel Work Streams

| Stream | Tasks | Can Start | Risk |
|--------|-------|-----------|------|
| Routing core (critical path) | BE-01 --> BE-02 --> BE-04 | Immediately (BE-01) | HIGH |
| Template enrichment | BE-03 --> FE-01 | Immediately (BE-03) | LOW |
| Confidence scoring | AI-01 (after BE-02) | After BE-02 | HIGH |
| Task card UI | FE-02 (after BE-04) | After BE-04 | MEDIUM |
| QA | QA-01 | After BE-02 + FE-01 + FE-02 | HIGH |

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 3 complete | Required | RBAC system for required_permissions |
| Sprint 3 BE-02 (withAuth refactor) | Required | Permission-based routing |
| Sprint 2 BE-01 (Policy block type) | Required | Policy block exists, now enriched |
| Workflow template schema | DONE | Extended in this sprint |
| Task queue system | DONE | Phase 2 Sprint 5 |
| Claude API access | DONE | Used for confidence evaluation |

## Inter-Sprint Dependencies

| This Sprint | Depends On | Status |
|-------------|-----------|--------|
| Sprint 4 | Sprint 3 complete (RBAC) | FUTURE |
| Sprint 5+ | Sprint 4 BE-02 (routing engine) | FUTURE |
| Sprint 5+ | Sprint 4 AI-01 (confidence scoring) | FUTURE |
| Sprint 5+ | Sprint 4 BE-04 (enhanced tasks) | FUTURE |

## Risk Notes

**Routing engine (BE-02):**
- Core architectural component -- must be thoroughly tested before Sprint 5 builds on it
- Decision logging as Events is critical for the operational intelligence feature in later sprints

**Confidence scoring (AI-01):**
- First AI/ML task in Phase 3
- Claude API latency could impact task routing speed -- caching is critical
- Prompt engineering for consistent scoring will likely need iteration beyond this sprint
