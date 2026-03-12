# Sprint 7 Tasks — AI Delta Engine

**Phase:** 3 — Scale, Advanced AI & Marketplace
**Sprint:** 7
**Sprint Goal:** Delta calculation engine comparing workflow design vs reality, AI-generated insights panel, auto-task generation from delta thresholds, delta-aware chat context, and notification system foundation.
**Target Duration:** ~2 weeks
**Depends On:** Sprints 4+5 complete (routing engine + task cards)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P3-S7-AI-01 | Delta calculation engine | AI/ML | HIGH | -- | OPEN |
| P3-S7-AI-02 | AI Insights generator | AI/ML | HIGH | AI-01 | OPEN |
| P3-S7-BE-01 | Auto task generation from deltas | Backend | MEDIUM | AI-01 | OPEN |
| P3-S7-FE-01 | AI Insights panel component | Frontend | HIGH | AI-02 | OPEN |
| P3-S7-AI-03 | Delta-aware chat context | AI/ML | MEDIUM | AI-01 | OPEN |
| P3-S7-BE-02 | Notification system foundation | Backend | HIGH | AI-01 | OPEN |
| P3-S7-QA-01 | Delta engine tests | QA | MEDIUM | AI-01, AI-02, BE-01, FE-01, AI-03, BE-02 | OPEN |

**Total:** 7 tasks (2 BE, 3 AI, 1 FE, 1 QA)
**Critical path:** AI-01 (delta engine) --> AI-02 (insights) --> FE-01 (insights panel) --> QA-01

---

## Parallelization

One task starts first (all others depend on it):
1. AI-01 (Delta calculation engine) -- foundational, no intra-sprint deps

Then four tasks in parallel:
2. AI-02 (AI Insights generator) -- after AI-01
3. BE-01 (Auto task generation) -- after AI-01
4. AI-03 (Delta-aware chat context) -- after AI-01
5. BE-02 (Notification system) -- after AI-01

Then:
6. FE-01 (AI Insights panel) -- after AI-02
7. QA-01 (Delta engine tests) -- after all tasks complete

---

## Critical Files

- New: `src/lib/ai/delta-engine.ts` -- core delta calculation
- New: `src/lib/ai/insights-generator.ts` -- Claude-powered insight generation
- Modify: `src/lib/ai/context-assembly.ts` -- add delta context for chat
- New: `src/app/api/notifications/route.ts` -- notification endpoints
- Modify: `src/lib/actions/handlers/` -- auto-task creation handler
