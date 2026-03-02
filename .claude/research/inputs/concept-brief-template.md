# Concept Brief — Ops OS

> Researcher: read this in full before beginning Initial Research mode.
> Last updated: 2026-03-02

---

## Product Idea

**What does it do?**
Ops OS is a Business Operating System (BOS) that replaces the fragmented stack of SaaS tools a company uses to run itself. Instead of a CRM + project management tool + document storage + billing system that don't talk to each other, Ops OS is a single stateful engine where every business entity (a client, a deal, a project, a contract) exists as a connected, living record with a complete, immutable history. An ambient AI layer reads this connected graph and helps users execute workflows — routing routine tasks automatically and surfacing the right decisions to the right people at the right time.

**Core user action:**
Open Ops OS and ask "What is the status of the XYZ Capital onboarding?" — and get a complete, real-time answer with full history, next steps, and the ability to act directly from the answer.

---

## The Problem It Solves

**Specific problem:**
Businesses with complex operations (professional services firms, global financial services, operations-heavy SaaS) use 5–12 disconnected SaaS tools to run themselves. Every time something changes in one system, a human has to manually update 2–3 other systems. Employees become "human APIs" — spending 20–40% of their time copying context across tools, answering "where are we with X?" questions, and manually routing approvals and handoffs. This problem compounds at scale: more clients, more team members, more jurisdictions = exponentially more manual coordination.

For capital markets and global financial services firms specifically: this manifests as workflow configurations that differ by jurisdiction, role ownership ambiguity across global teams, compliance requirements that demand immutable audit trails, and client onboarding processes that have 12 variations for 12 markets — each maintained in separate spreadsheets with no single source of truth.

**Current workaround:**
- Salesforce or HubSpot for CRM (client/deal state)
- Monday.com, ClickUp, or Asana for project/task management
- Google Docs / Notion for documentation and SOPs
- Zapier or Make for automation
- Email and Slack for approvals and handoffs
- Spreadsheets as the unofficial source of truth that ties everything together

**Why the current workaround is bad:**
- No single view of "what is happening with this client right now" — must check 3-4 systems
- History is scattered: a client conversation in Gmail, their contract in Drive, their project status in Monday, their invoice in Xero — no timeline
- Automation is brittle: Zapier workflows break silently; no audit trail for what was automated
- Compliance nightmare: when regulators ask "what was the status of this onboarding on March 15th?" — the answer requires manually reconstructing events from email threads and spreadsheet versions
- Onboarding a new ops person takes weeks because the "how things work" knowledge lives in the heads of existing staff, not in the system

---

## Target User

**Primary (anchor) — Global Operations Lead at a Capital Markets / Financial Services Firm**
50–500 person firm: global broker, capital markets technology provider, prime brokerage, or financial services operator with multi-jurisdiction operations. Specific roles: Chief Operating Officer, Head of Operations, Head of Client Services, Compliance Operations Manager. Operations span multiple regulatory regimes (FCA, SEC, MAS, ASIC). Teams have different workflows per jurisdiction. Client onboarding has compliance requirements that need a provable audit trail.

**Secondary A — Operations Lead / RevOps at Professional Services Firm**
10–50 person agency, consultancy, law firm, or management consultancy. Founder-led or has a dedicated ops manager. Currently the "glue" between all the tools they use. Evaluates on time-to-value and immediate productivity impact.

**Secondary B — Technical Co-founder / CTO at Ops-Heavy SaaS**
Wants code-level control for internal tooling. Evaluates on API quality, data model flexibility, audit trail completeness.

**Where to find them:**
- LinkedIn: "Head of Operations" + "Capital Markets", "RevOps Manager" + "professional services"
- Communities: r/fintech, r/smallbusiness, LinkedIn groups for ops professionals
- Events: FinTech Connect, Finovate, operational excellence conferences
- IRL: boutique investment firms, agency owner networks, professional services partnerships

**Their relationship with technology:**
- Primary persona: Moderately technical — comfortable with software tools, has evaluated many, not a developer
- Secondary B: Technical

---

## What I Know

(Confirmed — do not re-research these):
- SaaS fragmentation is universal: every ops-heavy business uses 5+ disconnected tools
- Event sourcing (immutable append-only log of changes) is a proven architectural pattern at scale — used by Stripe, Airbnb, financial systems
- The "Business OS" framing resonates: Notion tried to own it, Linear tried to own it for eng teams, Rippling owns it for HR
- No-code workflow builders have strong PMF (Zapier has 2M+ users)
- AI assistance in enterprise ops is a top-3 priority for most ops teams in 2025
- Capital markets firms pay premium prices for operational software ($50k–$500k/year for compliance systems)
- The primitives (Blocks, Events, Actions, Workflows) map cleanly to how financial services firms already think (entities, audit events, permissioned actions, SOP workflows)

---

## What I Don't Know

