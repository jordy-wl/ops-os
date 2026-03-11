# Sprint 14 — QA Engineer Tasks

**Sprint:** 14 — Chat Widget + AI Modes
**Role:** QA Engineer

---

## P2-S14-QA-01 — Chat Widget Tests (MED)

**Priority:** 1 (after FE-01 + BE-01)
**Dependencies:** P2-S14-FE-01, P2-S14-BE-01
**Gates:** G1, G2, G5

Test mode switching, system prompt per mode, page context, widget open/close. Test tool definitions and RBAC enforcement for execute mode.

**Key files:**
- Create: `src/components/chat/__tests__/chat-widget.test.tsx`, `__tests__/mode-selector.test.tsx`
- Create: `src/lib/ai/__tests__/chat-tools.test.ts`
- Create: `src/app/api/ai/__tests__/page-context.test.ts`

**Test cases:** Widget lifecycle (open/close/persist), mode switching, tool RBAC, page context assembly, prompt-per-mode
