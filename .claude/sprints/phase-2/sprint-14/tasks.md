# Sprint 14 Tasks — Chat Widget + AI Modes

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 14
**Sprint Goal:** Replace full-page chat with a collapsible bottom-left widget supporting Discuss/Plan/Execute modes. Page context integration. Tool-use in Execute mode with RBAC enforcement.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 13 (update_block + Canvas-First) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S14-BE-01 | Chat API mode support | Backend | MED | — | OPEN |
| P2-S14-BE-02 | Page context endpoint | Backend | LOW | — | OPEN |
| P2-S14-FE-01 | Chat widget shell | Frontend | HIGH | — | OPEN |
| P2-S14-FE-02 | Page context integration | Frontend | MED | BE-02, FE-01 | OPEN |
| P2-S14-FE-03 | Remove/redirect full-page chat | Frontend | LOW | FE-01 | OPEN |
| P2-S14-QA-01 | Chat widget tests | QA | MED | BE-01, FE-01 | OPEN |

**Total:** 6 tasks (2 BE, 3 FE, 1 QA)
**Critical path:** FE-01 (widget shell) → FE-02 (context integration) → FE-03 (remove old chat)

---

## Task Details

### P2-S14-BE-01 — Chat API Mode Support (MED)

**What:** Extend the existing chat API (`/api/ai/chat/route.ts`) to accept a `mode` field (discuss/plan/execute). Each mode uses a different system prompt. Execute mode includes tool definitions for Claude tool_use.

**Context:**
- Existing: `src/app/api/ai/chat/route.ts` — current chat endpoint (single mode)
- Existing: `src/lib/ai/context-assembly.ts` — context building for chat
- Existing: `src/prompts/chat-system.v1.md` — current system prompt

**Files to modify:**
- `src/app/api/ai/chat/route.ts` — add `mode` field to request body, select prompt by mode, pass tools for execute mode

**Files to create:**
- `src/prompts/chat-discuss-mode.v1.md` — discuss mode system prompt (general conversation, Q&A about blocks/workflows)
- `src/prompts/chat-plan-mode.v1.md` — plan mode system prompt (structured plan output, step-by-step proposals)
- `src/prompts/chat-execute-mode.v1.md` — execute mode system prompt (tool-use, action-oriented)
- `src/lib/ai/chat-tools.ts` — tool definitions: `trigger_workflow`, `create_block`, `update_block`, `search_blocks`

**Execute mode tool_use:**
- Tools defined with JSON schemas matching Claude tool_use spec
- RBAC enforced at tool execution layer — check user role before executing (not just in prompt)
- Cap tool calls per conversation: 3 max
- Each tool validates inputs and returns structured results

**Gates:** G1, G2, G3, G5

---

### P2-S14-BE-02 — Page Context Endpoint (LOW)

**What:** Create an endpoint that accepts a route path + optional block ID and returns assembled context for the chat widget.

**Context:**
- Existing: `src/lib/ai/context-assembly.ts` — context building

**Files to create:**
- `src/app/api/ai/page-context/route.ts` — GET endpoint accepting `?path=/blocks/123&blockId=abc`

**Logic:**
- Parse route path to determine page type (dashboard, block detail, workflow builder, etc.)
- If block detail page: fetch block + recent events + related blocks
- If workflow page: fetch template metadata
- Return structured context object for chat system prompt injection

**Gates:** G1, G2, G3, G5

---

### P2-S14-FE-01 — Chat Widget Shell (HIGH)

**What:** Create a floating bottom-left chat widget (480x600px) with slide-up animation, mode tabs (Discuss/Plan/Execute), and message rendering.

**Context:**
- Existing: `src/components/chat/chat-panel.tsx` — current full-page chat panel
- Existing: `src/components/chat/chat-message.tsx` — message rendering
- Existing: `src/components/chat/chat-input.tsx` — input component
- Existing: `src/app/(app)/layout.tsx` — app layout

