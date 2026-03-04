# Phase Hypotheses

> Write hypotheses BEFORE each phase begins — not after.
> A hypothesis written after the fact is not a hypothesis, it's a justification.
> Duplicate this template for each phase. Orchestrator fills this during /plan-prd and /adjust-roadmap.

---

## How to Write a Good Hypothesis

**Formula:** "If we build [X], users will [Y], proving [Z]."

- **X** = the specific feature or capability being built
- **Y** = the specific measurable user behaviour we expect
- **Z** = the product or business assumption being validated

**Good:** "If we build a guided onboarding flow, 40% of new users will complete their first project within 7 days, proving that the core value action is understandable without support."

**Bad:** "If we build the MVP, users will use it and we'll learn things." (too vague, can't be falsified)

---

## Phase 1: Foundation & Primitive Validation

**Status:** ACTIVE
**Target date range:** 2026-03-02 — 2026-05-31 (Q2 2026)

### Hypothesis
If we build Blocks + Events + Actions data primitives, a Postgres-based workflow engine, Clerk multi-tenant auth, and a minimal AI chat interface, at least 2 capital markets design partners will run a live operational workflow through the system, proving the core BOS primitives are viable and worth investing in.

### What We're Assuming (Not Yet Proven)
- Capital markets ops leads will co-develop as design partners without SOC 2
- Client onboarding is the highest-pain entry workflow
- Ops leads will tolerate pre-built workflow templates (no visual builder) in Phase 1
- Postgres job queue handles 2–3 partners at <100 concurrent workflows

### How We're Testing the Assumption
- Design partner recruitment and qualification (target: 2–3 capital markets firms)
- Track event volume per partner (target: ≥100 real events each)
- Measure workflow completion rate (target: ≥90%)
- Qualitative feedback: "Would you be disrupted if we took this away?"

### Exit Condition
**TRUE when ≥2 distinct organisations each have ≥10 active workflow instances processed per week for 2 consecutive weeks, AND at least one is a capital markets design partner using a real operational workflow (not a demo).**

### Evidence Required to Call This Met
- Supabase query: ≥2 orgs with ≥10 `workflow_jobs.status = 'done'` in a 7-day window
- ≥1 design partner identified and actively using the system
- ≥50 real business events recorded across design partners
- Design partner verbal confirmation: "I would be disrupted if you took this away"

### What Failure Looks Like
If NOT met after 12 weeks:
- No partners recruited → pivot to alternative entry point; extend 4 weeks
- Partners recruited but not using → 3 user interviews; adjust scope
- Technical blockers → evaluate Temporal adoption earlier

### Key Decisions Unlocked by Proving This Hypothesis
- Safe to invest in composable workflow infrastructure (Phase 2)
- Safe to approach investors with validated design partner usage data
- Workflow entry point confirmed (onboarding vs. compliance vs. other)

---

## Phase 2: Composable Blocks & Workflow Engine

**Status:** FUTURE
**Target date range:** Q3 2026 (approximately 8–10 weeks)

### Hypothesis
If we add custom block type definitions, the workflow-as-block pattern (templates that spawn instances), human/agent task routing, event subscriptions, webhook triggers, and integration connectors, at least 1 design partner will create a custom workflow using the composable builder, and at least 1 letter of intent at ≥£500/month will be signed — proving that composable operations are a purchase driver for capital markets firms.

### What We're Assuming (Not Yet Proven)
- Custom block types are a purchase driver — ops leads want to define entity types without code changes
- Workflow composition (triggers + conditions + branching + task routing) is valued over simple linear workflows
- Human/agent task routing is a key differentiator vs. generic automation tools
- Workflow-as-block (templates are entities in the graph) enables operational intelligence that competitors can't match
- Integration connectors (inbound webhooks) are needed before paying customers will commit

### How We're Testing the Assumption
- Track custom block types created per org (target: ≥2 custom types per partner)
- Track workflow templates with ≥1 condition or branching node (target: ≥1 per partner)
- Track task_queue_item completion rate (target: ≥80% completed within SLA)
- LOI outreach: present composable workflow demo → ask for commitment
- Design partner interviews: "What would you build if you could define any workflow?"

### Exit Condition
**TRUE when ≥1 design partner has created a custom workflow template using the composable builder (with at least 1 condition or branching node), AND ≥1 signed LOI at ≥£500/month referencing workflow capabilities.**

### Evidence Required to Call This Met
- Supabase query: ≥1 org has a workflow_template Block with conditions or branching in data JSONB
- Signed LOI document at ≥£500/month
- ≥3 custom block types created by design partners (not seeded/demo)
- ≥10 task_queue_items completed by human routing

### What Failure Looks Like
If NOT met after 10 weeks:
- Partners don't create custom workflows → complexity too high; simplify builder UX
- Partners create workflows but won't sign LOI → pricing or value perception issue; run pricing interviews
- Task routing underused → investigate if route_human is too friction-heavy

### Key Decisions Unlocked by Proving This Hypothesis
- Safe to invest in visual workflow builder (React Flow canvas — Phase 3)
- Safe to build Salesforce/Xero connectors (validated integration demand)
- Agent AI investment justified (route_agent tasks prove AI automation demand)
- Revenue model validated; safe to build billing infrastructure

---

## Phase 3: Visual Builder & Integrations

**Status:** FUTURE
**Target date range:** Q4 2026 (approximately 8–10 weeks)

### Hypothesis
If we add a React Flow visual canvas for workflow composition, Salesforce/Xero integration connectors, document generation, agent AI processing, and operational intelligence (design vs reality analysis), at least 2 customers will convert to paying at ≥£2k/month — proving the product delivers enough value to sustain a business.

### What We're Assuming (Not Yet Proven)
- Visual canvas meaningfully increases workflow creation rate vs. form-based Phase 2 builder
- Salesforce/Xero connectors are needed for paying conversion (vs. webhook-only integrations)
- Operational intelligence (template vs. instance comparison) is a valued premium feature
- Agent AI can safely process simple tasks with acceptable error rates
- £2k/month is a sustainable price point for the primary persona

### How We're Testing the Assumption
- A/B: compare workflow creation rate with canvas vs. form-only (Phase 2 baseline)
- Track connector usage: which integrations are most requested/used
- Track operational intelligence adoption: how often users view design-vs-reality analysis
- Track agent automation rate: % of route_agent tasks processed without human escalation
- Conversion: 2 paying customers at ≥£2k/month

### Exit Condition
**TRUE when ≥2 paying customers at ≥£2k/month, each processing ≥50 workflow instances/week.**

### Evidence Required to Call This Met
- Stripe: 2 active subscriptions at ≥£2k/month
- Supabase: ≥50 workflow_instance Blocks with status='completed' per week per paying org
- At least 1 paying customer using a Salesforce or Xero connector
- Operational intelligence feature accessed ≥1x/week per paying org

### What Failure Looks Like
If NOT met after 10 weeks:
- Canvas built but no conversion → value is in composition, not visual builder; re-evaluate pricing
- Integrations unused → webhooks sufficient; deprioritise specific connectors
- Agent AI error rate too high → keep route_human only; revisit agent framework

### Key Decisions Unlocked by Proving This Hypothesis
- Safe to invest in production infrastructure (Temporal, SOC 2 — Phase 4)
- Revenue model repeatable; safe to pursue institutional funding
- Marketplace model viable (third-party workflow templates, integration connectors)

---

## Phase Hypothesis Change Log

If a phase hypothesis changes after the phase begins, log it here:

| Date | Phase | What Changed | Why | Approved By |
|------|-------|-------------|-----|------------|
| 2026-03-04 | 2 | "AI Layer & Workflow Configurability" → "Composable Blocks & Workflow Engine". Exit condition: "≥30% AI-routed actions" → "≥1 custom workflow + ≥1 LOI ≥£500/mo" | Whiteboard session validated composable workflows as purchase driver; AI autonomy premature without workflow infrastructure | PM + ORC |
| 2026-03-04 | 3 | "Integration Layer & Revenue" → "Visual Builder & Integrations". Exit condition: "≥1 paying ≥£2k/mo" → "≥2 paying ≥£2k/mo" | Canvas moved from Phase 4; raised bar to avoid single-customer risk | PM + ORC |
| 2026-03-04 | 4 | "Scale & Production Hardening" → "Scale, Revenue & Compliance". Temporal moved here from Phase 2. | Workflow-as-block handles Phase 2-3 scale; Temporal needed only at enterprise scale | PM + ORC |
