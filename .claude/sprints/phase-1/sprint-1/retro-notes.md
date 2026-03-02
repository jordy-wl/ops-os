# Sprint 1 Retrospective

**Date:** 2026-03-02
**Completion Rate:** 16/16 tasks (100%)
**Conducted by:** ORCHESTRATOR
**Sprint Duration:** 1 session (2026-03-02 — single intensive build session)

---

## What Went Well

- **100% completion in one session** — all 16 tasks completed on a single day, including 64 unit tests, 22 contract tests (skip guard), 7 E2E tests (skip guard). Walking skeleton is real and functional.
- **Test architecture is clean** — three test tiers work independently: unit (always runs), contract (requires local Supabase), E2E (requires Clerk test credentials). No test-tier contamination.
- **vi.hoisted() pattern** — solved the most subtle testing problem (module-bound export mock override). The pattern is now documented in MEMORY.md and reusable across the project.
- **Events immutability is genuinely enforced** — two layers (RLS deny policy + Postgres trigger), the trigger fires even on service_role operations and cascade deletes. This is the core audit trail guarantee.
- **fire-and-forget embeddings** — embedEvent() never blocks event creation; 4 resilience tests confirm no throw scenario. Correct pattern for a background pipeline.
- **Data model proved**: Blocks (JSONB + graph), Events (immutable), Actions (command pattern), pgvector embeddings — all four primitives built, tested, seeded with a realistic demo scenario.
- **Standards compliance** — structured JSON logger everywhere, prompts extracted to `src/prompts/`, zero console calls in `src/**`, Zod validation at all API boundaries.

---

## What Was Harder Than Expected

- **vi.hoisted() discovery** — took one failing test to identify that `POST = withAuth(handler)` is evaluated at module import, making `mockImplementationOnce` ineffective. Pattern is now documented; future agents should check MEMORY.md before writing mock tests.
- **tsconfig split for ts-node scripts** — main tsconfig uses `esnext/bundler` (Next.js default); ts-node requires `commonjs/node`. Creating `tsconfig.scripts.json` was non-obvious. Now documented.
- **Events immutability and test cleanup** — the immutability trigger prevents cascade deletes even in test runs. Contract tests intentionally do not clean up; `db:reset` is the only cleanup path. This constraint cascades: seed script is idempotent but not restartable without a full reset. Design decision: correct, but operationally annoying.
- **Playwright/Vitest conflict** — Playwright's `test.describe()` syntax causes Vitest to error when it tries to collect the E2E file. Fix: `exclude: ['**/tests/e2e/**']` in `vitest.config.ts`. Non-obvious.
- **Gate evidence was informal** — 10 of 16 tasks completed without writing formal gate evidence to `gate-results.md`. Evidence was captured in `shared-state.md` notes instead (which is detailed and real). Retro added formal entries. **Sprint 2 fix:** engineers write gate evidence to `gate-results.md` DURING the task, not at retro.

---

## Build Signals Generated This Sprint

- **0 signals** — `build-learnings.md` has no entries.
- This is not necessarily good: it may mean implementation matched spec, or it may mean engineers didn't log divergences they encountered.
- **Sprint 2 action:** Orchestrator to remind all roles at sprint kickoff to log signals in `build-learnings.md` during implementation — not just at completion.

---

## Phase Exit Condition Status

Phase 1 exit requires: ≥2 orgs with ≥10 workflow_jobs processed in a 7-day window + 1 capital markets design partner using for real ops + ≥50 real business events + design partner verbal confirmation.

| Condition | Status | Notes |
|-----------|--------|-------|
| ≥2 orgs with ≥10 workflow_jobs done in 7 days | NOT MET | Workflow engine not yet built; only schema exists |
| ≥1 capital markets design partner using for real ops | NOT MET | No design partners recruited yet |
| ≥50 real business events in production | NOT MET | No production deployment yet |
| Design partner verbal confirmation | NOT MET | Dependent on above |

**Phase 1 recommendation:** CONTINUE — not ready to close. Sprint 2 must deliver: workflow engine (meets condition 1) + production deploy + design partner onboarding (meets conditions 2–4).

---

## Next Sprint Priorities

1. **Workflow engine** (BE-01) — critical path for phase exit condition. The schema is built; the processor loop is not. Without it, workflow_jobs never transition from `pending` to `done`.
2. **Production deploy + design partner** (DE-01) — the phase can never close on a localhost-only system. A real production URL with at least one design partner signed up is the unlock for all phase exit conditions.
3. **Chat UI** (FE-02) + **Dashboard** (FE-01) — these are the surfaces a design partner will actually interact with. Without them, the demo is API calls in Postman, which is not a compelling design partner experience.

---

## What Sprint 2 Must Account For

**Technical debt:**
- No git repository yet — all parallel development is risky until OPS-01 is complete. OPS-01 MUST be the first task completed in Sprint 2.
- Gate evidence discipline: agents must write gate evidence during tasks, not after. Orchestrator to enforce at kickoff.

**PRD risks to watch:**
- Workflow engine is the hardest technical task in Sprint 2 (HIGH complexity). If BE-01 slips, it blocks FE-03 and QA-01. Orchestrator should check BE-01 progress at day 2 — if not on track, escalate immediately.
- Design partner availability is an external dependency. DE-01 cannot be completed without a willing design partner. If no partner is available by Sprint 2 day 5, de-risk by staging a "design partner simulation" (team member runs the walkthrough as a proxy).

**Coordination needs:**
- BE-01 (workflow engine) is a dependency for FE-03 and QA-01 — these roles should stub their work early and be ready to integrate the moment BE-01 is DONE.
- FE-01 (dashboard) needs a new backend endpoint (GET /api/dashboard/summary). Backend may be occupied with BE-01. FE-01 should stub the endpoint response locally and wire it up when available.
- OPS-01 (git init) must commit files carefully — never `git add -A` or `git add .`. Stage specific files to avoid committing `.env.local`.

---

## Architect Assessment (Gate 7)

All 16 Sprint 1 tasks completed. The walking skeleton is real: auth, blocks CRUD, events immutability, actions command pattern, context assembly, AI chat, embeddings pipeline, seed data, contract tests, E2E tests. This is a solid foundation.

The two risks going into Sprint 2:
1. No git repo — addressed as first Sprint 2 task
2. No design partners — addressed as last Sprint 2 task (production deploy + partner onboarding)

Sprint 1 CLOSED. Sprint 2 OPEN.
