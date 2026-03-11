# Sprint 14 — Backend Engineer Tasks

**Sprint:** 14 — Chat Widget + AI Modes
**Role:** Backend Engineer

---

## P2-S14-BE-01 — Chat API Mode Support (MED)

**Priority:** 1 (no deps — start immediately)
**Dependencies:** None
**Gates:** G1, G2, G3, G5

Extend `/api/ai/chat/route.ts` to accept `mode` field (discuss/plan/execute). Create mode-specific system prompts. For execute mode, define Claude tool_use tools (`trigger_workflow`, `create_block`, `update_block`, `search_blocks`). RBAC enforcement at tool execution layer — ops-admin only for execute mode tools. Cap tool calls at 3 per conversation.

**Key files:**
- Modify: `src/app/api/ai/chat/route.ts`
- Create: `src/prompts/chat-discuss-mode.v1.md`, `src/prompts/chat-plan-mode.v1.md`, `src/prompts/chat-execute-mode.v1.md`
- Create: `src/lib/ai/chat-tools.ts`

---

## P2-S14-BE-02 — Page Context Endpoint (LOW)

**Priority:** 2 (FE-02 depends on this)
**Dependencies:** None
**Gates:** G1, G2, G3, G5

Create `GET /api/ai/page-context?path=...&blockId=...` endpoint. Parse route path to determine page type. Fetch block + recent events + related blocks for block detail pages. Return structured context for chat system prompt.

**Key files:**
- Create: `src/app/api/ai/page-context/route.ts`
