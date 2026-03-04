# North Star Metric — Ops OS

> The north star is the single number that captures whether the product is creating real value.
> If this number grows, the business grows. If it stagnates, nothing else matters.

---

## The North Star

**Metric:** Weekly Active Workflows — the number of unique workflow instances actively processed through Ops OS in a given week (events created, actions executed, or workflow steps completed by real users or AI routing).

**Why this metric:**
For a BOS targeting regulated operations, engagement is measured in workflow throughput, not page views. A capital markets firm "using" Ops OS means real client onboarding steps, compliance checks, and approval workflows passing through the system — not just logins. This metric grows only when Ops OS is genuinely embedded in daily operations. It predicts retention (workflows that run weekly become load-bearing) and expansion (more workflows = more teams using it = more seats).

**How to measure it:**
- **Phase 1:** Count distinct `workflow_job` rows with status `done` or `running` in the last 7 days, grouped by `org_id`.
- **Phase 2+:** Count distinct `workflow_instance` Blocks with status `active` or `completed` in the last 7 days (these are Blocks in the `blocks` table with `type = 'workflow_instance'`).
Sum across all orgs. Tracked via Supabase query and surfaced on an internal metrics dashboard.

---

## Choosing a Good North Star

A good north star metric:
- Reflects **value delivered to users**, not activity (e.g. "users who completed X" not "pageviews")
- Is **predictive** — if it grows, revenue will follow
- Is **actionable** — the team can influence it directly
- Is **specific** — not "engagement" but "users who do X at least once per week"

---

## Leading Indicators

These metrics predict north star movement. Monitor weekly.

| Indicator | What it measures | Target | Owner | Phase |
|-----------|-----------------|--------|-------|-------|
| Events created per org per week | Whether design partners are recording real business activity | ≥50 events/org/week by end of Phase 1 | Backend Engineer | 1 |
| Workflow completion rate | % of triggered workflows that reach completion (not `failed`) | ≥90% completion rate | Backend Engineer | 1 |
| AI routing queue size | How many actions are pending human review — high = under-staffed or misconfigured | <10 pending per org at any time | AI/ML Engineer | 1 |
| Active design partner count | How many orgs processed ≥1 workflow this week | ≥2 by Phase 1 exit, ≥5 by Phase 3 exit | PM | 1 |
| Time-to-first-workflow | Days from org creation to first completed workflow | <7 days for design partners | Frontend Engineer | 1 |
| Workflow templates created per org | Whether partners are composing custom workflows (not just using system templates) | ≥2 custom templates per partner by Phase 2 exit | Backend Engineer | 2 |
| Workflow instance completion rate | % of spawned workflow_instance Blocks that reach completed status | ≥85% completion rate | Backend Engineer | 2 |
| SLA compliance rate | % of task_queue_items completed before due_at | ≥80% on-time completion | Backend Engineer | 2 |
| Integration connector count per org | How many external connections are active | ≥1 active connector per paying org by Phase 3 | Backend Engineer | 2 |
| Agent automation rate | % of route_agent tasks processed without human escalation | ≥30% by Phase 3 exit | AI/ML Engineer | 3 |
| Custom block types per org | Whether orgs are defining their own entity types | ≥3 custom types per active org by Phase 2 exit | Backend Engineer | 2 |
| Operational intelligence usage | Frequency of design-vs-reality analysis views per org per week | ≥1x/week per paying org by Phase 3 exit | AI/ML Engineer | 3 |

---

## Success by Phase

| Phase | Target North Star Value | What This Proves |
|-------|------------------------|-----------------|
| Phase 1 | ≥2 orgs each running ≥10 active workflows/week | Core primitives work in production with real design partners |
| Phase 2 | ≥1 custom workflow template per partner + ≥1 LOI ≥£500/mo | Composable operations are a purchase driver |
| Phase 3 | ≥2 paying customers at ≥£2k/month each processing ≥50 workflow instances/week | Visual builder + integrations drive paying conversion |
| Phase 4 | ≥5 paying customers, north star growing MoM, SOC 2 in progress | Repeatable GTM, production-grade infrastructure |

---

## Anti-Metrics

| Metric | Why We're Not Optimising For It |
|--------|---------------------------------|
| Total user sign-ups / registrations | Vanity metric — empty orgs with no workflows contribute nothing |
| Page views / session duration | Ops OS should be efficient, not engaging in a time-on-site way |
| Number of Blocks created | Blocks with no events and no workflows = hoarding, not usage |
| AI API call count | API calls without human-approved actions = cost without value |

---

## Metric Ownership

| Metric | Owner Role | Where It's Tracked | Review Cadence |
|--------|-----------|--------------------|----------------|
| North Star (weekly active workflows) | Product Manager | Internal Supabase dashboard | Weekly |
| Events created per org | Backend Engineer | Supabase query on `events` table | Weekly |
| Workflow completion rate | Backend Engineer | Supabase query on `workflow_jobs` | Weekly |
| Active design partner count | PM | Shared spreadsheet / Supabase | Weekly |
| Time-to-first-workflow | Frontend Engineer | Supabase `workflow_jobs` + `orgs` join | Per new org |

---

## Instrumentation Requirements

| Metric | Event Name | Where Fired | Properties Needed |
|--------|-----------|-------------|-------------------|
| Weekly active workflows | `workflow.completed` | Backend — workflow runner | `workflow_type`, `org_id`, `duration_ms`, `step_count` |
| Events created | `event.created` | Backend — events API | `event_type`, `block_id`, `org_id`, `actor_type` |
| AI routing queue | `action.routed_to_human` | Backend — AI routing layer | `action_type`, `confidence_score`, `risk_score`, `org_id` |
| Time-to-first-workflow | `org.first_workflow_completed` | Backend — derived event | `org_id`, `days_since_creation` |

> Backend engineer implements instrumentation in Sprint 1 (events table) and Sprint 2 (workflow + AI routing events).
> See `prd/09-data-pipeline.md` for pipeline that processes these events.
