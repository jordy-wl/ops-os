# PRD Layer 01: Vision and Goals

> Last updated: 2026-03-02 | Author: Researcher | Status: DRAFT
> Cross-reference: `research/inputs/concept-brief-template.md` for full product context.

---

## Product Vision

A world where operations-heavy businesses have complete, real-time visibility and control over their entire business — with every decision traceable, every workflow automatable, and every piece of institutional knowledge captured in the system, not in people's heads.

---

## The Future State We're Creating

When Ops OS succeeds, here is what life looks like for the primary user:

- A Head of Operations at a global broker opens one screen and sees every active client onboarding, where each one is in the process, who owns the next step, and which ones are at risk — across London, New York, and Singapore simultaneously. No spreadsheets. No asking people.
- When a regulator asks "what was the status of Thornfield Capital's onboarding on March 15th?" — the answer is retrieved in 2 minutes from the immutable event timeline. No email archaeology. No spreadsheet version hunting.
- A new ops team member is productive in their first week because process knowledge lives in the system — workflows, approval rules, jurisdiction variants — not in the head of the most senior person on the team.
- Client onboarding that currently takes 15–30 business days takes 3–5. The saved time comes from eliminating coordination overhead between disconnected systems, not from working faster.

---

## Strategic Goals

| Goal | Metric | Target | Timeframe |
|------|--------|--------|-----------|
| Validate core primitives with real users | Capital markets design partners running a live workflow | 2–3 firms | Phase 1 (~3 months) |
| Prove measurable operational impact | Reduction in client onboarding time for ≥1 design partner | 15–30 days → 3–5 days | Phase 1 |
| Real transaction volume through the system | Events processed per design partner | ≥100 events each | Phase 1 |
| Establish first revenue signal | Design partners paying (nominal acceptable) | ≥1 partner at £500–5,000/month | Phase 1–2 boundary |
| Identify land-and-expand entry point | Validated via design partner interviews | Specific workflow confirmed | Phase 1 |

---

## Success Metrics per Goal

### Goal 1: 2–3 Capital Markets Design Partners Running a Live Workflow
- Primary metric: Number of design partners with ≥100 real events in the system
- Secondary metric: Design partner qualitative feedback on operational fit
- Measurement: Event count from Supabase events table + written feedback sessions
- Baseline: 0 (no design partners yet)

### Goal 2: Measurable Onboarding Time Reduction
- Primary metric: Days from client introduction to fully onboarded for ≥1 partner workflow
- Secondary metric: Hours of ops staff time per onboarding before vs. after
- Measurement: Partner-reported data; before/after at Phase 1 retro
- Baseline: 15–30 business days (industry average, per persona research)

### Goal 3: First Revenue Signal
- Primary metric: At least 1 partner paying or signed LOI ≥£500/month
- Secondary metric: Number of partners expressing willingness to pay (even before payment)
- Measurement: Signed agreements or written commitments
- Baseline: £0 (pre-revenue)

---

## Non-Goals (Phase 1)

| Not Building | Why Not | When |
|-------------|---------|------|
| No-code canvas / workflow builder | A product in its own right. Will take 6+ months to build safely. | Phase 2+ |
| Mobile app | Primary persona uses desktop; mobile adds 3–6 months of work | Phase 3+ or never |
| Third-party integrations (Salesforce, Xero, HubSpot) | Phase 1 proves primitives; integrations are an expansion motion | Phase 2 |
| Consumer or solo-freelancer use cases | Design mismatch; willingness to pay too low | Never |
| Enterprise (1,000+ employees) | Beyond bootstrap procurement and compliance capacity | Phase 3+ |
| SOC 2 Type II certification | Starts Phase 2 when first revenue signal exists | Phase 2 |
| Multi-region / APAC data residency | Required for APAC partners; verify Supabase Singapore support first | Phase 2 |

---

## Assumptions

| Assumption | Confidence | How We'll Validate | Phase |
|-----------|-----------|-------------------|-------|
| Capital markets ops leads will co-develop as design partners without requiring SOC 2 upfront | MEDIUM | Design partner outreach and qualification in Phase 1 | Phase 1 |
| Client onboarding is the highest-pain entry workflow for the primary persona | MEDIUM | Design partner interviews before Phase 2 planning | Phase 1 |
| Immutable audit trail is a hard requirement, not a nice-to-have | HIGH | Partner qualification questions; confirmed in persona research | Phase 1 |
| Ops leads will tolerate pre-built templates without a no-code canvas in Phase 1 | MEDIUM | Prototype feedback from design partners | Phase 1 |
| Postgres job queue is sufficient for 2–3 partners running <100 concurrent workflows | HIGH | Load testing in Sprint 2 | Phase 1 |
| AI confidence threshold of 1.0 (all actions require human approval) is acceptable for Phase 1 | MEDIUM | Design partner usage and feedback after 30 days | Phase 1 |

---

## Constraints

| Type | Constraint | Impact |
|------|-----------|--------|
| Budget | Bootstrap / pre-revenue. Supabase + Vercel free/hobby tiers. Claude API: target <$100/month at prototype scale. | Limits infra options; rules out Temporal, Redis, dedicated servers in Phase 1 |
| Team | Solo or very small team — context-switching between roles | Use Ops OS orchestration system to reduce cognitive overhead; agent roles strictly |
| Technical | No locked technical bets yet except event sourcing as core architecture | Workflow engine and graph model must be swappable before Phase 2 |
| Regulatory | Capital markets design partners operate under FCA (UK), SEC (US), MAS (Singapore), ASIC (Australia) | Data residency must be confirmed per jurisdiction before signing APAC partners |
| SOC 2 | Phase 1 partners must pilot with test/anonymised data until SOC 2 achieved | Negotiate design partner agreements accordingly |

---

## Connection to North Star

The north star for Phase 1 is: **"Design partners running real workflows with immutable event trails."**

If strategic goals are achieved — 2–3 capital markets partners, 100+ events each, measurable onboarding improvement — the north star moves from 0 to validated. This is the evidence base for Phase 2 funding decisions, expanded scope, and the case for the first paying customer.

Every sprint task in Phase 1 should be traceable to one of: proving the primitives work (Blocks, Events, Actions, Workflows, AI chat), or getting a design partner to use them.

---

## Archived

> Content moved here when superseded. Never deleted.
