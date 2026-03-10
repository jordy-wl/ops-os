# Sprint 13 Dependencies

## Internal Dependencies (within sprint)

```
BE-01 (update_block step type)
  ├── FE-01 (Update Block canvas node) — needs step type + handler for canvas integration
  └── QA-01 (workflow system tests) — needs handler for unit/integration tests

BE-02 (remove hardcoded onboarding) — independent, no internal deps
FE-02 (canvas-first workflow creation) — independent, no internal deps
```

## External Dependencies (from other sprints)

| Dependency | Sprint | Status | Impact |
|-----------|--------|--------|--------|
| Field types system | Sprint 12 (BE-01) | DONE | update_block validates against field_schema |
| Field schema builder | Sprint 12 (BE-01) | DONE | extractFieldsFromSchema for field picker |
| Step engine | Sprint 7 (BE) | DONE | New step type added to existing engine |
| Canvas components | Sprint 7 (FE) | DONE | New node type registered in existing canvas |
| Canvas layout conversion | Sprint 7 (BE) | DONE | Bidirectional conversion extended |
| Workflow template schema | Sprint 5 (BE) | DONE | Step type enum extended |
| Action registry | Sprint 5 (BE) | DONE | Onboarding entry removed |
| Sidebar layout | Sprint 11 (FE) | DONE | Builder page uses sidebar-aware layout |

## Critical Path

**Longest chain:** BE-01 → FE-01 → QA-01 (3 sequential tasks)
**Parallel work:** BE-02 and FE-02 can start immediately (no deps)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Removing onboarding breaks existing workflow_jobs | Medium | High | Check DB before removing; handler removal won't affect completed jobs |
| Template expression injection in update_block | Low | High | Whitelist `{{context.*}}` and `{{block.*}}` prefixes only; validate field names against schema |
| Canvas node config panel complexity | Medium | Medium | Start with simple field-value inputs; defer complex template expressions to v2 |
| Existing tests reference onboarding | Medium | Low | Search and update/remove test cases before deletion |
