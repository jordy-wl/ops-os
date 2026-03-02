# PRD Layer 02: User Research

> Last updated: 2026-03-02 | Author: Researcher | Status: DRAFT
> Cross-reference: `research/findings/user-personas.md` for full research notes and methodology.
> This document contains the distilled version for engineers. The research findings contain raw data.

---

## Research Methodology

**Status: ASSUMPTION-BASED**

Personas are derived from: concept brief (primary source) + competitive analysis + industry pattern matching. Zero user interviews conducted to date.

**Validation required:** 3–5 interviews per persona before PRD lock. Recommended: LinkedIn outreach to "Head of Operations" + "Capital Markets" connections in founder's network.

---

## Primary Persona — The Global Operations Lead (Capital Markets)

**Name:** Alex Chen (hypothetical)
**Title:** Head of Operations / COO / Head of Client Services / Compliance Operations Manager
**Company:** Global broker, capital markets technology provider, prime brokerage, or fund administrator
**Company size:** 50–500 employees
**Jurisdictions:** Multi — typically London + US + APAC (Singapore, Hong Kong, Sydney)
**Tech savviness:** Moderately technical — evaluates and configures software tools; not a developer
**Budget authority:** £50k–£500k/year for operations tooling

### Jobs-to-Be-Done (Priority Order)

1. Know what's happening with every client, in every jurisdiction, right now — without asking 3 people or opening 4 systems
2. Prove compliance — when a regulator asks "what was the state of this client's onboarding on March 15th?" answer in 2 minutes, not 2 days
3. Onboard new ops staff quickly — institutional knowledge must live in the system, not in people's heads
4. Route the right tasks to the right people — different approval rules per jurisdiction, automated where safe
5. Generate client-facing reports and status updates without manually assembling them from disparate systems

### Current Workflow (The Problem State)

```
Client onboarding at a global broker today:

1. Relationship Manager receives new client → logs in Salesforce
2. Ops team creates a project in Monday.com
3. Compliance sends KYC checklist via email
4. Legal drafts agreement in Word, stored in SharePoint
5. Finance sets up billing in Xero
6. IT provisions access in a separate ticketing system
7. Each jurisdiction has a different version of steps 1–6
8. Status updates: someone manually emails all parties every week
9. If regulator asks for audit: manually reconstruct from email threads + spreadsheet versions

Time wasted: 15–25 hours per client onboarding
Error rate: High — data entry duplication across systems
Onboarding time: 15–30 business days (target with Ops OS: 3–5 days)
```

### Pain Points (Priority Order)

1. **No single source of truth** — "who owns this?" is answered differently by every system
2. **No audit trail** — compliance requests are a nightmare; nothing is provably immutable
3. **Multi-jurisdiction configuration** — the same onboarding workflow needs 8–12 variations; maintaining them is a full-time job
4. **Role ownership ambiguity** — "who approves the AML check in Singapore?" is answered by asking people, not the system
5. **Manual status reporting** — senior ops staff aggregate status across systems manually for weekly reports
6. **Tribal knowledge** — when a senior ops person leaves, institutional knowledge walks out the door

### Willingness to Pay

**HIGH.** Capital markets firms spend £100k–£500k/year on compliance and operations systems.

- £2,000–£8,000/month for a 50-person firm
- £10,000–£30,000/month for a 200-person firm
- Enterprise deals up to £100k/year for firms with complex regulatory requirements

ROI is clear: one compliance audit taking 30 hours without Ops OS vs. 2 hours with = significant cost savings at £200–500/hour for senior ops staff.

### Evaluation Criteria (What They Buy On)

1. **Auditability** — immutable history is a must-have, not nice-to-have
2. **Configurable without IT** — ops lead must be able to build and modify workflows
3. **Role-based access per jurisdiction** — not just RBAC but jurisdiction-aware permissions
4. **Integration with existing tools** — must read from Salesforce; write to compliance systems
5. **Security and data residency** — FCA/MAS/ASIC requirements for where data lives
6. **Proof of adoption at similar firms** — will ask for references before buying

### Key Quote (Hypothetical — validate with interviews)

> "I can describe our client onboarding process in about 20 minutes of talking. But if you ask me to show it to you in our systems, I'd need 4 browser tabs and a spreadsheet. That's the problem."

---

## Secondary Persona A — The Ops-Bottlenecked Founder / RevOps Lead (Professional Services)

**Title:** Operations Manager, RevOps Lead, Chief of Staff, Founder, Agency Director
**Company:** Agency (creative, marketing, PR, consulting), law firm, management consultancy
**Company size:** 10–50 employees
**Tech savviness:** Moderately technical; comfortable with SaaS tools; not a developer
**Budget authority:** £5k–£50k/year for operations tooling

### Jobs-to-Be-Done

