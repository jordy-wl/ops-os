# PRD Layer 11: Testing Strategy

> Last updated: 2026-03-02 | Author: QA Engineer | Status: DRAFT
> QA engineer: this is your operating document. Read at every session start.
> Cross-references: `standards/quality-gates.md` (Gate 2 and Gate 4 requirements).

---

## Testing Philosophy

Ops OS handles compliance-critical data for regulated industries. A bug in the event immutability enforcement or org isolation is not just a software defect — it's a potential compliance violation. Testing philosophy reflects this:

1. **Correctness over coverage:** 100% coverage of the wrong things is worthless. Cover the right things: immutability, org isolation, action atomicity, auth enforcement.
2. **Test behaviour, not implementation:** Tests survive refactors. Assert on what the system does (events are immutable, actions create events) not how (which function was called).
3. **Real Supabase for contract tests:** Unit mocks are insufficient for validating RLS policies and database constraints. Contract tests run against a real Supabase instance with skip guards.
4. **No PII in test data:** Test fixtures use fake company names, fake entity names. No real client data. Ever.

**Current test counts (Sprint 1 final):**
- 64 unit tests (Vitest)
- 22 contract tests (Vitest, `describe.skipIf(!hasSupabase)`)
- 7 E2E tests (Playwright, `E2E_CLERK_EMAIL` env guard)

---

## Test Pyramid

| Level | Target % | Scope | Speed | Reliability | Runner |
|-------|---------|-------|-------|-------------|--------|
| Unit | 70% | Individual functions, components, handlers | Fast (<1s each) | High | Vitest |
| Contract / Integration | 20% | Real API endpoints with real Supabase | Medium (1–10s) | Medium | Vitest (real DB) |
| E2E | 10% | Full user flows in real browser | Slow (10–60s) | Lower | Playwright |

**Rationale for this ratio:** Event sourcing means unit tests can validate the business logic (action handlers, event type selection, confidence scoring) quickly. Contract tests are critical for validating database constraints (immutability, RLS) that cannot be mocked. E2E tests cover the critical user paths that must work end-to-end.

---

## Testing by Role

| Role | Responsible For | Coverage Target |
|------|----------------|----------------|
| Frontend Engineer | Component unit tests (React Testing Library), accessibility tests | ≥ 80% for new files |
| Backend Engineer | Handler unit tests, route contract tests | ≥ 80% for new files; all auth paths covered |
| Data Engineer | Migration tests, pipeline unit tests | All migrations have rollback tests; ≥ 80% for transforms |
| AI/ML Engineer | Prompt eval suite (`src/evaluations/`), output validation tests | Pass rate per `prd/07-ai-ml-spec.md` |
| DevOps Engineer | IaC validation, deployment smoke tests | All environments pass health check |
| QA Engineer | Integration tests, E2E critical paths, Gate 6 peer reviews | All critical paths in E2E suite |

---

## Test Configuration

**Vitest config (`vitest.config.ts`):**
- Exclude `tests/e2e/**` — Playwright tests conflict with Vitest runner
- Include `src/**/*.test.ts` and `tests/api/**/*.test.ts`
- Coverage: V8 provider; report on `src/` only (exclude tests, migrations)

**Skip guards (conditional tests):**
```typescript
// Contract tests — require real Supabase
const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
describe.skipIf(!hasSupabase)('blocks contract tests', () => { ... })

// E2E tests — require Clerk test credentials
// Playwright: process.env.E2E_CLERK_EMAIL guards E2E suite
```

**TypeScript for scripts:** `tsconfig.scripts.json` with `"module": "commonjs"` — needed for ts-node scripts. Main tsconfig uses `esnext/bundler`.

**Mock patterns (Vitest):**
- `vi.hoisted()` for mutable state shared with `vi.mock()` factories — required when `POST = withAuth(handler)` is bound at module load
- `vi.mock('@/lib/supabase/server', async () => { ... })` for unit tests
- Real Supabase client for contract tests (no mocks)

---

## Critical User Paths (Must Have E2E Coverage)

| Path | Steps | Success Criteria | Priority |
|------|-------|-----------------|---------|
| User sign-in → Dashboard | Sign in via Clerk → redirected to `/` → blocks table visible | Dashboard loads, no errors | CRITICAL |
| Create a block | Click "New Block" → fill form → submit → block appears in list | Block in Supabase, event recorded | CRITICAL |
| View block detail + event timeline | Click block → Block Detail → Timeline tab | Events display in chronological order | CRITICAL |
| Trigger workflow via chat | Type "start onboarding for [block]" → AI suggests action → approve → workflow job created | workflow_jobs row in DB, events recorded | CRITICAL |
| AI chat query (info) | Type "what is the status of [block]?" → AI responds with event summary | AI response contains correct status | HIGH |
| Event timeline audit (immutability) | View events for a block → verify events are read-only | No edit controls on events; API returns 405 on PUT/DELETE | HIGH |

---

## Unit Test Requirements by Domain

