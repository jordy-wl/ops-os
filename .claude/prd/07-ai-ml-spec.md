# PRD Layer 07: AI/ML Specification

> Last updated: 2026-03-12 | Author: AI/ML Engineer | Status: DRAFT
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
| Operational Intelligence | Compare workflow template (design) vs instance events (reality) → surface deviations, bottlenecks, SLA risks | 3 | PLANNED |
| Agent Queue Processor | AI agent that processes `route_agent` task_queue_items — executes simple tasks autonomously with confidence scoring | 3 | PLANNED |
| Document Intelligence | AI-powered document generation from block data + template variables; smart field extraction from uploaded docs | 3 | PLANNED |
| Workflow Suggestion | Given a block type and org's event history, suggest workflow template structure | 3 | PLANNED |

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
| Workflow suggestion AI | Build (Phase 3) | Suggests workflow templates from event patterns; specific to Ops OS data model |
| Agent task processor | Build (Phase 3) | Route_agent tasks processed by Claude with confidence scoring; specific to Ops OS action types |
| Operational intelligence | Build (Phase 3) | Template vs instance comparison; specific to workflow-as-block pattern |
| Visual canvas AI assistance | Deferred Phase 3+ | Canvas itself is Phase 3 |

---

## Phase 3 AI Feature Specifications

### Feature 5: Operational Intelligence (Design vs Reality)

**What it does:** Compares what a workflow template says _should_ happen (the design) with what the workflow instance's event timeline shows _actually_ happened (the reality). Surfaces deviations, bottlenecks, SLA risks, and patterns.

**Model:** `claude-sonnet-4-6` (or `claude-opus-4-6` for complex multi-workflow analysis)

**How it works:**
1. For each completed workflow instance: collect template definition + instance events
2. Build comparison prompt: "Here is the template. Here is what happened. What deviated?"
3. AI identifies: steps that took longer than expected, steps that were skipped, steps that failed and were retried, steps where human intervention was needed but shouldn't have been
4. Aggregate across instances: "This step fails 30% of the time — investigate"

**Eval criteria:**

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Correctly identifies deviation from template | 20 cases | > 90% detection rate |
| Correctly identifies bottleneck step | 10 cases | > 85% accuracy |
| Does not flag false positives on normal variation | 10 cases | < 10% false positive rate |
| SLA risk prediction (step likely to miss deadline) | 10 cases | > 80% accuracy |

---

### Feature 6: Agent Queue Processor

**What it does:** Processes `route_agent` task_queue_items autonomously. For tasks the AI can handle (data lookups, simple updates, notifications), it executes them with confidence scoring and logs the decision.

**Model:** `claude-sonnet-4-6`

**Constraints:**
- Same confidence × risk routing as human actions
- Agent-processed tasks are always logged with `actor_type: "ai"` events
- Risk score 4–5 tasks NEVER auto-processed by agent, regardless of confidence
- Agent processing rate starts at 0% and increases with calibration data

**Eval criteria:**

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Correctly executes simple tasks (data lookup, notification) | 20 cases | > 95% correct execution |
| Correctly escalates complex tasks to human | 10 cases | 100% escalation rate for ambiguous tasks |
| No PII leakage in agent actions | 5 cases | 100% — zero leakage |

---

### Feature 7: Document Intelligence

**What it does:** Two capabilities: (1) AI-powered document generation from block data + template variables with smart formatting, and (2) field extraction from uploaded documents (parse a PDF → extract structured data into block fields).

**Model:** `claude-haiku-4-5-20251001` for extraction; `claude-sonnet-4-6` for generation requiring reasoning

---

### Feature 8: Workflow Suggestion

**What it does:** Given a block type and the org's historical event patterns, suggests a workflow template structure. "You frequently do these 5 steps when onboarding a client in Australia — want me to create a template?"

**Model:** `claude-sonnet-4-6`

**Eval criteria:**

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Suggested workflow matches actual user patterns | 10 cases | > 70% step overlap |
| User accepts suggestion (human eval) | 10 cases | > 50% acceptance rate |

---

## Phase 3 AI Features

### Feature 9: Delta Calculation Engine

**What it does:** Given a block and its active workflow instances, calculates the gap between "where we are" and "where we should be". Pure calculation — no AI model calls. Outputs a structured delta object.

