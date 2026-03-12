# Sprint 8 Tasks — Core Admin Settings

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 8
**Sprint Goal:** Restructure settings page with full sidebar navigation. Routing policy configuration, notification preferences, API key management, and audit log viewer.
**Target Duration:** ~2 weeks
**Depends On:** Sprints 3+4+7 complete (RBAC, routing engine, notification system)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S8-FE-01 | Settings page restructure | Frontend | HIGH | -- | OPEN |
| P3-S8-BE-01 | Routing policy settings API | Backend | MEDIUM | -- | OPEN |
| P3-S8-FE-02 | Routing policy config UI | Frontend | MEDIUM | FE-01, BE-01 | OPEN |
| P3-S8-FE-03 | Notification preferences UI | Frontend | MEDIUM | FE-01 | OPEN |
| P3-S8-BE-02 | API key management | Backend | HIGH | -- | OPEN |
| P3-S8-FE-04 | Audit log viewer | Frontend | MEDIUM | FE-01 | OPEN |
| P3-S8-BE-03 | Org overview page API | Backend | MEDIUM | -- | OPEN |
| P3-S8-FE-05 | Org overview page | Frontend | MEDIUM | FE-01, BE-03 | OPEN |
| P3-S8-QA-01 | Sprint 8 integration tests | QA | MEDIUM | All above | OPEN |

**Total:** 9 tasks (3 BE, 5 FE, 1 QA)
**Critical path:** FE-01 (settings restructure) + BE-01 (routing API) --> FE-02 (routing UI) --> QA-01

---

## Parallelization

Four tasks can start immediately in parallel:
1. FE-01 (Settings page restructure) -- no intra-sprint deps
2. BE-01 (Routing policy settings API) -- no intra-sprint deps
3. BE-02 (API key management) -- no intra-sprint deps
4. BE-03 (Org overview page API) -- no intra-sprint deps

Then (after FE-01 provides settings layout):
5. FE-02 (Routing policy config UI) -- after FE-01 + BE-01
6. FE-03 (Notification preferences UI) -- after FE-01
7. FE-04 (Audit log viewer) -- after FE-01
8. FE-05 (Org overview page) -- after FE-01 + BE-03
9. QA-01 (Sprint 8 integration tests) -- after all above

---

## Critical Files

- `src/app/(app)/settings/` -- major restructure of settings pages
- `src/app/api/settings/` -- settings API endpoints
- `src/app/api/keys/` -- API key management endpoints
- Sprint 4 routing engine files (routing policies)
- Sprint 7 notification system files (notification preferences)
