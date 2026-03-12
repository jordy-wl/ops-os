# Sprint 3 Tasks — Custom RBAC Engine

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 3
**Sprint Goal:** Build a granular, custom RBAC engine with 10 permissions. Refactor withAuth.ts from role-based to permission-based. Implement team member CRUD, org hierarchy API, and management UIs.
**Target Duration:** ~2.5 weeks
**Depends On:** Sprint 2 (New Block Types & Schema Foundation) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S3-BE-01 | RBAC data model migration | Backend | HIGH | -- | OPEN |
| P3-S3-BE-02 | Refactor withAuth.ts for granular RBAC | Backend | HIGH | BE-01 | OPEN |
| P3-S3-BE-03 | Permission enforcement middleware | Backend | HIGH | BE-02 | OPEN |
| P3-S3-BE-04 | Team Member CRUD API | Backend | MEDIUM | -- | OPEN |
| P3-S3-BE-05 | Org hierarchy API | Backend | MEDIUM | -- | OPEN |
| P3-S3-FE-01 | Team management settings page | Frontend | MEDIUM | BE-04, BE-05 | OPEN |
| P3-S3-FE-02 | Role management UI | Frontend | MEDIUM | BE-02 | OPEN |
| P3-S3-QA-01 | RBAC integration tests | QA | HIGH | BE-03, FE-01, FE-02 | OPEN |

**Total:** 8 tasks (5 BE, 2 FE, 1 QA)
**Critical path:** BE-01 --> BE-02 --> BE-03 --> QA-01

---

## Sprint Risk Assessment

**HIGH RISK: withAuth.ts refactor (BE-02/BE-03)**
- `withAuth.ts` is imported by every protected API route
- Refactoring from `resolveRole()` to `resolvePermissions()` must be backward compatible
- Strategy: keep existing role names working, add permissions as a superset
- Rollback plan: feature flag to switch between old role-based and new permission-based checks

**MITIGATION:**
- BE-02 must maintain backward compatibility -- existing `requireRole()` calls keep working
- BE-03 applies `requirePermission()` incrementally, route by route
- QA-01 specifically tests backward compatibility

---

## Sprint Notes

- BE-04 (Team Member CRUD) and BE-05 (Org hierarchy API) are independent of the RBAC chain and can start in parallel
- FE-01 depends on both BE-04 and BE-05 (team + org APIs)
- FE-02 depends on BE-02 (needs the role/permission data model)
- QA-01 is the heaviest QA task in Phase 3 -- HIGH complexity due to permission matrix testing
- Sprint 2 BE-03 (sub-org hierarchy data model) is a prerequisite for BE-05
