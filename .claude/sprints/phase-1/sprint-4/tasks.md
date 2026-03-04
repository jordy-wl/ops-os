# Sprint 4 — Master Task List

> Phase 1 (continuing) + Phase 2 Exploration
> Sprint Goal: Ship quick wins from design partner feedback + begin composable block types
> Sprint Started: 2026-03-04
> Generated at: Sprint 3 retro

---

## Quick Wins (carry-forward from Sprint 2/3 feedback)

| Task ID | Title | Role | Status | Complexity | Est | Blocked By |
|---------|-------|------|--------|-----------|-----|-----------|
| P1-S4-BE-01 | Sync Org Name from Clerk | Backend | OPEN | LOW | 0.5d | — |
| P1-S4-FE-01 | Dashboard Empty State CTA | Frontend | OPEN | LOW | 0.5d | — |

## Phase 2 Exploration — Composable Block Types

| Task ID | Title | Role | Status | Complexity | Est | Blocked By |
|---------|-------|------|--------|-----------|-----|-----------|
| P2-S4-BE-02 | block_type_definitions Table + CRUD API | Backend | OPEN | HIGH | 2d | — |
| P2-S4-DE-01 | Seed System Block Types | Data | OPEN | LOW | 0.5d | BE-02 |
| P2-S4-FE-02 | Dynamic Block Forms from field_schema | Frontend | OPEN | MEDIUM | 2d | BE-02, DE-01 |
| P2-S4-QA-01 | Block Type Definitions — Unit + Contract Tests | QA | OPEN | MEDIUM | 1d | BE-02 |
| P2-S4-BE-03 | Workflow Template Block Schema + CRUD API | Backend | OPEN | HIGH | 2d | BE-02 |

---

## Task Count: 7
## Critical Path: BE-01 + FE-01 (quick wins, unblocked) → BE-02 (block types) → DE-01 + FE-02 + QA-01 (depend on BE-02) → BE-03 (workflow templates, depends on BE-02)
