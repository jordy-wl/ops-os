# Sprint 2 Retrospective

**Date:** 2026-03-03
**Completion Rate:** 9/9 tasks, 100%
**Conducted by:** ORCHESTRATOR

---

## Gate Evidence Audit

| Task ID | Gate Evidence | Notes |
|---------|--------------|-------|
| P1-S2-OPS-01 | PRESENT | Gates 1, 5 — CI run confirmed successful (3 steps) |
| P1-S2-BE-01 | PRESENT | Gates 1, 2, 3, 5, 6 — HIGH; Gate 6 peer review by QA-ENGINEER, PASS |
| P1-S2-BE-02 | PRESENT | Gates 1, 2, 5 — 16 auth unit tests, full suite 115 pass |
| P1-S2-FE-01 | PRESENT | Gates 1, 4, 5 — all 4 breakpoints, 3 states |
| P1-S2-FE-02 | PRESENT | Gates 1, 2, 4, 5 — 13 SSE unit tests |
| P1-S2-FE-03 | PRESENT | Gates 1, 4, 5 — all 4 breakpoints, 5 states |
| P1-S2-AI-01 | PRESENT | Gates 1, 2, 5 — 12 new unit tests, 93 total pass |
| P1-S2-QA-01 | PRESENT | Gates 1, 2, 3, 5 — 7 contract tests (skip in CI) |
| P1-S2-DE-01 | PRESENT | Gates 1, 5 — proxy session; 1 real event; status corrected to DONE |

**Tasks with missing evidence:** None.
**Tasks returned to IN_PROGRESS:** None.
**DE-01 status fix:** Gate evidence was filed in gate-results.md but shared-state.md showed IN_PROGRESS — corrected to DONE in this retro.

---

## Sprint Metrics

**Completion rate:** 9/9 — 100%
**Complexity breakdown:** 1 HIGH (BE-01), 7 MEDIUM (BE-02, FE-01, FE-02, FE-03, AI-01, QA-01, DE-01), 1 LOW (OPS-01)
**Blockers:** 0 — no blockers filed this sprint
**Gate 6 reviews:** 1 required (BE-01 HIGH) — PASS. 2 non-blocking findings logged.
**Gate failures:** 0 — all tasks passed all applicable gates on first submission.

**Test count at Sprint 2 exit:**
- Unit tests: 115 passing, 29 skipping (contract/E2E)
- Contract tests: 7 (workflow.test.ts) — skip in CI, run with live Supabase
- E2E tests: 7 (smoke.spec.ts) — skip without credentials

**Production state:** Live at https://ops-os-gamma.vercel.app. Supabase xanokdlsnrnzyhtfohpd, 4 migrations applied, pgvector 0.8.0 enabled. 1 real Clerk org with 1 block and 1 event.

---

## What Went Well

- Full sprint completed 9/9 tasks — all with real, non-placeholder gate evidence.
- BE-01 (HIGH complexity, 4d estimate) delivered in one pass with 17 unit tests, 5 contract tests, and a clean Gate 6 peer review from QA-ENGINEER.
- Zero blockers the entire sprint — all dependency chains resolved in order (OPS-01 → DE-01, BE-01 → FE-03 + QA-01).
- Gate 6 discipline improved significantly from Sprint 1: QA-ENGINEER filed evidence with specific file:line references and actionable improvement suggestions.
- Test count grew from 64 unit (Sprint 1) to 115 unit + 29 contract/E2E (Sprint 2) — 80% growth.
- Production deploy landed clean: all migrations applied, pgvector working, health endpoint 200.

---

## What Was Harder Than Expected

- **Design partner onboarding (DE-01):** A proxy session was required instead of a real external partner. Walkthrough acceptance criteria assumed a workflow trigger UI existed — it doesn't (FE-03 is status-only, no trigger). This produced 1 real event instead of the target ≥5. Sprint 3 must ship the trigger UI first.
- **Engine cron not wired to production:** BE-01 delivered the engine, but `vercel.json` cron config and `WORKFLOW_ENGINE_SECRET` production env var were out of BE-01 scope and ended up in a gap. Workflow jobs will stay "pending" in production until Sprint 3 BE-01 lands the cron config.
- **AI-01 signature change cascaded:** Extending `assembleContext()` with a 4th `query` param broke 7 pre-existing tests that called the old 3-arg signature. The correct protocol — search all call sites before changing a shared function signature — was reinforced via signal and will carry into Sprint 3.

---

## Build Signals Generated This Sprint

**6 total signals, 6 PENDING for researcher.**

