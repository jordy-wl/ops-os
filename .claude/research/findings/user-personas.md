# User Personas — Ops OS

> Researcher: populated 2026-03-02. Derived from concept brief, competitive analysis, and industry knowledge.
> Validation status: HYPOTHETICAL — these personas must be validated with real user interviews before PRD lock.
> Recommended: 5 user interviews per persona before Sprint 1 begins.

---

## Research Methodology

| Item | Status |
|------|--------|
| Persona derivation method | Concept brief + competitive analysis + industry pattern matching |
| Interviews conducted | 0 — VALIDATION REQUIRED before PRD |
| Survey data | None yet |
| Proxy validation | Industry knowledge: capital markets ops patterns, professional services ops patterns |
| Recommended validation | 3–5 interviews per persona; LinkedIn outreach to "Head of Operations" + "Capital Markets" |

---

## Primary Persona — The Global Operations Lead at a Capital Markets / Financial Services Firm

### Demographics & Role

| Field | Value |
|-------|-------|
| Job titles | Head of Operations, COO, Head of Client Services, Compliance Operations Manager, Chief of Staff |
| Company type | Global broker, capital markets technology provider, prime brokerage, fund administrator, financial services firm |
| Company size | 50–500 employees |
| Jurisdictions | Multi: typically London + US + APAC (Singapore, Hong Kong, Sydney) |
| Tech savviness | Moderately technical — evaluates and configures software; not a developer |
| Annual budget authority | £50k–£500k for operations tooling |

### Jobs-to-Be-Done

1. **Know what's happening with every client, in every jurisdiction, right now** — without asking 3 different people or checking 4 systems
2. **Prove compliance** — when a regulator asks "what was the state of this client onboarding on March 15th?" be able to answer in minutes, not days
3. **Onboard new ops staff quickly** — the "how things work" knowledge should be in the system, not in people's heads
4. **Route the right tasks to the right people** — in London, Singapore, and New York, with different approval rules per jurisdiction
5. **Generate client-facing reports and status updates** without spending half a day assembling them from disparate systems

### Current Workflow (The Problem State)

```
Client onboarding at a global broker today:

1. Relationship Manager receives new client → logs in Salesforce
2. Ops team creates a "project" in Monday.com
3. Compliance sends KYC checklist via email
4. Legal drafts agreement in Word, stored in SharePoint
5. Finance sets up billing in Xero
6. IT provisions access in separate ticketing system
7. Each jurisdiction has a different version of steps 1-6
8. Status updates: someone manually emails all parties every week
9. If regulator asks for audit: manually reconstruct from email threads + spreadsheet versions
```

**Time wasted:** 15–25 hours per client onboarding due to coordination overhead
**Error rate:** High — data entry duplication across systems
**Onboarding time:** 15–30 business days (industry average); could be 3–5 with proper tooling

### Pain Points (Priority Order)

1. **No single source of truth** — "who owns this?" is answered differently by every system
2. **No audit trail** — compliance requests are a nightmare; nothing is provably immutable
3. **Multi-jurisdiction configuration** — the same onboarding workflow needs 8–12 variations; maintaining them is a full-time job
4. **Role ownership ambiguity** — "who approves the AML check in Singapore?" is answered by asking people, not by the system
5. **Manual status reporting** — senior ops staff spend significant time manually aggregating status across systems for weekly reports
6. **Tribal knowledge** — when a senior ops person leaves, institutional knowledge walks out the door

### Willingness to Pay

**HIGH.** Capital markets firms spend £100k–£500k/year on compliance and operations systems. A tool that genuinely solves audit trail + multi-jurisdiction workflow would be valued at:
- £2,000–£8,000/month for a 50-person firm
- £10,000–£30,000/month for a 200-person firm
- Enterprise deals up to £100k/year for firms with complex regulatory requirements

The ROI is clear: one compliance audit that takes 30 hours without Ops OS vs. 2 hours with = significant cost savings at £200–500/hour for senior ops staff.

### Evaluation Criteria (What They Buy On)

1. **Auditability** — immutable history is a must-have, not nice-to-have
2. **Configurable without IT** — ops lead must be able to build and modify workflows
3. **Role-based access per jurisdiction** — not just RBAC but jurisdiction-aware permissions
4. **Integration with existing tools** — must read from Salesforce; write to compliance systems
5. **Security and data residency** — FCA/MAS/ASIC requirements for where data lives
6. **Proof of adoption at similar firms** — will ask for references before buying

### Key Quote (Hypothetical — validate with interviews)
> "I can describe our client onboarding process in about 20 minutes of talking. But if you ask me to show it to you in our systems, I'd need 4 browser tabs and a spreadsheet. That's the problem."

### Research Notes / Open Questions

- **Land-and-expand entry point:** Client onboarding is likely the highest-pain workflow (15–30 days, multi-system, compliance requirements). Alternative entry: trade lifecycle ops or fund reporting workflows. Validate with interviews.
- **Sales cycle concern:** Enterprise capital markets = 6–12 month sales cycles. Bootstrap stage = we need design partners willing to co-develop. The pitch must be "build this with us" not "buy this."
- **SOC 2 requirement:** Most firms will require SOC 2 Type II before production use. This is a 6–12 month process. Flag as a constraint for roadmap planning.

---

## Secondary Persona A — The Ops-Bottlenecked Founder / RevOps Lead (Professional Services)

### Demographics & Role

