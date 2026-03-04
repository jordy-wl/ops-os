# Sprint 3 — Researcher Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-RES-01 | Process Sprint 2 Build Signals — PRD Updates | OPEN | LOW | 1 | none |

**Day-1 recommendation:** RES-01 is fully unblocked and independent. Process the signals while engineers are building — the PRD corrections don't affect Sprint 3 implementation, but they are blocking input for Phase 4 infra planning.

---

## P1-S3-RES-01: Process Sprint 2 Build Signals — PRD Updates

**Description:** Six signals in `research/signals/build-learnings.md` are marked PENDING from Sprint 2. Two of them challenge the same PRD section — that meets the strong signal threshold and requires immediate PRD update. Process all relevant signals, update the PRDs, and mark signals as PROCESSED.

---

### Signals to Process

Read `research/signals/build-learnings.md` in full before starting. Here is the summary:

| # | Date | Strength | PRD Section | Action Required |
|---|------|----------|-------------|----------------|
| 1 | 2026-03-02 | weak | prd/04-data-models.md — workflow_jobs schema | Update column name and API field naming note |
| 2 | 2026-03-02 | weak | prd/04-data-models.md — workflow_jobs status enum | Update status enum to 'done' (not 'completed') |
| 3 | 2026-03-02 | moderate | prd/03-system-architecture.md + prd/08-infra-devops.md | Add vercel.json cron config and WORKFLOW_ENGINE_SECRET to deploy artifacts |
| 4 | 2026-03-02 | weak | None (process signal) | No PRD update — log as process note in retro |
| 5 | 2026-03-03 | moderate | prd/08-infra-devops.md — region assumption | Update primary region to ap-southeast-2 (Sydney, ASIC) |
| 6 | 2026-03-03 | moderate | prd/06-frontend-spec.md — design partner walkthrough | Add workflow trigger UI as pre-condition for partner sessions |

**Strong signal:** Signals 1 + 2 both challenge `prd/04-data-models.md` — same file, same table. This is the two-signal strong threshold. Prioritise this update.

---

### PRD Update Instructions

For each PRD you edit, add a changelog entry at the bottom of the relevant section:

```markdown
> [Updated 2026-03-03 by RESEARCHER — signal P1-S2-BE-01: {brief reason}]
```

---

#### Update 1 — prd/04-data-models.md

Find the `workflow_jobs` table definition. Apply:

1. **Column name:** Note that the Sprint 1 schema uses `started_at` for the timestamp of when the engine claimed the job. The Sprint 2 API contract exposes this field as `claimed_at` (mapped at the API layer). Clarify both names in the data model:
   - DB column: `started_at` (do not rename — migration cost)
   - API field: `claimed_at` (mapped in GET /api/workflow-jobs)
   - Add a note: "The API renames `started_at` to `claimed_at` for semantic clarity. If Temporal is adopted in Phase 4, rationalise to a single name at migration time."

2. **Status enum:** Update the status values from any mention of `'completed'` to `'done'`. The authoritative values are: `pending | running | done | failed`. If any PRD text says `'completed'`, correct it.

---

#### Update 2 — prd/08-infra-devops.md + prd/03-system-architecture.md

1. **Region:** Update primary Supabase region from `eu-west-1` (Ireland, FCA) to `ap-southeast-2` (Sydney, ASIC). Note: "Primary design partner confirmed as Australian capital markets firm. ASIC data residency is now primary. FCA (eu-west-1) and MAS (ap-southeast-1) remain in the Phase 4 multi-region plan as secondary targets."

2. **Vercel cron + secret:** Add to the deploy artifacts section:
   - `vercel.json` — cron schedule for `/api/workflow-engine/process` at `* * * * *`
   - `WORKFLOW_ENGINE_SECRET` env var — must be set in Vercel environment (see .env.example)
   - Note the fail-closed behaviour: absent env var rejects all cron callers

---

#### Update 3 — prd/06-frontend-spec.md

Find the design partner onboarding or walkthrough section. Add a **pre-condition** block before the walkthrough steps:

```
Pre-conditions for design partner walkthrough:
- Workflow trigger UI (FE) must be deployed to production before scheduling any partner session
- Vercel cron must be active and WORKFLOW_ENGINE_SECRET must be set
- Without the trigger UI, a partner cannot run a workflow — the session will fail at step 3
```

Also update any walkthrough step that says "trigger onboarding workflow" to reference the "Start Client Onboarding" button on the block detail page.

---

#### Signal 4 (process, no PRD update)

The pre-existing lint debt signal does not require a PRD update. Add a note in the `Signal Patterns` section of build-learnings.md:

```markdown
| Pre-existing test/lint debt | 1 | Surfaced by CI setup — fix during the task that touches the file | PROCESS ONLY — no PRD update |
```

---

### Marking Signals Processed

After completing PRD updates, edit `research/signals/build-learnings.md` and update each processed signal's Status column from `PENDING` to `PROCESSED 2026-03-03`.

---

**Acceptance Criteria:**
- [ ] prd/04-data-models.md updated: started_at / claimed_at naming clarified; status enum is 'done' not 'completed'
- [ ] prd/08-infra-devops.md updated: primary region ap-southeast-2; vercel.json + WORKFLOW_ENGINE_SECRET in deploy artifacts
- [ ] prd/03-system-architecture.md updated: cron config reference added
- [ ] prd/06-frontend-spec.md updated: trigger UI pre-condition added to design partner walkthrough
- [ ] All updated PRD sections include `[Updated YYYY-MM-DD by RESEARCHER — signal: ...]` entry
- [ ] Signals 1–6 marked `PROCESSED 2026-03-03` in build-learnings.md
- [ ] Signal patterns table in build-learnings.md updated with Sprint 2 themes

**Applicable Gates:** none (researcher role — documentation only)
**Owner once claimed:** RESEARCHER

---

## Files You Will Touch

| File | Change |
|------|--------|
| `research/signals/build-learnings.md` | EDIT — mark signals PROCESSED, update patterns table |
| `prd/04-data-models.md` | EDIT — workflow_jobs schema naming + status enum |
| `prd/08-infra-devops.md` | EDIT — region + deploy artifacts |
| `prd/03-system-architecture.md` | EDIT — cron config reference |
| `prd/06-frontend-spec.md` | EDIT — design partner walkthrough pre-conditions |

---

## Researcher Standards Reminder

- Researcher edits PRDs with changelog entries — never silently overwrites
- Signal processing is append-only in build-learnings.md — mark PROCESSED, do not delete
- PRD changes that affect phase hypotheses must be flagged to PM before writing
- Region change is within researcher authority (factual correction) — no PM sign-off needed
