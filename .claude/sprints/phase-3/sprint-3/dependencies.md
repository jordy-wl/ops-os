# Sprint 3 Dependencies

## Dependency Graph

```
BE-01 (RBAC data model) ----+
                             |
                             v
                      BE-02 (withAuth refactor) ----+
                             |                       |
                             v                       v
                      BE-03 (enforcement)      FE-02 (role mgmt UI)
                             |                       |
                             v                       |
                      QA-01 (RBAC tests) <-----------+
                             ^                       |
                             |                       |
BE-04 (team CRUD) --- independent --+                |
                                    |                |
BE-05 (org hierarchy) - independent ---> FE-01 (team mgmt page) --+
                                    |                              |
                                    +------------------------------+
                                                   |
                                                   v
                                            QA-01 (RBAC tests)
```

## Critical Path

**BE-01 --> BE-02 --> BE-03 --> QA-01**

This is the highest-risk chain in Phase 3. The withAuth refactor (BE-02) touches every API route.

## Parallel Work Streams

| Stream | Tasks | Can Start | Risk |
|--------|-------|-----------|------|
| RBAC core (critical path) | BE-01 --> BE-02 --> BE-03 | Immediately (BE-01) | HIGH |
| Team management | BE-04 --> FE-01 | Immediately (BE-04) | LOW |
| Org hierarchy | BE-05 --> FE-01 | Immediately (BE-05) | LOW |
| Role UI | FE-02 (after BE-02) | After BE-02 | MEDIUM |
| QA | QA-01 | After BE-03 + FE-01 + FE-02 | HIGH |

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 2 complete | Required | block types + sub-org data model |
| Sprint 2 BE-03 (sub-org hierarchy) | Required | Foundation for BE-05 |
| Sprint 2 BE-05 (dynamic validation) | Required | Block type validation used by team member blocks |
| Clerk auth system | DONE | User IDs from Clerk used for user_permissions |
| withAuth.ts current implementation | DONE | Must be backward compatible |

## Inter-Sprint Dependencies

| This Sprint | Depends On | Status |
|-------------|-----------|--------|
| Sprint 3 | Sprint 2 complete | FUTURE |
| Sprint 4 | Sprint 3 BE-01 (RBAC) for required_permissions | FUTURE |
| Sprint 4 | Sprint 3 BE-02 (withAuth) for permission-based routing | FUTURE |

## Risk Mitigation

**withAuth.ts refactor:**
- BE-02 MUST maintain backward compatibility as the #1 priority
- Run the full existing test suite after BE-02 before starting BE-03
- If backward compat breaks: fix immediately, do not proceed to BE-03
- Feature flag option: `RBAC_V2_ENABLED` env var to toggle between old and new
