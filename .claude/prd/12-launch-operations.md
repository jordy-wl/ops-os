# PRD Layer 12: Launch and Operations

> Last updated: 2026-03-02 | Author: PM + DevOps Engineer | Status: DRAFT
> Cross-references: `prd/08-infra-devops.md` (deployment pipeline), `prd/11-testing-strategy.md` (testing gates).

---

## Launch Strategy

**Approach:** Design partner — not a public launch. Phase 1 is a private prototype with 2–3 invited capital markets design partners. No public signup, no waitlist, no marketing in Phase 1.

| Phase | Users | Duration | Criteria to Advance |
|-------|-------|---------|---------------------|
| Internal (founder only) | 1 user (founder) | Sprint 1–2 | Core primitives working: Blocks, Events, Actions, basic Workflow, AI chat |
| Design partner pilot | 2–3 capital markets firms | Sprint 3–5 (3–4 months) | ≥100 events per partner, measurable onboarding improvement, ≥1 willing to pay |
| Closed beta | 5–10 additional firms (by referral) | Phase 2 | Phase 1 exit conditions met; workflow engine migrated to Temporal |
| General availability | Open access | Phase 3+ | SOC 2 Type II completed; production-grade infrastructure |

---

## Phase 1 Launch Checklist

All of these must be complete before onboarding the first design partner to production:

### Infrastructure
- [ ] Vercel production deployment live and verified (health check passes)
- [ ] Supabase production project configured (EU-West region)
- [ ] Supabase migrations applied to production
- [ ] All environment variables set in Vercel production
- [ ] Vercel Pro plan (or Edge Runtime configured) — required for streaming AI chat
- [ ] Resend email configured and verified domain

### Product
- [ ] Core user flows working: Dashboard, Block Detail, Chat, Create Block, Trigger Workflow
- [ ] At least one complete workflow template configured (client onboarding — London/FCA)
- [ ] Events displaying correctly in timeline with correct timestamps
- [ ] AI chat responding with business graph context (not generic responses)
- [ ] Semantic search returning relevant results
- [ ] All 4 breakpoints tested (375px, 768px, 1280px, 1920px)
- [ ] Loading states, empty states, and error states implemented on all screens

### Security and Compliance
- [ ] Event immutability verified: RLS policies applied + contract tests passing
- [ ] Org isolation verified: cross-org contract tests passing
- [ ] `withAuth` middleware on all API routes (security scan passes)
- [ ] No PII in Vercel logs (log scan passes)
- [ ] No secrets committed to git (pre-commit scan)
- [ ] All production secrets rotated (not reused from dev/preview)
- [ ] Supabase RLS policies enabled on all tables

### Design Partner Onboarding
- [ ] Design partner firm created in Supabase (`orgs` table)
- [ ] Clerk organisation created for the firm
- [ ] Design partner ops lead invited to Clerk org
- [ ] At least one workflow template pre-configured for their jurisdiction
- [ ] Onboarding walkthrough completed with partner (30-min call)
- [ ] Feedback session scheduled (4 weeks after go-live)

---

## Pre-Launch Security Review

Before each design partner onboards:

| Check | How to Verify | Owner |
|-------|--------------|-------|
| Event immutability | Run contract tests against production DB | DevOps |
| Org isolation | Run cross-org contract tests against production | DevOps |
| Secret scan | `git log --all` + `grep -r "sk-"` scan | DevOps |
| RLS policies | `SELECT * FROM pg_policies` in Supabase | DevOps |
| Auth on all routes | Code review of all `/api/` routes | Backend Engineer |
| No PII in logs | Trigger test actions, check Vercel log drain | QA |

---

## Monitoring (Phase 1)

**Monitoring approach:** Manual. Founder checks dashboards daily during design partner pilot.

| What to Monitor | Tool | Where | Frequency |
|----------------|------|-------|-----------|
| Application errors | Vercel error dashboard | vercel.com/[project] | Daily |
| API response times | Vercel analytics | vercel.com/[project] | Daily |
| Database size | Supabase dashboard | supabase.com/[project] | Weekly |
| Workflow job failures | SQL query on workflow_jobs | Supabase SQL editor | Daily |
| AI API costs | Anthropic dashboard + OpenAI dashboard | Console | Daily |
| Event volume per partner | SQL query on events table | Supabase SQL editor | Weekly |

**Useful monitoring queries:**
```sql
-- Events per partner per day
SELECT org_id, DATE(occurred_at), COUNT(*)
FROM events
GROUP BY org_id, DATE(occurred_at)
ORDER BY 2 DESC, 3 DESC;

-- Failed workflow steps
SELECT workflow_type, step_name, COUNT(*), MAX(error)
FROM workflow_jobs
WHERE status = 'failed'
GROUP BY workflow_type, step_name;

-- Events with no embedding (embedding pipeline health)
SELECT COUNT(*)
FROM events e
LEFT JOIN embeddings em ON em.source_id = e.id AND em.source_type = 'event'
WHERE em.id IS NULL
AND e.occurred_at > NOW() - INTERVAL '1 hour';
```