### Action Handlers (`src/lib/actions/handlers/`)
- Happy path: action executes, event is created, correct event_type
- Validation failure: invalid payload → 400, no event created
- Auth failure: no org_id → 401
- Block not found in org: → 404

### Event Immutability
- Contract test: attempt UPDATE on events table → must fail (RLS)
- Contract test: attempt DELETE on events table → must fail (RLS)
- Unit test: events API route has no PUT, PATCH, or DELETE handlers

### Org Isolation
- Contract test: request blocks/events with org_A token → cannot see org_B data
- Must return 404 (not 403) to not leak existence of cross-org resources

### AI Routing
- Unit test: confidence = 1.0 threshold → all actions route to human (Phase 1)
- Unit test: routing decision event is always logged regardless of outcome
- Unit test: PII is not included in prompt assembly (email, phone fields stripped)

### Workflow Engine
- Unit test: workflow step claims job atomically (no double-claim)
- Unit test: failed step increments retry_count; moves to failed after max_retries
- Unit test: each completed step inserts the next step

### Embeddings Pipeline
- Unit test: `buildEmbeddingContent()` strips email and phone fields
- Unit test: fire-and-forget — embedding failure does not throw in the action handler
- Contract test: embedding is stored with correct source_type and org_id

---

## Performance Testing Requirements

| Scenario | Target | How to Run | When |
|---------|--------|-----------|------|
| Block list query (1000 blocks) | < 100ms | EXPLAIN ANALYZE in Supabase | Before Phase 2 commit |
| Event timeline query (500 events for one block) | < 50ms | EXPLAIN ANALYZE | Before Phase 2 commit |
| Graph traversal (block + 1-hop edges, 100 edges) | < 200ms | Timed contract test | Before Phase 2 commit |
| Semantic search (10k embeddings) | < 500ms | Timed contract test | Sprint 2 (graph performance spike) |
| API endpoint latency (p95 under load) | < 500ms | Not run in Phase 1 | Pre-production |
| Frontend LCP | < 2.5s | Lighthouse | Pre-design-partner launch |

---

## Test Data Management

| Category | Approach | Location |
|---------|---------|---------|
| Unit test fixtures | Vitest factories — fake company names, fake IDs | `tests/fixtures/` |
| Contract test data | Seed via `scripts/seed.ts` against test Supabase project | Thornfield Capital demo scenario |
| E2E test users | Dedicated Clerk test accounts (E2E_CLERK_EMAIL env var) | Test environment only |
| Seed data | `scripts/seed.ts` — Thornfield Capital demo (5 blocks, 6 edges, 15 events) | Run manually against dev/test DB |

**Rules:**
- No real PII in any test data — fake company names, fake contact names, fake IDs
- Test fixtures are deterministic — same input, same output
- E2E test accounts never used in production or shared with design partners
- Seed script is idempotent — safe to run multiple times

---

## Load Testing Scenarios (Phase 2 — Before Production)

| Scenario | Users | Duration | Expected Behaviour |
|---------|-------|---------|-------------------|
| Steady state | 10 concurrent | 10 minutes | Error rate < 0.1%, p95 < 500ms |
| Spike | 50× normal for 60s | — | System recovers within 2 minutes; no data loss |
| Workflow engine under load | 100 concurrent workflow jobs | 5 minutes | No duplicate step execution; all complete or fail cleanly |

---

## Chaos Testing (Phase 2)

| Scenario | How to Simulate | Expected Behaviour |
|---------|----------------|-------------------|
| Claude API rate limited | Mock 429 response in test | Chat returns graceful error; no crash |
| Supabase connection drops | Kill DB connection mid-request | API returns 503; reconnects automatically |
| Workflow step server restart | Kill Vercel function mid-execution | Job stays in 'running'; manual recovery required (known limitation — Temporal fixes in Phase 2) |
| Duplicate Cron trigger | Fire workflow cron twice simultaneously | Only one job claimed (atomic UPDATE); no duplicate execution |

---

## Definition of Done by Level

| Level | Done When |
|-------|-----------|
| Unit test | Test runs, assertion checks real value (not just truthy), edge cases covered |
| Contract test | Real request to real Supabase, happy path + 2 error cases pass, org isolation verified |
| E2E test | User flow completes in real browser, no console errors, screenshot captured |
| Feature | All applicable gates (1–6) passed with real evidence in gate-results.md |
| Sprint | Gate 7 (architect sign-off) completed at sprint retro |
| Phase | All exit conditions in `sprints/phases.md` met with evidence |

---

## Acceptance Criteria Process

1. Backend engineer: Gate 3 (integration check) — real request to real endpoint, happy path + 2 error cases
2. Frontend engineer: Gate 4 (frontend quality) — 4 breakpoints, loading/empty/error states, accessibility
3. QA engineer: Gate 6 (peer review) for HIGH complexity tasks — reads implementation, confirms correctness
4. Orchestrator: Gate 7 at sprint retro — all tasks have gate evidence; phase exit conditions evaluated

---

## Archived

> Superseded testing requirements moved here. Never deleted.
