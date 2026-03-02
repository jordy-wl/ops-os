# AI/ML Tasks — Phase 1, Sprint 1

> Tasks for AI/ML Engineer only. Source of truth: `tasks.md` (master list).
> Run `/load-agent ai-ml` then `/next-task` to claim your first task.

---

## Sprint Header

**Phase:** 1 | **Sprint:** 1 | **Role:** AI-ML-ENGINEER
**Sprint Goal:** Build the basic AI chat endpoint with context assembly. By end of Sprint 1, a user can ask Claude a question about any Block and receive an informed answer based on the block's full event history and connected blocks.
**Your critical path:** AI-02 (context assembly) first → AI-01 (chat endpoint) second. Both depend on BE-01 + BE-02 + BE-03 being complete.
**Important — Confidence Routing:** Phase 1 does NOT implement confidence routing. The AI recommends actions but does not execute them. Confidence routing (threshold scoring, risk policy, auto-execution) is Phase 2 scope. Do not build it in Sprint 1.
**Model:** `claude-sonnet-4-6` for chat. Embeddings use OpenAI `text-embedding-3-small` (not Claude — Claude API does not provide embeddings). Haiku (`claude-haiku-4-5-20251001`) reserved for Phase 2 high-volume extraction.

---

## P1-S1-AI-02: Context Assembly Service

**Description:** Build the context assembly service — given a `block_id` and `org_id`, assemble all relevant context for Claude. This is the foundation of the AI layer. Sprint 1 uses 2 of 4 memory types: Working (block data) and Episodic (recent events).

**Memory types (Sprint 1):**
1. **Working memory** — current block's `data` JSONB + type + jurisdiction
2. **Episodic memory** — last N events on the block (default `MAX_CONTEXT_EVENTS = 20`)
3. **Graph context** — names and types of directly connected blocks (one hop from `block_edges`)
4. **Org context** — org name + current user role

**Deferred to Phase 2:** Semantic memory (pgvector similarity search), Procedural memory (workflow templates)

**Output format for `contextToPromptString(context)`:**
```
[CONTEXT]
Org: {org.name}
User role: {userRole}

Block: "{block.data.name}" (type: {block.type}, jurisdiction: {block.jurisdiction || "unset"})
Connected to: {neighbours.map(n => `"${n.data.name}" (${n.type})`).join(", ")}

Recent events (last {events.length}, newest first):
{events.map(e => `- [${e.occurred_at}] ${e.event_type} — actor: ${e.actor_type}/${e.actor_id || "system"} — ${JSON.stringify(e.payload).slice(0, 100)}`).join("\n")}
[END CONTEXT]
```

**Acceptance Criteria:**
- [ ] `assembleContext(blockId: string | null, orgId: string, userId: string): Promise<ContextObject>` exported from `lib/context-assembly.ts`
- [ ] Returns `{ block: Block | null, events: Event[], neighbours: Block[], org: Org, userRole: string }`
- [ ] `contextToPromptString(context: ContextObject): string` exported — formats context for Claude system prompt injection
- [ ] When `blockId` is null: assembles org-level context (last 20 events across all blocks)
- [ ] `MAX_CONTEXT_EVENTS = 20` defined as named constant (not magic number)
- [ ] Total context string ≤8000 tokens (rough guard: character count / 4 ≤ 8000)
- [ ] Unit tests: block with events, block with no events, null blockId (org context), context string format

**Applicable Gates:** 1, 2, 5
**Dependencies:** P1-S1-BE-01, P1-S1-BE-02, P1-S1-BE-03
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** AI-ML-ENGINEER

---

## P1-S1-AI-01: Basic Chat Endpoint

**Description:** Implement `POST /api/ai/chat`. Given a user message and optional `block_id`, assemble context using AI-02, call Claude Sonnet with streaming, return streamed response via SSE. This is NOT the confidence routing system. Users see Claude's response; Claude recommends actions but does not execute them.

**Request body:**
```typescript
{
  message: string;          // user's question or command
  blockId?: string;         // optional — for block-scoped context
  conversationHistory?: Array<{ role: "user" | "assistant", content: string }>;
}
```

**Response:** `text/event-stream` (Server-Sent Events) for streaming.

**System prompt template:**
```
You are an AI assistant for Ops OS, helping operations teams understand and manage their business workflows.

Today's date: {date}
{contextString}

Guidelines:
- When referencing historical events, cite the event type and when it occurred.
- When recommending an action, name the action type (e.g. "you could run the `compliance.review.start` action") rather than executing it.
- You do not execute actions directly. All actions require human approval.
- If you are unsure about something, say so rather than guessing.
- Keep responses concise and operational — this is a business tool, not a chatbot.
```

**Acceptance Criteria:**
- [ ] `POST /api/ai/chat` returns streamed response via SSE (`Content-Type: text/event-stream`)
- [ ] `blockId` provided: context includes block data + last 20 events + connected block names (via AI-02)
- [ ] No `blockId`: context includes org-level recent events (via AI-02)
- [ ] Model: `claude-sonnet-4-6`; `max_tokens: 1000` (Sprint 1 cost cap)
- [ ] Streaming works end-to-end: `curl -N -X POST ... /api/ai/chat` receives tokens progressively
- [ ] Auth required: 401 if no Clerk JWT
- [ ] Claude API failure → HTTP 503 with body `{"error": {"message": "AI service temporarily unavailable", "code": "ai/service_unavailable"}}`
- [ ] `conversationHistory` passed as Claude `messages` array (if provided; up to last 10 turns)
- [ ] Unit tests: context assembly called with correct blockId; stream initiated; 401 without auth
- [ ] Log: each request logs `{ orgId, blockId, messageLength, tokensUsed }` — no message content in logs (PII risk)

**Applicable Gates:** 1, 2, 3, 5, 6
**Dependencies:** P1-S1-BE-01, P1-S1-BE-02, P1-S1-BE-03, P1-S1-AI-02
**Complexity:** HIGH
**Estimate:** 3 days
**Assigned Role:** AI-ML-ENGINEER

---

## Phase 2 Preview (do not build in Sprint 1)

The following capabilities are explicitly out of Sprint 1 scope. Do not build them now — log them as signals in `research/signals/build-learnings.md` if you discover insights while building Sprint 1.

- Confidence scoring (is this action safe to auto-execute?)
- Risk policy engine (action risk levels, threshold comparison)
- Human approval queue (AI-proposed actions awaiting human review)
- Automatic action execution (executing actions without human approval)
- Full 4-type memory context (semantic + procedural memory)
- Haiku for extraction tasks (Phase 2+)
