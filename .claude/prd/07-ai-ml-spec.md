# PRD Layer 07: AI/ML Specification

> Last updated: 2026-03-02 | Author: AI/ML Engineer | Status: DRAFT
> Cross-references: `prd/03-system-architecture.md` (AI integration), `prd/10-security-compliance.md` (PII in prompts).
> AI/ML engineer: read this before claiming tasks. All evaluation criteria and cost targets live here.

---

## AI Features Overview

| Feature | User-Facing Description | Phase | Status |
|---------|------------------------|-------|--------|
| Chat Control Plane | Natural language interface: query the business graph, get answers, approve suggested actions | 1 | IN DEV |
| Action Routing | AI interprets user intent → routes to action → human approval (Phase 1: always human) | 1 | IN DEV |
| Semantic Search | "Find similar clients" / "What happened last time we onboarded a firm like this?" | 1 | IN DEV |
| Context Assembly | AI reads the full graph + event timeline before every response | 1 | IN DEV |
| Confidence Routing | AI assesses confidence × action risk → auto-execute or route to human | 2 | PLANNED |
| Extraction (Haiku) | Parse emails, extract structured data from documents, generate summaries | 2 | PLANNED |

---

## Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Chat reasoning, workflow interpretation, action routing | `claude-sonnet-4-6` | Best-in-class for long-context agentic reasoning; handles full graph + event context |
| High-stakes compliance routing (Phase 2+) | `claude-opus-4-6` | Reserved for actions with highest regulatory risk; ~10× cost of Sonnet |
| Extraction tasks — email parsing, document summaries | `claude-haiku-4-5-20251001` | Cost-efficient for high-volume, lower-complexity tasks (Phase 2) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) | Claude API has no embedding endpoint; OpenAI is cost-effective |

---

## Feature Specifications

### Feature 1: Chat Control Plane

**What it does:** User types a natural language message. AI reads the business graph and event timeline for the relevant blocks, interprets the intent, and either answers with information or suggests an action that requires human approval.

**Model:** `claude-sonnet-4-6`

**Context assembly (before every AI call):**
1. Recent conversation messages (last N turns, within token limit)
2. Relevant Blocks from graph: if `context_block_id` is provided, fetch the block + its connected blocks (1 hop)
3. Recent Events for context block: last 50 events, summarised if token budget is tight
4. Current workflow state for context block (if a workflow is active)
5. User role and org context

**System prompt location:** `src/prompts/chat-control-plane-v1.md`

**Response structure (streamed SSE):**
- Text segments: streamed token by token
- Action suggestion: structured JSON block at end of stream if action is appropriate

**Model requirements:**

| Requirement | Target | Notes |
|------------|--------|-------|
| Latency (first token) | < 1,500ms p95 | SSE streaming; user sees text immediately |
| Context window utilisation | < 80% of 200k token limit | Leave headroom for complex workflows |
| Accuracy on action routing | > 95% correct intent classification | Eval suite: 50 test cases |
| Cost per call | < $0.01 (Sonnet pricing) | ~500 in + 300 out tokens average |
| Monthly cost at prototype | < $50/month | 10 users × 20 calls/day × 30 days |
| Fallback if API fails | Return error message; offer "manual mode" | Never fail silently |

---

### Feature 2: Action Routing with Confidence Scoring

**What it does:** For every action the AI suggests, it also outputs a confidence score (0.0–1.0) and the action's risk score (1–5). The routing engine decides: auto-execute (if confidence × risk allows) or route to human.

**Phase 1 constraint:** Confidence threshold = 1.0 (all actions route to human approval). This is non-negotiable until calibration data exists.

**Routing decision logic:**
```
if (confidence >= threshold AND risk_score <= max_auto_risk):
  auto_execute()
  record event: { actor_type: "ai", confidence, risk_score }
else:
  route_to_human()
  record event: { actor_type: "ai", routing_decision: "human", confidence, risk_score, reason }
```

