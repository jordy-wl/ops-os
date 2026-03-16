# Sprint 4 Tasks — Routing Engine & Policy System

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 4
**Sprint Goal:** Build the Policy block schema with routing configuration, implement the routing decision engine (step config + policy + confidence --> routing decision), enrich workflow templates with per-step routing, enhance task cards with AI recommendation data, and build the corresponding frontend for routing config and task cards.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 3 (Custom RBAC Engine) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S4-BE-01 | Policy block schema & routing config | Backend | MEDIUM | -- | OPEN |
| P3-S4-BE-02 | Routing decision engine | Backend | HIGH | BE-01 | OPEN |
| P3-S4-BE-03 | Enrich workflow template schema for routing | Backend | MEDIUM | -- | OPEN |
| P3-S4-BE-04 | Enhanced task card data model | Backend | MEDIUM | BE-02 | OPEN |
| P3-S4-AI-01 | Confidence scoring for routing decisions | AI/ML | HIGH | BE-02 | OPEN |
| P3-S4-FE-01 | Routing config in workflow builder | Frontend | MEDIUM | BE-03 | OPEN |
| P3-S4-FE-02 | Enhanced task card UI | Frontend | MEDIUM | BE-04 | OPEN |
| P3-S4-QA-01 | Routing engine tests | QA | HIGH | BE-02, FE-01, FE-02 | OPEN |

**Total:** 8 tasks (4 BE, 1 AI, 2 FE, 1 QA)
**Critical path:** BE-01 --> BE-02 --> BE-04 --> FE-02 --> QA-01

---

## Sprint Notes

- BE-01 (Policy schema) and BE-03 (template enrichment) can start in parallel
- BE-02 (routing engine) depends only on BE-01 and is the core deliverable of this sprint
- AI-01 (confidence scoring) runs in parallel with BE-04, both depending on BE-02
- FE-01 depends on BE-03 (template schema), not on the engine itself
- FE-02 depends on BE-04 (enhanced task card model)
- This is the first sprint with AI/ML tasks in Phase 3
- The routing engine is the foundation for Phase 3's agent AI processing in later sprints