(Open research questions for the researcher):
1. **Rip-and-replace vs. layer-on-top:** Will target users rip out their existing CRM/PM tools, or do they need Ops OS to integrate with them as a layer on top? This determines our integrations strategy and GTM.
2. **Capital markets entry point:** Which specific workflow (client onboarding, compliance reporting, deal flow, internal ops) is the highest-pain entry point for a capital markets firm? What does the land-and-expand motion look like from bootstrap?
3. **Pricing model for BOS:** What pricing model works — per seat, per workflow executed, per block/entity, or platform fee? What are comparable tools charging? What do capital markets firms budget for ops tooling?
4. **Canvas necessity for Phase 1:** Do primary users (ops leads) need the no-code canvas from day 1, or will they tolerate pre-built workflow templates initially? (This determines Phase 1 scope.)
5. **Compliance as entry point:** Can we enter capital markets via compliance workflow management specifically (not the full BOS) and expand from there? What compliance tools are they replacing/supplementing today?
6. **Build vs. layer:** Is there a dominant workflow engine (Temporal, Inngest, custom) that capital markets firms would accept running under the hood, or do they demand full white-box transparency?

---

## Constraints

| Constraint | Details |
|-----------|---------|
| Time to first working version | [NEEDS USER INPUT] |
| Budget (infra + tools) | Bootstrap / pre-revenue — zero infrastructure cost where possible. Supabase free tier, Vercel hobby/pro. Claude API costs must be minimal at prototype stage. |
| Team size | [NEEDS USER INPUT] — solo or small team |
| Technical constraints | No locked technical bets yet — researcher should recommend stack |
| Market constraints | Capital markets features will need to be careful around data residency (FCA/MAS/ASIC requirements). Compliance workflows may require SOC 2 before enterprise sale. |

---

## What Success Looks Like in 6 Months

[NEEDS USER INPUT — define specific metrics with the PM]

Researcher note: For a BOS targeting capital markets, "success in 6 months" is likely not consumer-style DAU/MAU. Better metrics:
- 3–5 design-partner clients using the system for a live workflow
- Each design partner processing ≥100 real transactions/events through the system
- At least 1 design partner paying (even nominally — £500–5k/month)
- Measurable reduction in coordination overhead for at least 1 workflow (e.g. client onboarding time from 15 days to 5)

---

## Reference Products

| Product | What I Like | What I Dislike |
|---------|------------|----------------|
| Notion | Flexible data model, "connected workspace" positioning | Not a state engine; no immutable history; AI is document-search, not workflow-aware |
| Linear | Beautiful UX, opinionated workflows, strong developer adoption | Engineering-only; no business graph; no AI routing |
| Salesforce | Deep financial services adoption, proven audit trails | Expensive, complex, requires dedicated admin; AI is bolt-on |
| Rippling | Proof that vertical BOS works — grew from HR to full business ops | HR-specific; slow to expand; expensive |
| Temporal | Correct architecture for durable workflow execution | Developer tool; no user-facing product; too technical for ops personas |
| Zapier | Proved that non-technical ops people will pay for automation | Not stateful; no audit trail; breaks silently; not a BOS |

---

## Technical Bets Already Made

- **Event sourcing as core architecture:** The immutable, append-only event log is non-negotiable — it's both a technical pattern and a product feature (auditability)
- **Graph-connected data model:** Business entities (Blocks) are connected to each other — this is fundamental to how the system reasons about context
- **AI as assistant, not governor:** The AI layer assists and routes; humans approve high-risk actions; AI never silently modifies critical business data
- **Web application first** — no mobile-first, no desktop app

No stack choices locked — researcher should recommend.

---

## Anything Else the Researcher Should Know

**The canvas is Phase 2+.** The no-code workflow canvas (drag-and-drop workflow builder) is an important part of the long-term vision, but it is a product in its own right. Do NOT include it in Phase 1 scope in any research or recommendation. Phase 1 proves the primitives (Blocks, Events, Actions, Workflows, AI routing) via API + chat interface + pre-built templates.

**The primary persona shift:** The original concept brief was written with a professional services SMB in mind. The primary anchor persona has been updated to capital markets / global financial services firms. These users have significantly higher willingness to pay, a more acute compliance/audit need (perfect fit for immutable events), and multi-jurisdiction complexity that no current tool handles well. Professional services remains a secondary target.

**Land-and-expand is critical for bootstrap:** We cannot build a full BOS and sell it to a 500-person capital markets firm in year 1. The go-to-market must be: identify one workflow (e.g. client onboarding or trade lifecycle ops) that causes severe pain, solve it brilliantly for 2–3 design partners, then expand. Researcher: please identify which specific workflow is the right entry point.

**The AI differentiation:** Competitors are adding "AI features." The Ops OS differentiation is not the AI model — it's that the AI reads the full business graph (all connected Blocks) AND the complete event timeline (all historical context). Generic AI tools have amnesia; Ops OS AI has perfect memory of the business. This distinction must come through clearly in positioning.