**Files to create:**
- `src/components/chat/chat-widget.tsx` — floating widget (collapsed/expanded, 480x600, slide-up animation, drag handle)
- `src/components/chat/chat-widget-provider.tsx` — React context provider for widget state (open/closed, mode, page context)
- `src/components/chat/mode-selector.tsx` — Discuss/Plan/Execute tab bar
- `src/components/chat/plan-message.tsx` — structured plan rendering (numbered steps, checkboxes)
- `src/components/chat/execute-confirmation.tsx` — confirmation dialog before tool execution

**Files to modify:**
- `src/app/(app)/layout.tsx` — wrap with ChatWidgetProvider, render ChatWidget

**Widget behavior:**
- Collapsed: small icon button (bottom-left, 48x48px)
- Expanded: 480x600px card with header (mode tabs), messages area, input
- Slide-up animation using existing animation system from Sprint 11
- Persists open/closed state in localStorage
- Mode selector: 3 tabs with distinct visual treatment
- Execute mode: shows confirmation dialog before any tool call
- Plan mode: renders structured plans with step numbers

**Gates:** G1, G2, G4, G5

---

### P2-S14-FE-02 — Page Context Integration (MED)

**What:** Chat widget automatically detects the current page and assembles context. Block detail pages auto-select the block. @mention autocomplete in chat input.

**Context:**
- Depends on: FE-01 (widget shell), BE-02 (context endpoint)

**Files to modify:**
- `src/components/chat/chat-widget-provider.tsx` — track `usePathname()`, auto-fetch page context on route change
- `src/components/chat/chat-input.tsx` — add @mention autocomplete (search blocks by name)

**Logic:**
- Provider tracks current route via `usePathname()`
- On route change: call `/api/ai/page-context?path=...&blockId=...`
- Context injected into chat system prompt
- @mention: typing `@` triggers block search dropdown, selection inserts `@BlockName (id:...)` into message

**Gates:** G1, G4, G5

---

### P2-S14-FE-03 — Remove/Redirect Full-Page Chat (LOW)

**What:** Redirect `/chat` to dashboard with auto-open widget. Remove "Chat" from sidebar navigation.

**Context:**
- Existing: `src/app/(app)/chat/page.tsx` — full-page chat
- Existing: `src/components/shell/app-sidebar.tsx` — sidebar nav

**Files to modify:**
- `src/app/(app)/chat/page.tsx` — replace with redirect to `/` + open widget flag
- `src/components/shell/app-sidebar.tsx` — remove Chat nav item

**Gates:** G1, G5

---

### P2-S14-QA-01 — Chat Widget Tests (MED)

**What:** Tests for mode switching, system prompt per mode, page context, widget open/close.

**Files to create:**
- `src/components/chat/__tests__/chat-widget.test.tsx` — widget UI tests (open/close, mode switching, animation)
- `src/components/chat/__tests__/mode-selector.test.tsx` — mode tab tests
- `src/lib/ai/__tests__/chat-tools.test.ts` — tool definition tests, RBAC enforcement
- `src/app/api/ai/__tests__/page-context.test.ts` — page context endpoint tests

**Test cases:**
- Widget: renders collapsed, expands on click, closes on escape, persists state
- Mode selector: switches between discuss/plan/execute, visual indicator on active mode
- Chat tools: tool definitions match expected schemas, RBAC rejects non-admin execute
- Page context: returns block context for block detail page, minimal context for dashboard
- System prompt: each mode uses different prompt, execute mode includes tools

**Gates:** G1, G2, G5

---

## Dependencies

```
BE-01 (chat API modes) ────── independent
BE-02 (page context) ─────── independent

FE-01 (widget shell) ─────── independent
  ├── FE-02 (page context) ── depends on FE-01 + BE-02
  ├── FE-03 (remove old chat) ── depends on FE-01
  └── QA-01 (tests) ───────── depends on FE-01 + BE-01
```
