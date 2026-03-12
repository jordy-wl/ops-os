# Sprint 8 Dependencies

## Dependency Graph

```
FE-01 (settings restructure) -- independent ----------+
BE-01 (routing policy API) ---- independent ----------+
BE-02 (API key management) ---- independent ----------+
                                                       |
FE-02 (routing config UI) ----- depends on FE-01 + BE-01
FE-03 (notification prefs) ---- depends on FE-01 -----+
FE-04 (audit log viewer) ------ depends on FE-01 -----+
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 3 complete (RBAC) | REQUIRED | Roles page content, ops-admin checks |
| Sprint 4 complete (routing engine) | REQUIRED | Routing policies extend the routing engine |
| Sprint 7 complete (notifications) | REQUIRED | Notification preferences build on notification system |
| Clerk auth + org management | DONE | Phase 1 |
| Events table (audit log) | DONE | Sprint 1 (Phase 1) |
| Block types admin UI | DONE | Sprint 12 (Phase 2) |
| Brand kit settings | DONE | Sprint 9 (Phase 2) |
| Integrations list page | DONE | Sprint 6 (Phase 2) |
| Team management | DONE | Phase 1 |

## Inter-Sprint Dependencies

| Sprint | Dependency | Impact |
|--------|-----------|--------|
| Sprint 3 | RBAC roles and permissions | FE-01 migrates existing roles page into new settings layout |
| Sprint 4 | Routing engine | BE-01 adds policy storage that the routing engine reads |
| Sprint 7 | Notification system | FE-03 builds preferences UI on top of Sprint 7 notification foundation |

## Parallelization

Three tasks can start immediately in parallel:
1. FE-01 (Settings page restructure) -- no intra-sprint deps
2. BE-01 (Routing policy settings API) -- no intra-sprint deps
3. BE-02 (API key management) -- no intra-sprint deps

Then (after FE-01 provides settings layout):
4. FE-02 (Routing policy config UI) -- after FE-01 + BE-01
5. FE-03 (Notification preferences UI) -- after FE-01
6. FE-04 (Audit log viewer) -- after FE-01