1. Answer "where are we with client X?" in 30 seconds without digging through Slack, email, and project tools
2. Stop re-entering the same data in 3 different systems when a new client signs
3. Automate the repetitive parts — proposal → contract → onboarding → delivery → invoice — without Zapier breaking
4. Give leadership a live dashboard of client health, project status, and revenue pipeline

### Current Stack

HubSpot/Pipedrive (CRM) + ClickUp/Notion (projects) + Google Docs (proposals/contracts) + Xero/QuickBooks (billing) + Slack (comms) + Zapier (glue). Zapier automation breaks every 3–6 months.

### Willingness to Pay

MEDIUM. £200–£800/month for a 10-person firm; £500–£2,000/month for a 30-person firm.

### Evaluation Criteria

1. Time to value — must show ROI within 30 days
2. Replaces ≥2 existing tools — must justify the switching cost
3. Easy to set up — no IT required; founder/ops lead can configure it
4. Integrates with existing tools — especially HubSpot, Xero, Slack

### Design Note

This persona is easier to reach (faster sales cycles, more accessible) and better for early iteration. **Risk:** may not stress-test multi-jurisdiction and compliance features — risk of optimising for the wrong persona. Primary persona (capital markets) must remain the north star for Phase 1 design decisions.

---

## Secondary Persona B — Technical Co-founder / CTO (Ops-Heavy SaaS)

**Title:** CTO, Technical Co-founder, VP Engineering, Head of Platform
**Company:** B2B SaaS with ops-heavy GTM (customer success, sales ops, professional services delivery)
**Company size:** 20–100 employees
**Tech savviness:** HIGH — developer; evaluates on API quality and data model

### Jobs-to-Be-Done

1. Build internal tooling on top of a reliable data platform instead of from scratch
2. Get a complete audit log of all business operations without building event sourcing themselves
3. Connect product usage data to business ops data in one graph

### Willingness to Pay

MEDIUM-HIGH. Will pay for developer-grade primitives with good docs and reliable APIs.

### Evaluation Criteria

1. API completeness and documentation quality — will probe deeply before committing
2. Data model flexibility — can they model their specific business entities?
3. Webhook / event streaming support — must integrate with existing data pipeline
4. Self-hostable option — for data sovereignty concerns

---

## Do Not Design For

| User Type | Why Not |
|-----------|---------|
| Solo freelancers | Too simple; won't pay; design-complexity mismatch |
| Consumer-facing companies | No human-in-the-loop operations; different tool category |
| Enterprises (1,000+ employees) | Beyond bootstrap capacity; enterprise procurement requirements exceed Phase 1 |
| Non-technical business owners | Won't understand the primitives without significant hand-holding |

---

## Key User Journeys

### Journey 1: New Client Onboarding (Primary Persona — Phase 1 Critical Path)

```
1. Ops Lead opens Ops OS chat
2. Types: "Start onboarding for Thornfield Capital, London jurisdiction"
3. System creates a Block for Thornfield Capital (type: client)
4. Workflow triggers: Client Onboarding — London variant
5. AI surfaces the first action: "Request KYC documents from RM"
6. Ops Lead approves the action → system records the event
7. Each step in the workflow fires as the previous completes
8. At any point: Ops Lead types "What's the status of Thornfield?" → AI reads the event timeline and summarises
9. Regulator asks for audit on day 45 → Ops Lead exports the event timeline — immutable, timestamped, complete
```

### Journey 2: Status Check Query (Primary Persona — Daily Use)

```
1. Ops Lead opens Ops OS
2. Types: "Show me all client onboardings that are overdue by more than 3 days"
3. AI queries the business graph + event timeline
4. Returns: list of Block names, current step, last event timestamp, assigned owner
5. Ops Lead clicks one → sees full event timeline for that client
```

### Journey 3: Design Partner Onboarding (Phase 1 — Internal)

```
1. Founder introduces design partner to Ops OS
2. Partner selects 1 workflow to run through the system (client onboarding recommended)
3. Ops Lead configures their jurisdiction variant via pre-built template
4. First real client is onboarded through the system
5. After 30 days: feedback session on operational impact
```

---

## Open Research Questions

1. Which specific capital markets workflow is the highest-pain entry point? Client onboarding is the leading hypothesis — validate via interviews before Phase 2 planning.
2. What does the design partner recruitment path look like? LinkedIn, conferences (FinTech Connect, Finovate), or founder's direct network?
3. At what price point does the primary persona need CFO sign-off? (Hypothesis: ~£2k/month = self-approval; £5k+/month = procurement involved.)
4. Do capital markets design partners want Ops OS to replace their Salesforce, or layer on top of it? This determines integrations priority for Phase 2.

---

## Archived

> Content moved here when superseded. Never deleted.
