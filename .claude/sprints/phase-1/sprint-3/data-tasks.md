# Sprint 3 — Data Engineer / Orchestrator Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-DE-01 | Real Design Partner Onboarding | OPEN | HIGH | ongoing | FE-01, BE-01 (both DONE + deployed to prod) |

**Critical prerequisite:** DO NOT start partner scheduling until you have confirmed:
- P1-S3-FE-01 is DONE and the trigger button is live on the production URL (https://ops-os-gamma.vercel.app)
- P1-S3-BE-01 is DONE and vercel.json cron is deployed and firing in production (check Vercel cron logs)

Running a partner session without the trigger UI would repeat the Sprint 2 proxy session failure.

---

## P1-S3-DE-01: Real Design Partner Onboarding

**Description:** Recruit and onboard a real external capital markets design partner. Sprint 2 ran a proxy session that proved the system works mechanically. Sprint 3 must get a real person from a capital markets firm through a live session. This is a Phase 1 exit condition — it cannot be simulated again.

---

### Pre-Session Checklist

Before booking any partner session, confirm all items:

- [ ] P1-S3-FE-01 DONE + deployed: "Start Client Onboarding" button visible on block detail at production URL
- [ ] P1-S3-BE-01 DONE + deployed: vercel.json cron is active (check Vercel dashboard → Cron Jobs tab)
- [ ] `WORKFLOW_ENGINE_SECRET` set in Vercel environment variables
- [ ] Production Supabase (xanokdlsnrnzyhtfohpd) is healthy: `GET /api/health` → 200
- [ ] Thornfield demo scenario seed is present (or partner will create their own blocks from scratch — both fine)

---

### Partner Recruitment

**Target profile:** Contact at a capital markets firm — broker-dealer, asset manager, fund administrator, wealth management firm, or similar. Size: 10–500 employees. Geography: Australia preferred (ASIC), UK/SG acceptable.

**Outreach criteria:**
- Real operational workflow complexity (client onboarding, compliance checks, deal tracking)
- Decision-maker or operations lead — not a developer
- Willing to spend 30–45 minutes in a live session

---

### Revised Walkthrough Script (Sprint 3)

The Sprint 2 walkthrough script is obsolete — it assumed a trigger UI that didn't exist. Use this revised script:

**Session structure (30–45 minutes):**

1. **Sign-up (5 min)**
   - Partner navigates to https://ops-os-gamma.vercel.app
   - Creates a Clerk account + org (their real firm name)
   - Confirm: org created in production, visible in Supabase

2. **Create a client block (5 min)**
   - Navigate to `/blocks`
   - Create a client block: real client name (or "Test Client" if they prefer), jurisdiction AU
   - Confirm: block appears, events timeline shows `block.created`

3. **Trigger onboarding workflow (5 min)**
   - Navigate to the client block detail page
   - Click "Start Client Onboarding" button
   - Confirm: toast appears, redirected to `/workflows`
   - Watch: workflow job status transitions from `pending` → `running` → `done` (within ~1 min via cron)

4. **View events timeline (5 min)**
   - Navigate back to the client block detail
   - Show: `document.requested`, `kyc.check.started`, `aml.check.started` events populated
   - Prompt: "These are the same steps your team would log manually in a spreadsheet or email"

5. **Chat with AI (10 min)**
   - Navigate to `/chat`, select the client block as context
   - Ask: "What's the status of [client name]'s onboarding?"
   - Ask: "What does a typical onboarding look like for a new client in Australia?"
   - Let partner ask their own question

6. **Collect feedback (10 min)**
   - "What would make this useful for your day-to-day work?"
   - "What's missing that you'd expect to see?"
   - "On a scale of 1–10, how disruptive would it be if this didn't exist?"
   - Record or note verbatim responses

---

### Output Requirements

After the session, write `.claude/research/signals/design-partner-notes.md`:

```markdown
# Design Partner Notes — Sprint 3

**Date:** [date]
**Session type:** Live walkthrough (real partner / external)
**Org type:** [e.g. "mid-size Australian wealth manager"] — anonymise to org type, not name
**Walkthrough steps completed:** [1–6 / partial]
**Events generated:** [count from Supabase query]

## What They Tried
[summary of what they did, not who they are]

## Feedback Themes
[bullet points of what they said — use quotes where possible, anonymised]

## Disruption Score
[their 1–10 answer, or "not asked"]

## Blockers / Confusion Points
[anything they got stuck on]

## Signal for PRD
[any assumptions the session challenged — log these to build-learnings.md too]
```

**Anonymisation rule:** No real names, firm names, or contact details in any repo file. Use org type + jurisdiction only (e.g. "Australian wealth manager, 50–100 employees").

---

**Acceptance Criteria:**
- [ ] ≥1 real external capital markets contact (not proxy, not team member) completes the walkthrough
- [ ] Partner completes all 5 session steps (sign-up → create block → trigger workflow → view events → ask AI)
- [ ] ≥5 real events recorded in production `events` table for the partner's org
- [ ] design-partner-notes.md written and committed to `research/signals/`
- [ ] Verbal or written disruption score or feedback summary captured
- [ ] Partner has not said "I would not use this" (red flag — escalate to PM immediately if so)

**If no real partner available by Day 8:**
- Log a blocker in shared-state.md: "DE-01 BLOCKED — no partner confirmed. Day 8 deadline passed."
- Escalate to orchestrator — do NOT run another proxy session without PM approval
- Orchestrator will decide: extend sprint, adjust phase hypothesis, or proceed to PM pivot

**Applicable Gates:** 5, 6 (HIGH — QA-ENGINEER reviews partner notes for completeness)
**Owner once claimed:** ORCHESTRATOR (coordination) + DATA-ENGINEER (infrastructure verification)