| Field | Value |
|-------|-------|
| Job titles | Operations Manager, RevOps Lead, Chief of Staff, Founder (ops responsibility), Agency Director |
| Company type | Agency (creative, marketing, PR, consulting), law firm, management consultancy, accountancy firm |
| Company size | 10–50 employees |
| Jurisdictions | Single jurisdiction typically, occasionally 2 |
| Tech savviness | Moderately technical — comfortable with SaaS tools; not a developer |
| Annual budget authority | £5k–£50k for operations tooling |

### Jobs-to-Be-Done

1. **Answer "where are we with client X?" in 30 seconds** without digging through Slack, email, and project tools
2. **Stop re-entering the same data in 3 different systems** when a new client is signed
3. **Automate the repetitive parts** — proposal → contract → onboarding → delivery → invoice — without Zapier breaking
4. **Give leadership a live dashboard** of client health, project status, and revenue pipeline

### Current Workflow

Using: HubSpot/Pipedrive (CRM) + ClickUp/Notion (projects) + Google Docs (proposals/contracts) + Xero/QuickBooks (billing) + Slack (comms) + Zapier (glue between all of these).

The Zapier automation breaks every 3–6 months. Someone spends a Friday afternoon fixing it.

### Pain Points

1. **The "human API" problem:** copying data from CRM to project tool to billing when a deal closes
2. **No project history in the CRM, no deal context in the project tool** — two sources of truth
3. **Proposal/contract workflow is manual** — chasing for signatures, manually tracking versions
4. **Zapier fragility** — automations break silently; no one knows until something is missing
5. **Onboarding new team members** takes too long because process knowledge is tribal

### Willingness to Pay

MEDIUM.
- £200–£800/month for a 10-person firm
- £500–£2,000/month for a 30-person firm
- Strong ROI if it eliminates one part-time "ops coordinator" role (£2–4k/month saved)

### Evaluation Criteria

1. **Time to value** — must show ROI within 30 days or it gets cancelled
2. **Replaces ≥2 existing tools** — switching cost justification
3. **Easy to set up** — no IT required; founder/ops lead can configure it
4. **Integrates with existing tools** — especially HubSpot, Xero, Slack

### Research Notes

- This persona is easier to reach (LinkedIn, agency owner communities, r/smallbusiness) and has faster sales cycles
- Better for initial product validation and iteration speed before capital markets
- Risk: may not stress-test multi-jurisdiction / compliance features — risk of optimising for wrong persona

---

## Secondary Persona B — Technical Co-founder / CTO at Ops-Heavy SaaS

### Demographics & Role

| Field | Value |
|-------|-------|
| Job titles | CTO, Technical Co-founder, VP Engineering, Head of Platform |
| Company type | B2B SaaS with ops-heavy GTM (customer success, sales ops, professional services delivery) |
| Company size | 20–100 employees |
| Tech savviness | HIGH — developer; evaluates on API quality and data model |

### Jobs-to-Be-Done

1. **Build internal tooling on top of a reliable data platform** instead of from scratch
2. **Get a complete audit log of all business operations** without building event sourcing themselves
3. **Connect product usage data to business ops data** in one graph

### Willingness to Pay

MEDIUM-HIGH. Will pay for developer-grade primitives with good docs and reliable APIs.

### Evaluation Criteria

1. **API completeness and documentation quality** — will probe deeply before committing
2. **Data model flexibility** — can they model their specific business entities?
3. **Webhook / event streaming support** — must integrate with existing data pipeline
4. **Self-hostable option** — for data sovereignty concerns

---

## Edge Case Users (Do Not Design For)

| User Type | Why Not |
|-----------|---------|
| Solo freelancers | Too simple; won't pay; design-complexity mismatch |
| Consumer-facing companies | No human-in-the-loop operations; different tool category |
| Enterprises (1000+) | Beyond bootstrap capacity; enterprise procurement and compliance requirements exceed what we can deliver at this stage |
| Dev tools companies | Minimal ops workflow; they'll build their own |
| Non-technical business owners | Won't understand the primitives without significant hand-holding |

---

## Common Misconceptions About Target Users

| Misconception | Reality |
|--------------|---------|
| "They want to replace all their tools at once" | No. They want to solve one painful workflow first. Land-and-expand is how this sells. |
| "Capital markets firms will wait for SOC 2" | Some will. Design partners co-developing can often pilot with non-production data or ring-fenced environments. |
| "Primary persona is technical" | The global ops lead is NOT technical. The canvas and chat interface must be as important as the API. |
| "They'll tolerate long setup" | Time-to-first-value must be <1 week for professional services; <4 weeks for capital markets design partners. |
| "The audit trail is a nice-to-have" | For regulated industries it is a hard requirement. It is THE differentiator, not a feature. |

---

## Open Research Questions

1. **Which specific workflow is the highest-pain capital markets entry point?** Client onboarding? Trade lifecycle? Fund reporting? Validate via interviews before choosing Phase 1 scope.
2. **What is the design partner recruitment path?** Where do capital markets ops leads spend time professionally? Which conferences, communities, and LinkedIn networks?
3. **What does a "good week vs. bad week" look like for the primary persona?** Understanding the emotional arc helps design the product experience.
4. **Pricing sensitivity:** At what price point does the capital markets primary persona stop self-approving and need CFO sign-off? (Hypothesis: ~£2k/month = self-approval; £5k+/month = procurement involved.)