**Module:** `src/lib/ai/delta-engine.ts`

**Input:**
- Block data (type, status, metadata)
- Active workflow instances (current step, total steps, started_at)
- Workflow template definitions (expected step durations, step names)

**Output:**
```typescript
interface DeltaOutput {
  blockId: string
  totalSteps: number
  completedSteps: number
  currentPosition: number        // 0-1 progress
  remainingSteps: StepSummary[]
  expectedCompletion: Date | null
  actualVsExpected: number       // Days ahead (-) or behind (+)
  riskFactors: RiskFactor[]
  gapAnalysis: string            // Human-readable summary
}
```

**Caching:** Per-block, 5-minute TTL, invalidated on new events for associated workflow instances.

---

### Feature 10: AI Insights Generator

**What it does:** Takes a delta object + block context → generates human-readable insights via Claude. Four categories: "What's Done", "What's Next", "What's at Risk", "Recommendations".

**Model:** `claude-sonnet-4-6` (primary), `claude-haiku-4-5` (cost fallback)

**Eval criteria:**

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Insights are factually accurate (match delta data) | 15 cases | > 90% accuracy |
| Recommendations are actionable (human eval) | 15 cases | > 70% useful rating |
| No hallucinated data (not present in context) | 15 cases | 0 hallucinations |

**Cost estimate:** ~500 input tokens + ~300 output tokens per call = ~$0.003/call at Sonnet pricing. Cache reduces calls by ~80%.

---

### Feature 11: Confidence Scoring Framework

**What it does:** Assigns a 0-1 confidence score to AI-generated task recommendations. Used by the routing engine to decide Human/Agent/Auto routing.

**Factors:**
- Data completeness (0-1): how much input data is available for the decision
- Pattern match (0-1): how well this situation matches known successful patterns
- Action complexity (0-1): inverse of action risk/complexity

**Calibration:** Log every `(predicted_confidence, human_decision)` pair. Monthly recalibration: compare predicted confidence buckets to actual approval rates.

**Default thresholds (configurable per-org via Policy blocks):**
- Auto-execute: confidence ≥ 0.85 AND risk = low
- Agent-assisted: confidence ≥ 0.60
- Human required: confidence < 0.60 OR risk = high/critical

---

### Feature 12: Context-Aware Document Generation

**What it does:** Enhanced document generation that assembles rich context from the business graph — source block + connected blocks + events + reference template structure — then generates content matching the reference style.

**Context assembly budget:** ~4000 tokens
- Source block fields: ~500 tokens (mandatory)
- Connected blocks: ~1000 tokens (up to 5 blocks, summarized)
- Recent events: ~800 tokens (last 20 events, summarized)
- Reference template structure: ~700 tokens
- Brand kit metadata: ~200 tokens

**Model:** `claude-sonnet-4-6`

**Eval criteria:**

| Case Type | Count | Acceptance Threshold |
|-----------|-------|---------------------|
| Generated content matches reference template structure | 10 cases | > 80% structural match |
| Block data accurately populated in document | 10 cases | > 95% data accuracy |
| Brand kit styling correctly applied | 10 cases | > 90% style match |

---

### Feature 13: Delta-Aware Chat Context

**What it does:** Enhances the existing chat context assembly to include delta information when the user is chatting about a specific block. Chat can naturally reference "what's next", "what's at risk", and action delta recommendations in execute mode.

**Implementation:** When `blockId` is provided in chat request and mode is `discuss` or `execute`, fetch or compute the delta for that block and include it in the system prompt context. Budget: ~400 additional tokens from the delta summary.

---

### Feature 14: Auto Task Generation from Deltas

**What it does:** When a delta calculation exceeds configured thresholds (overdue milestone, stalled workflow instance), automatically creates `task_queue_item` blocks routed through the routing engine with AI-generated recommendations.

**Triggers:**
- Workflow step overdue by > 2x expected duration
- Workflow instance stalled (no events for > 48 hours)
- Delta `actualVsExpected` exceeds org-configured threshold

**Behavior:** Create task → route via routing engine → if auto-route: execute immediately. If human: add to task queue with AI recommendation + confidence score.

---

## Archived

> Superseded AI feature specs moved here. Never deleted.
