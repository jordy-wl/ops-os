# Build Learnings

> Append-only. Never edit existing entries.
> Engineers add entries here DURING tasks when reality differs from spec — not after the sprint.
> This is the primary signal source for PRD evolution.

---

## Schema

| Field | Values |
|-------|--------|
| Date | YYYY-MM-DD |
| Author Role | [ROLE] |
| Task ID | P[N]-S[N]-[ROLE]-[NUM] |
| Learning | 1-3 sentence description of what was discovered |
| PRD Section Challenged | prd/XX-name.md — Section: [section] — Assumption: [what it says] |
| Signal Strength | weak / moderate / strong |
| Status | PENDING / PROCESSED [date] |

**When to log:**
- Implementation diverges from PRD spec in any meaningful way
- A PRD assumption turns out to be incorrect or incomplete
- An API contract mismatch is discovered
- A performance or scalability issue is discovered that PRD didn't anticipate
- A user behaviour (from testing or release) differs from what PRD assumed

**Two or more entries challenging the same assumption = automatically becomes a strong signal.**

---

## Log

| Date | Author | Task ID | Learning | PRD Section | Strength | Status |
|------|--------|---------|---------|------------|---------|--------|
| 2026-03-02 | BACKEND-ENGINEER | P1-S2-BE-01 | workflow_jobs.started_at (Sprint 1 schema) maps to claimed_at in the Sprint 2 API contract. Implemented as an API-layer rename rather than a new DB column. If Temporal replaces this engine in Phase 2, the schema should be rationalised then. | prd/04-data-models.md — workflow_jobs schema | weak | PROCESSED 2026-03-04 — PRD-04 updated: field renamed to `claimed_at` with note |
| 2026-03-02 | BACKEND-ENGINEER | P1-S2-BE-01 | Sprint 1 migration comment listed status='completed' but Sprint 2 spec and API contract both say 'done'. Engine uses 'done'. No DB constraint exists so coexistence is safe but the ambiguity should be resolved in PRD-04 data model. | prd/04-data-models.md — workflow_jobs status enum | weak | PROCESSED 2026-03-04 — PRD-04 updated: clarified `done` is the canonical value |
| 2026-03-02 | BACKEND-ENGINEER | P1-S2-BE-01 | Vercel cron config (vercel.json) and WORKFLOW_ENGINE_SECRET env var are required before the workflow engine works in production. Neither is in scope for BE-01. Both need to land in OPS-01 or a follow-up task before DE-01 (production deploy). PRD-03 specifies 60s poll interval — not yet configured. | prd/03-system-architecture.md — Vercel Cron; prd/08-infra-devops.md | moderate | PROCESSED 2026-03-04 — PRD-03 updated with cron auth details; PRD-08 updated with CRON_SECRET + WORKFLOW_ENGINE_SECRET env vars. Both shipped in Sprint 3 BE-01. |
| 2026-03-02 | FRONTEND-ENGINEER | P1-S2-FE-01 | Sprint 1 left 3 lint warnings in `src/lib/__tests__/embeddings.test.ts` (unused vars: `makeSupabaseMock`, `insertErr`, `insertChain`). Also, 7 unit tests are currently failing in `context-assembly.test.ts` and `chat.test.ts` due to AI-01 extending `assembleContext` signature without updating existing tests. These failures pre-date FE-01 and are blocking a clean `npm test` run. | Sprint 2 gate discipline — engineers must update tests when changing function signatures | weak | PROCESSED 2026-03-04 — All lint warnings and test failures resolved in Sprint 3. No PRD change needed — discipline issue. |
| 2026-03-03 | ORCHESTRATOR | P1-S2-DE-01 | Primary design partner market confirmed as Australia (ASIC jurisdiction). PRD-08 specifies EU-West (Ireland) as the default Supabase region for FCA data residency — this assumption was incorrect. Supabase production project should be created in ap-southeast-2 (Sydney). PRD-03 and PRD-08 region references must be updated. Phase 4 multi-region plan (FCA/MAS/ASIC) remains valid — ASIC simply becomes primary instead of secondary. | prd/08-infra-devops.md — Section: Hosting & Compute — Assumption: Supabase EU-West (Ireland) for FCA data residency | moderate | PROCESSED 2026-03-04 — PRD-08 updated: primary region changed to APAC (ap-south-1) for ASIC; EU moved to Phase 4. |
| 2026-03-03 | DATA-ENGINEER | P1-S2-DE-01 | Design partner walkthrough acceptance criteria included "trigger onboarding workflow" and "≥5 real events" — both assumed a workflow trigger UI existed. FE-03 (Sprint 2) shows workflow status only; there is no trigger button. A proxy design partner session generated 1 event (block.created). The walkthrough script and acceptance criteria for any future design partner session must be revised to reflect what the UI actually supports. Sprint 3 should add a "Start Onboarding" action on the block detail page before scheduling a real partner session. | prd/06-frontend-spec.md — Section: Design Partner Onboarding — Assumption: workflow trigger accessible to end user | moderate | PROCESSED 2026-03-04 — PRD-06 updated: "Start Onboarding" button documented as Phase 1 primary trigger path. Sprint 3 FE-01 shipped this button. |
| 2026-03-10 | FRONTEND-ENGINEER | P2-S11-FE-03 | 6 shadcn/ui components were shipped as `.jsx` (no TypeScript types). When imported in `.tsx` files, `React.forwardRef()` without generic type params resolves to `ForwardRefExoticComponent<RefAttributes<any>>` — all custom props (children, className, orientation, etc.) become invisible. Required full rewrite to `.tsx` with proper generics. Future: never commit shadcn components as `.jsx` — always convert to `.tsx` immediately on scaffolding. | prd/03-system-architecture.md — Section: Frontend Tech Stack — Assumption: shadcn/ui components are ready-to-use | moderate | PROCESSED 2026-03-12 — 39 unused JSX files deleted in P2-S16. 4 remaining `.jsx` are shadcn library code. Not actionable for Phase 3. |

---

## Processing Protocol

**Researcher**: reviews PENDING signals during each sprint's `/evolve-prd signals` run.
**Orchestrator**: monitors for strong signals that require immediate roadmap attention.
**PM**: reviews at end of each sprint — strong signals that change phase hypotheses require PM decision.

---

## Signal Patterns

Recurring themes (researcher updates this section):

| Theme | Count | Impact | PRD Response |
|-------|-------|--------|-------------|
| workflow_jobs schema drift (naming, status enum) | 2 signals | PRD-04 field names/statuses didn't match implementation | RESOLVED — PRD-04 updated 2026-03-04 |
| Infrastructure auth gaps (cron secrets, env vars) | 1 signal | Workflow engine auth undocumented in PRDs | RESOLVED — PRD-03 + PRD-08 updated 2026-03-04 |
| Region assumption wrong (EU→APAC) | 1 signal | Primary market is ASIC/Australia, not FCA/UK | RESOLVED — PRD-08 updated 2026-03-04 |
| Missing workflow trigger UI | 1 signal | Design partner session blocked without trigger button | RESOLVED — FE-01 shipped button; PRD-06 updated 2026-03-04 |
