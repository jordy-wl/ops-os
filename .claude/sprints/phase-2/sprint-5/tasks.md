# Sprint 5 — Task Overview

> Phase 2, Sprint 5: Workflow Runtime + Task Queue
> Sprint Goal: Build workflow instance spawning from templates, step execution engine, trigger evaluation (manual + event), and task queue API. Ship the foundation that makes workflow templates actually runnable.

---

## Priority 0: Merge Backlog (Manual Action)

**11 OPEN PRs must be merged to main before Sprint 5 code work begins.** No new features can reach production until the backlog is cleared. This is the single biggest risk.

PRs to merge (in order):
1. #2 — FE-01 trigger button
2. #3 — AI-01 context enrichment
3. #4 — FE-02 timeline polish
4. #5 — QA-01 E2E test
5. #6 — BE-01 org name sync
6. #7 — FE-01 empty state CTA
7. #8 — BE-02 block types CRUD
8. #9 — DE-01 seed system types
9. #10 — QA-01 block type contract tests
10. #11 — FE-02 dynamic forms
11. #12 — BE-03 workflow templates

---

## Task Summary

| Task ID | Title | Role | Complexity | Est | Blocked By | Gates |
|---------|-------|------|-----------|-----|-----------|-------|
| P2-S5-BE-01 | Workflow Instance Spawning | Backend | HIGH | 2d | PR merge | 1, 2, 3, 5 |
| P2-S5-BE-02 | Step Execution Engine | Backend | HIGH | 3d | BE-01 | 1, 2, 3, 5 |
| P2-S5-BE-03 | Trigger Evaluation (Manual + Event) | Backend | MEDIUM | 1.5d | BE-01 | 1, 2, 3, 5 |
| P2-S5-BE-04 | Task Queue API | Backend | MEDIUM | 1.5d | BE-01 | 1, 2, 3, 5 |
| P2-S5-FE-01 | Workflow Template List + Create UI | Frontend | MEDIUM | 2d | PR merge | 1, 4, 5 |
| P2-S5-FE-02 | My Tasks Queue UI | Frontend | MEDIUM | 1.5d | BE-04 | 1, 4, 5 |
| P2-S5-QA-01 | Workflow Runtime Integration Tests | QA | MEDIUM | 1d | BE-02, BE-03 | 1, 2, 5 |

**Critical path:** PR merge → BE-01 → BE-02 + BE-03 + BE-04 → FE-02 + QA-01
