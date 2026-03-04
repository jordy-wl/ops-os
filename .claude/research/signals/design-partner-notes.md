# Design Partner Notes — Sprint 2

> Walkthrough session: 2026-03-03
> Facilitator: Orchestrator / Product Owner (proxy design partner)
> Environment: Production — https://ops-os-gamma.vercel.app
> Org: `org_3AQGS4rMy4Zc4YQyTstKUrJECjN` (Clerk)

---

## Session Summary

The product owner acted as proxy design partner for the Sprint 2 walkthrough,
representing the primary persona: Global Operations Lead at a capital markets /
financial services firm.

**Flow tested:**
- [x] Signed up via Clerk — production auth working
- [x] Clerk org provisioned automatically in `orgs` table (withAuth auto-provision)
- [x] Created first Block on production
- [x] Tested AI chat on production
- [ ] Triggered onboarding workflow — not accessible via UI (FE-03 shows status only)
- [ ] Viewed full event timeline — limited events at this stage

**Bugs encountered and fixed during session:** Yes (minor, resolved by operator)
**Overall verdict:** Core primitives working on production. Sign-up flow is smooth.
Block creation works. Chat responds correctly.

---

## Feedback (Proxy Design Partner)

> "The sign-up and block creation flow works cleanly. Chat is responsive.
> The main gap is that there's no way to trigger a workflow from the UI yet —
> the workflows page shows status but you can't kick one off. For a real demo
> this would need a 'Start Onboarding' button on the block detail page."

---

## Observations for Sprint 3

1. **Workflow trigger UI is the #1 missing piece** for a meaningful design partner
   demo. A real partner would expect to initiate a workflow from the block detail
   page, not via a manual API call.

2. **Event timeline is sparse** without the workflow engine running — a partner
   signing up and creating a block generates only 1 event. The timeline needs
   workflow engine events to feel like a real audit trail.

3. **Org name not synced from Clerk** — the `orgs.name` field is `null` for the
   partner's org. The app needs a Clerk webhook or sign-in hook to populate this
   from the Clerk organisation name.

4. **No "getting started" guidance** — blank workspace after sign-up is disorienting.
   A brief onboarding prompt or empty state with a "Create your first Block" CTA
   would help a real partner know what to do next.

---

## Sprint 3 Implications

- Add "Start Workflow" action to block detail page (routes to POST /api/actions/onboarding.start)
- Populate `orgs.name` from Clerk org metadata on first sign-in
- Empty state improvements across blocks list and dashboard
- Real design partner recruitment: target 1 capital markets contact for a live session
  using the Sprint 3 build

---

## Phase 1 Exit Condition Status

| Condition | Status |
|-----------|--------|
| ≥2 orgs with ≥10 workflow_jobs done in 7 days | NOT MET — 0 workflow jobs in partner org |
| ≥1 capital markets design partner using system | PARTIAL — proxy session only |
| ≥50 real business events across partners | NOT MET — 1 event |
| Design partner verbal confirmation | NOT MET — proxy session |

Phase 1 exit conditions not met. Sprint 3 target: real partner session with workflow
trigger UI available.
