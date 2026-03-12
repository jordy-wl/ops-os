# Sprint 2 Tasks — New Block Types & Schema Foundation

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 2
**Sprint Goal:** Define 5 new system block types, enrich Contact block, implement sub-org hierarchy, seed new types via migration, refactor block validation to be fully dynamic, and update the creation UI.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 1 (Bug Fixes & Quick Wins) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S2-BE-01 | Define 5 new system block types | Backend | MEDIUM | -- | OPEN |
| P3-S2-BE-02 | Enrich Contact block type | Backend | LOW | -- | OPEN |
| P3-S2-BE-03 | Sub-org hierarchy data model | Backend | MEDIUM | -- | OPEN |
| P3-S2-BE-04 | Seed migration for new block types | Backend | LOW | BE-01 | OPEN |
| P3-S2-BE-05 | Dynamic block type validation API | Backend | MEDIUM | BE-04 | OPEN |
| P3-S2-FE-01 | Update block creation UI for new types | Frontend | MEDIUM | BE-05 | OPEN |
| P3-S2-QA-01 | Test new block types | QA | MEDIUM | BE-05, FE-01 | OPEN |

**Total:** 7 tasks (5 BE, 1 FE, 1 QA)
**Critical path:** BE-01 --> BE-04 --> BE-05 --> FE-01 --> QA-01

---

## Sprint Notes

- BE-02 (Contact enrichment) and BE-03 (sub-org hierarchy) are independent and can start in parallel with BE-01
- The critical chain is BE-01 --> BE-04 --> BE-05 --> FE-01
- BE-05 builds on the dynamic validation groundwork from S1-BE-01
- Sub-org hierarchy (BE-03) lays the foundation for Sprint 3 RBAC and team management
- QA-01 should run after both BE-05 and FE-01 are complete to test the full flow