**Cost alerts:**
- Anthropic: set billing alert at $50/day
- OpenAI: set billing alert at $10/day
- Supabase: watch database size; upgrade to Pro at 400MB

---

## Rollback Criteria

Trigger an immediate rollback or intervention if:
- Any event is found to have been modified or deleted (audit trail integrity failure)
- Cross-org data access detected (org isolation failure)
- Error rate > 5% for more than 10 minutes
- AI chat returning responses from a different org's data (prompt contamination)
- Any secret found in logs or committed to git

**Rollback steps (application):**
1. Vercel dashboard → project → deployments → click previous deployment → "Promote to Production"
2. Time: ~2 minutes

**Rollback steps (database):**
- Bad migration: `supabase migration repair` in GitHub Actions → coordinate with team
- Do NOT drop and recreate tables — immutable events must be preserved

---

## Design Partner Communication

| Event | Channel | Message | Timing |
|-------|---------|---------|--------|
| Onboarding | Email + call | Welcome, setup walkthrough, feedback cadence | Day 0 |
| Weekly check-in | Email or call | Usage summary, any issues, next steps | Weekly for first month |
| System maintenance | Email | Planned downtime (if any), duration, impact | 48 hours before |
| Incident | Email | What happened, impact, resolution, what we changed | Within 4 hours of resolution |
| 4-week feedback session | Call | Structured interview: what's working, what's not, willingness to pay | Week 4 |

**Partner communication SLA (Phase 1):** Respond to partner-reported issues within 2 hours during London business hours (9am–6pm GMT). After hours: next business day unless critical (system down).

---

## Support Runbook

Common partner issues and resolution:

| Issue | Symptoms | Diagnosis | Resolution |
|-------|---------|-----------|-----------|
| Can't sign in | Auth error / blank screen | Clerk dashboard → check org membership | Add user to Clerk org; resend invite |
| Workflow stuck | Step shows 'running' for >30 min | SQL: query workflow_jobs WHERE status = 'running' | Manually update to 'failed'; re-trigger workflow |
| AI chat not responding | Timeout or error | Check Vercel function logs; check Anthropic dashboard | Check API key; check function timeout (Edge Runtime?) |
| Events not showing | Timeline empty | SQL: query events WHERE org_id = ? | Check org_id mapping; check RLS policies |
| Embedding search returning wrong results | Search results irrelevant | Check embeddings table; re-run embedEvent() | Trigger re-embedding for affected blocks |
| Wrong jurisdiction workflow | Partner triggered wrong template | Events show incorrect workflow_type | Create correct workflow job; void incorrect one with a status change event |

---

## Success Metrics for Phase 1 (30-day review)

| Metric | Target | Source | Review Cadence |
|--------|--------|--------|----------------|
| Design partners onboarded | 2–3 firms | Supabase orgs table | At Phase 1 retro |
| Events per partner | ≥ 100 | SQL query on events | Weekly |
| Onboarding time reduction (at least 1 partner) | 15–30 days → 3–5 days | Partner interview | 4-week session |
| Partners expressing willingness to pay | ≥ 1 | Written/verbal commitment | Phase 1 retro |
| AI chat queries that result in action approval | >60% (proxy for useful responses) | SQL on ai.routing_decision events | Weekly |
| System uptime (partner hours) | >99% | Vercel analytics | Weekly |
| Critical bugs (data integrity, security) | 0 | Monitoring + partner reports | Daily |

---

## Post-Launch Review Process

**4-week design partner session:** PM runs structured interview. Researcher documents findings as signals. Key questions:
1. What workflow did you run through Ops OS?
2. What would you have done instead?
3. Where did it feel faster / slower than before?
4. What's missing that would make you pay for this?
5. Who else at your firm would use this?

**Phase 1 retro (orchestrator):** At Phase 1 exit, orchestrator runs `/sprint-retro` and evaluates phase exit conditions:
- ≥ 2 design partners with ≥ 100 events each: YES / NO
- ≥ 1 partner expressed willingness to pay: YES / NO
- Measurable onboarding improvement documented: YES / NO

If all three: Phase 2 begins. If not: extend Phase 1 with adjusted scope.

---

## Ongoing Operations Model (Phase 1)

| Function | Owner | Cadence |
|---------|-------|---------|
| Monitoring dashboard check | Founder | Daily |
| Design partner check-in | PM / Founder | Weekly |
| Dependency security scan | DevOps | Monthly |
| AI cost review | AI/ML Engineer | Weekly |
| Event immutability audit | DevOps | Monthly (query Supabase audit logs) |
| User feedback review | Researcher | After each design partner session |
| Shared-state.md review | Orchestrator | Start of each sprint |

---

## Archived

> Superseded launch plans moved here. Never deleted.