Key themes:

| Theme | Signals | PRD Impact | Recommendation |
|-------|---------|-----------|----------------|
| Schema naming drift (`started_at` vs `claimed_at`, `done` vs `completed`) | 2 | prd/04-data-models.md | **Two signals, same section = strong signal. Run /evolve-prd for PRD-04.** |
| Infrastructure gaps not in task scope (vercel.json cron, env var) | 1 | prd/08-infra-devops.md, prd/03-system-architecture.md | Moderate. Update PRD-08 to list vercel.json and WORKFLOW_ENGINE_SECRET as required deploy artifacts. |
| Primary market is Australia/ASIC, not EU/FCA | 1 | prd/08-infra-devops.md | Moderate. PRD-08 must update region from eu-west-1 to ap-southeast-2. Phase 4 multi-region plan unaffected. |
| Design partner walkthrough criteria assumed UI that doesn't exist | 1 | prd/06-frontend-spec.md | Moderate. PRD-06 design partner section must be revised; Sprint 3 adds trigger UI. |
| Pre-existing Sprint 1 lint debt surfaced by CI | 1 | None (process) | Weak. No PRD update needed; CI will catch future regressions. |

**Researcher action:** Run `/evolve-prd signals` for the prd/04-data-models.md strong signal (schema naming) and prd/08-infra-devops.md + prd/06-frontend-spec.md moderate signals.

---

## Phase Exit Condition Status

**Phase 1 exit condition:** TRUE when ≥2 distinct orgs each have ≥10 workflow_jobs.status='done' in a single week, AND ≥1 is a capital markets design partner using the system for a real operational workflow (not demo).

| Exit Condition | Status | Evidence from Sprint 2 | Remaining Gap |
|---------------|--------|----------------------|---------------|
| ≥2 orgs with ≥10 workflow_jobs done/week | NOT MET | 1 org, 0 workflow_jobs completed (cron not wired + no trigger UI) | Need: cron config, trigger UI, ≥2 partner orgs |
| ≥1 capital markets design partner actively using for real workflow | NOT MET | Proxy session only; 1 event; no external partner confirmed | Need: external capital markets contact, real walkthrough |
| ≥50 real business events across design partners | NOT MET | 1 real event | Need: trigger UI → workflow → event chain |
| Verbal confirmation "I would be disrupted if you took this away" | NOT MET | Not attempted yet | Need: real partner session first |

**Phase 1 recommendation: NOT READY TO CLOSE — 0/4 exit conditions met. Sprint 3 focuses on closing the gap via trigger UI + cron hardening + real partner.**

---

## Next Sprint Priorities

1. **Workflow trigger UI** (P1-S3-FE-01, MEDIUM): The single biggest blocker to Phase 1 exit. Without a button to start a workflow, no partner can generate real events. Critical path item for Sprint 3.
2. **Production cron hardening** (P1-S3-BE-01, LOW): vercel.json cron + fail-closed secret + markDone/markFailed error handling. Without this, jobs stay "pending" forever in production. Pairs with FE-01 as pre-requisites for DE-01.
3. **Real design partner** (P1-S3-DE-01, HIGH): Proxy session confirmed the system works. Sprint 3 must secure an external capital markets contact and run a real live session using the revised walkthrough (trigger → events → AI chat).

---

## What the Next Sprint Must Account For

**Technical debt:**
- Fix fail-open cron secret in `route.ts:20` — invert guard to fail-closed (Gate 6 finding from BE-01 peer review).
- Fix `markDone`/`markFailed` in `engine.ts:112-136` — check Supabase update return values; log and surface errors if DB update fails. Prevents silent stuck-running jobs at higher load.
- Both are in P1-S3-BE-01 scope.

**PRD risks to watch:**
- prd/04-data-models.md schema naming (strong signal — researcher must update before Sprint 4 data work).
- prd/08-infra-devops.md region (ASIC vs FCA) — affects Phase 4 multi-region decisions if not corrected now.
- prd/06-frontend-spec.md design partner walkthrough criteria — current Sprint 2 criteria will fail again if used unrevised.

**Coordination needs:**
- DE-01 (partner onboarding) in Sprint 3 must not begin external partner scheduling until P1-S3-FE-01 and P1-S3-BE-01 are both DONE and deployed to production. Orchestrator enforces this gate.
- QA-01 E2E test depends on FE-01 trigger UI existing — QA can write test scaffold early but cannot run until FE-01 is in production.
- AI-01 (context enrichment) has no dependencies and can proceed in parallel from Day 1.
