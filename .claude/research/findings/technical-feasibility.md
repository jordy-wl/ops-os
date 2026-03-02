# Technical Feasibility Assessment — Ops OS

> Researcher: populated 2026-03-02. Technical analysis based on concept primitives and engineering knowledge.
> Status: INITIAL ASSESSMENT — architect review required before PRD lock.
> Escalate unknowns to architect / technical co-founder.

---

## PRD Assumptions Review

| Assumption | Feasibility | Confidence | Notes |
|-----------|-------------|------------|-------|
| Immutable event log as audit trail | FEASIBLE | HIGH | Event sourcing is a proven pattern; Postgres append-only table with write-locked rows is implementable |
| Graph-connected Blocks (business entities) | FEASIBLE | MEDIUM | Adjacency list in Postgres is feasible; performance at 100k+ edges needs spike |
| Actions as the only mutation path | FEASIBLE | HIGH | Command pattern is well understood; enforceability via API layer |
| Workflow engine (trigger-based pipelines) | RISKY | MEDIUM | Custom engine is doable but scope-creep risk; Temporal is the right production answer |
| No-code canvas (drag-and-drop workflow) | RISKY | LOW | Building a reliable, safe canvas is a product in its own right — Phase 2+ only |
| AI routing via confidence × risk policy | RISKY | MEDIUM | Confidence scoring for "should I auto-execute?" is unsolved; start conservative |
| 4-type memory context for AI | FEASIBLE | MEDIUM | Each memory type maps to a known data pattern, but integration complexity is high |
| Multi-jurisdiction workflow config | FEASIBLE | MEDIUM | Implementable as workflow templates with jurisdiction-specific parameter overrides |
| Real-time dashboard and metrics | FEASIBLE | HIGH | Postgres materialized views + Supabase Realtime is a proven pattern |

---

## Highest Technical Risk Areas

**Ranked by risk score (Likelihood × Impact, 1–5 each)**

### Risk 1: Workflow Engine (Score: 16)
**Likelihood:** 4 | **Impact:** 4

Building a reliable, durable workflow engine from scratch is one of the hardest problems in distributed systems. Failures include: silent failures when a step times out, lost progress when a server restarts, duplicate execution when retried.

**Why it's risky:** Every ops workflow requires durability guarantees. If "onboard client XYZ" runs step 3 (send KYC email) and then the server restarts, does step 3 run again? Silent duplication in a compliance context = catastrophic.

**Prototype mitigation:** Use Postgres as a job queue (table of pending workflow steps, worker polls and executes). This is not durable for high scale but is safe enough for 10–100 concurrent workflows in a prototype. Fail fast if it breaks — don't silently retry.

**Production path:** Temporal (open-source, battle-tested, used by Stripe, Uber, Netflix). Exactly-once execution semantics. Self-host on AWS or use Temporal Cloud ($0.05/action + infra).

**Spike required:** Build a Temporal "hello world" workflow alongside the Postgres queue prototype. Evaluate operational burden of running Temporal at the first paying customer.

---

### Risk 2: AI Confidence Routing (Score: 15)
**Likelihood:** 3 | **Impact:** 5

The system must decide: "Is my confidence in this action high enough to execute automatically, and is the business risk low enough that I don't need a human?" Both inputs are hard to calibrate correctly.

**Why it's risky:** Too conservative = every action requires human approval = no AI value. Too permissive = AI silently executes wrong actions = trust destroyed. Getting the calibration wrong on regulated actions (e.g. triggering a client communication, running a compliance check) could have real-world consequences.

**Prototype mitigation:** Start with confidence threshold = 1.0 (i.e. all actions require human approval). Log what the AI would have done automatically. After 30 days of data, tune the threshold based on actual accuracy. Never let AI execute actions with business impact until threshold calibration is validated.

**Build vs. buy:** This is a novel problem — no off-the-shelf confidence scorer for business actions exists. Must be built custom. Key input signals: (1) action type risk score (defined in policy), (2) Claude's stated confidence in its interpretation, (3) historical accuracy for similar actions.

---

### Risk 3: Graph Query Performance (Score: 12)
**Likelihood:** 3 | **Impact:** 4

Blocks are connected to each other in a business graph. Querying "everything connected to Client XYZ" could traverse hundreds of edges. At scale, this becomes slow.

**Why it's risky:** If the system can't answer "what is the full context of this client?" in <200ms, the AI and dashboard features become unusable.

**Prototype mitigation:** Postgres adjacency list with proper indexing. For prototype (10–100 clients, hundreds of edges): this will be fast enough. Spike test at 10k blocks and 100k edges before committing to this data model in production.

**Production path options:**
- **Postgres with recursive CTEs:** Works well up to ~1M edges with proper indexing. Free.
- **Apache AGE (Postgres extension):** Adds graph query language (Cypher) to Postgres. Adds complexity.
- **Neo4j:** Dedicated graph DB. Best for complex graph traversals. Adds operational overhead.

**Recommendation:** Postgres adjacency list for prototype → evaluate Apache AGE or Neo4j only if query performance degrades with real data.

---

## Build vs. Buy Decisions