**Phase 1:** `threshold = 1.0`, `max_auto_risk = 0` (nothing auto-executes)
**Phase 2 calibration:** After 30 days of logged routing decisions, review accuracy → tune threshold with PM and architect sign-off

**Risk score definitions:**

| Score | Risk Level | Examples |
|-------|-----------|---------|
| 1 | Very Low | Read query, status check |
| 2 | Low | Add comment, update non-critical field |
| 3 | Medium | Trigger workflow, update block status |
| 4 | High | Send external communication, approve compliance step |
| 5 | Critical | Archive client, modify compliance record, cross-jurisdiction action |

**Logging requirement:** Every AI routing decision — including what it would have done automatically — is logged as an `ai.routing_decision` event. This is how calibration data is collected.

---

### Feature 3: Semantic Search (pgvector)

**What it does:** Given a natural language query, find semantically similar blocks and events across the org's data.

**Model:** OpenAI `text-embedding-3-small` (1536 dims)

**Pipeline:**
1. New event or block is created → `embedEvent()` or `embedBlock()` called fire-and-forget
2. Content built from: `buildEmbeddingContent(source)` → cleaned text representation
3. OpenAI embedding API called → vector stored in `embeddings` table
4. Search: user query → embed query → cosine similarity search via `match_embeddings()` RPC
5. Top-N results returned with similarity scores

**SQL RPC:** `supabase/migrations/20260302000001_embeddings_search.sql` — `match_embeddings(query_embedding, match_threshold, match_count, org_id)`

**Model requirements:**

| Requirement | Target |
|------------|--------|
| Embedding generation latency | < 500ms (fire-and-forget; non-blocking) |
| Search result relevance | Top result similarity > 0.7 for direct matches |
| Cost per embedding | < $0.001 (OpenAI text-embedding-3-small) |
| Monthly cost at prototype | < $5/month |

---

### Feature 4: Context Assembly

**What it does:** Before every AI call, assembles the most relevant context from the business graph and event timeline. This is what gives Ops OS AI its "perfect memory" differentiation.

**Assembly strategy (in priority order, within token budget):**
1. System prompt (static — role, constraints, output format)
2. User message
3. Context block data (if `context_block_id` provided)
4. Connected blocks (1-hop graph traversal — direct relationships)
5. Recent events for context block (last 50, newest first)
6. Active workflow state for context block
7. Conversation history (last 10 turns)

**Token budget management:**
- Max context: 150,000 tokens (leaving headroom in 200k window)
- If over budget: truncate events first (oldest first), then connected blocks (lowest relevance first)
- Never truncate system prompt, user message, or current block data

**PII in context:** Block data may contain contact names, company names. These are within the user's own org data — acceptable in context. Never include actual email addresses or phone numbers in AI prompts.

---

## Prompt Design Approach

**Versioning:** All prompts in `src/prompts/` as versioned markdown files. File naming: `[feature]-v[N].md`. Never overwrite — create new version. Current version tracked in `src/ai/config.ts`.

**Approach:** Structured system prompt with:
- Role definition ("You are the Ops OS AI assistant for [org_name]")
- Constraints (what you can and cannot do)
- Output format (when to use action suggestions vs. plain text)
- Examples of good vs. bad routing decisions

**Chain-of-thought:** For action routing decisions, the model must output its reasoning before the decision. This is logged for calibration purposes.

**Prompt review:** All prompt changes reviewed by at least one other agent before production (Gate 6 for HIGH complexity AI tasks).

---

## Evaluation Criteria

### Chat Control Plane — Eval Suite

**Eval suite location:** `src/evaluations/chat-control-plane/`

**What "good" looks like:**
- Correctly interprets "what is the status of X?" as an information query (no action suggested)
- Correctly routes "start onboarding for X" to `workflow.trigger` action
- Refuses to take action when user input is ambiguous (asks for clarification)
- Never includes PII from one org in context for another
- Handles "what happened last time we onboarded a firm like X?" via semantic search

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Correct information queries | 20 cases | > 95% pass rate |
| Correct action routing | 20 cases | > 95% pass rate |
| Ambiguous inputs → clarification | 10 cases | 100% ask for clarification |
| PII isolation (cross-org) | 5 cases | 100% — no cross-org leakage |
| Adversarial / prompt injection attempts | 5 cases | 100% rejected |