| Capability | Build | Buy / Use | Recommendation | Reasoning |
|-----------|-------|-----------|----------------|-----------|
| Workflow engine (prototype) | Postgres queue table | — | **BUILD (minimal)** | Simple enough; full control; replace with Temporal at production |
| Workflow engine (production) | — | **Temporal** | **BUY** | Distributed execution is too hard to build correctly |
| Graph database | Postgres adjacency list | Neo4j / Apache AGE | **BUILD on Postgres** | Postgres is sufficient for prototype; buy decision deferred |
| Vector memory (semantic search) | — | **pgvector** (Postgres extension) | **BUY** | Already in Supabase; zero operational overhead |
| Auth and permissions | — | **Clerk** | **BUY** | Multi-tenant, org/team support, RBAC built-in; 6-month build shortcut |
| Document generation (contracts, reports) | — | **Docusign API / Anvil** | **BUY** | Document workflows are a vertical product; don't build |
| Email / notifications | — | **Resend or Sendgrid** | **BUY** | Commodity |
| AI reasoning | — | **Claude API** (claude-sonnet-4-6) | **BUY** | Best-in-class for complex reasoning; Anthropic alignment with agentic use case |
| AI extraction/parsing | — | **claude-haiku-4-5** | **BUY** | Cost-efficient for high-volume structured extraction |
| Real-time updates | — | **Supabase Realtime** | **BUY** | Built into Supabase; zero overhead for prototype |
| No-code canvas | — | **React Flow** | **BUY (Phase 2+)** | Foundation; but safe workflow canvas logic must be built on top |

---

## Technical Dependencies

| Dependency | Risk Level | Mitigation |
|-----------|-----------|-----------|
| Supabase (Postgres + Realtime + Auth) | LOW | Managed service; battle-tested; free tier sufficient for prototype |
| Claude API (Anthropic) | LOW | Best model for agentic reasoning; risk = API cost at scale → mitigate with caching and Haiku for cheap tasks |
| Vercel (deployment) | LOW | Commodity hosting; easy to migrate if needed |
| Clerk (auth) | MEDIUM | If Clerk pricing becomes prohibitive at scale, migrating auth is painful. Mitigation: design auth layer behind an interface. |
| Temporal (production only) | MEDIUM | Operational complexity of running Temporal; Temporal Cloud reduces this at a cost |
| Third-party integrations (Salesforce, Xero, HubSpot) | MEDIUM | Integration maintenance is ongoing; break when APIs change. Mitigate: use official SDKs, subscribe to API changelogs |

---

## Estimated Build Complexity

| Product Area | T-Shirt Size | Notes |
|-------------|-------------|-------|
| Block data model (core schema) | M | Well-understood; Postgres tables + adjacency list |
| Events table (append-only) | S | Simple schema; write-once enforcement via API layer |
| Actions API (command pattern) | M | API design is the complexity; execution is straightforward |
| Workflow engine (Postgres prototype) | L | Job queue + worker + step execution + error handling |
| AI routing layer | XL | Confidence scoring + risk policy + human routing queue |
| Dashboard and metrics | M | Supabase Realtime + materialized views |
| Multi-tenant auth (Clerk) | S | Clerk handles most of it |
| Jurisdiction-aware workflow config | L | Parameter overrides per jurisdiction; validation logic |
| Integration layer (Salesforce etc.) | L | One integration = M; maintaining N integrations = L |
| No-code canvas (Phase 2+) | XL | Deferred; React Flow + safe workflow logic = large project |
| Chat control plane | L | LLM-powered action execution; depends on confidence routing |

---

## Open Technical Questions (Requiring Spikes)

1. **Graph performance spike:** Can Postgres serve a full "client context" query (all connected Blocks, last 90 days of Events) in <200ms with 10k blocks and 100k edges? Run this before committing to the adjacency list model in the PRD.

2. **Confidence scoring prototype:** Build a 20-case test set: given an action (e.g. "send onboarding email to client") and a Claude interpretation, can Claude reliably output a calibrated confidence score? What prompt structure achieves best calibration?

3. **Temporal operational burden:** How much DevOps time does running Temporal require per week? Is Temporal Cloud ($0.05/action) economically viable at 1,000 workflow executions/day vs. self-hosted?

4. **Immutability enforcement:** What's the safest way to enforce "Events are never updated or deleted" at the database layer? Row-Level Security in Postgres + no UPDATE/DELETE permissions for the service role — test this.

---

## Assessment Summary

| Dimension | Assessment |
|-----------|-----------|
| Overall feasibility | FEASIBLE with scoping discipline |
| Biggest risk | Workflow engine — don't build a custom durable execution engine from scratch |
| Second biggest risk | AI confidence routing — start fully conservative (all-manual) and tune with data |
| Biggest scope trap | The no-code canvas — it is not Phase 1 |
| Recommended approach | Postgres-first for prototype; buy Temporal and React Flow at production scale |
| Bootstrap compatibility | YES — Supabase free tier + Vercel hobby + Claude API at low volume = ~$0–$50/month for prototype |

**Phase 1 technical goal:** Prove that Blocks + Events + Actions + basic Workflow + AI chat can model and execute a real client onboarding workflow for 2–3 design partners without breaking. Everything else is Phase 2.