**Eval result template:**
```
EVAL: Chat Control Plane — claude-sonnet-4-6 — [prompt version] — [date]
Total cases: 60
Critical pass rate: [X]% (required: 100% for PII + adversarial cases)
High pass rate: [X]% (required: 95%)
Notable failures: [list or "none"]
Cost per call: $[X] (~[N] in / [N] out tokens)
Latency: p50 [N]ms / p95 [N]ms
Verdict: PASS / FAIL
```

---

## Human-in-the-Loop Requirements

| Trigger | What Happens | Who Handles |
|---------|-------------|-------------|
| All actions (Phase 1) | All actions require explicit human approval | User |
| Confidence below threshold (Phase 2+) | Action routed to human review queue | User / ops team |
| Output validation fails | Error shown; retry offered | User |
| User flags AI output as wrong | Logged as signal in build-learnings.md | Researcher (review) |
| Any action with risk score 4–5 | Always requires human approval — regardless of confidence threshold | User |

---

## Cost Model

**Target:** Total AI cost < $100/month at prototype scale (10 active design-partner users).

| Feature | Model | Avg Tokens In | Avg Tokens Out | Est. Cost/1k Calls | Monthly @ Prototype |
|---------|-------|--------------|----------------|-------------------|---------------------|
| Chat control plane | claude-sonnet-4-6 | 5,000 | 500 | $16.25 | ~$30–50/month |
| Semantic search (embeddings) | OpenAI text-embedding-3-small | 300 | — | $0.06 | ~$2–5/month |
| Action routing (within chat) | claude-sonnet-4-6 | Included in chat | — | — | Included above |

**Total estimated prototype cost: $32–55/month** — well within target.

**Cost alert:** Set Anthropic and OpenAI billing alerts at $50/day. If exceeded: investigate context assembly efficiency and caching opportunities.

**Caching strategy:** Block data changes slowly. Cache assembled context in Redis (Phase 2) or in-memory (Phase 1) for 60 seconds. Invalidate on any block mutation event.

---

## PII in Prompts — Policy

**Absolute rule:** No PII in prompts sent to Claude API or OpenAI API except what is within the authenticated user's own org scope.

| Data Type | In Claude Prompts? | In OpenAI Embeddings? | Policy |
|-----------|------------------|----------------------|--------|
| Company names (block names) | YES — within user's org only | YES — within org only | Acceptable; it's the user's own data |
| Contact names | YES — within user's org only | YES — within org only | Review; use with care |
| Email addresses | NEVER | NEVER | Strip from all prompts and embedding content |
| Phone numbers | NEVER | NEVER | Strip from all prompts and embedding content |
| Cross-org data | NEVER | NEVER | Org isolation enforced at query layer |
| Data from other Claude users/orgs | NEVER | NEVER | Enforced by org_id filtering on all queries |

**`buildEmbeddingContent()` rule:** Strip email, phone, and other Level 1 PII fields before building content for embedding.

---

## Build vs. API Decisions

| Capability | Decision | Rationale |
|-----------|---------|-----------|
| Chat reasoning | API (Claude) | Building a reasoning engine is impractical; Claude is best-in-class |
| Action routing confidence scoring | API + custom logic | Claude outputs confidence; risk score is a custom policy table |
| Embeddings | API (OpenAI) | pgvector + OpenAI is the simplest path; Claude has no embedding endpoint |
| Prompt management | Build (file-based) | Simple, version-controllable, no vendor dependency |
| Eval suite | Build (custom) | Specific to Ops OS action types; no off-the-shelf eval framework fits |
| No-code canvas AI assistance | Deferred Phase 2+ | Canvas itself is Phase 2+ |

---

## Archived

> Superseded AI feature specs moved here. Never deleted.
