# Sprint 14 — Frontend Engineer Tasks

**Sprint:** 14 — Chat Widget + AI Modes
**Role:** Frontend Engineer

---

## P2-S14-FE-01 — Chat Widget Shell (HIGH)

**Priority:** 1 (critical path — FE-02, FE-03, QA-01 all depend on this)
**Dependencies:** None
**Gates:** G1, G2, G4, G5

Create floating bottom-left chat widget (480x600px). Slide-up animation. Mode tabs (Discuss/Plan/Execute). ChatWidgetProvider context in app layout. Reuse existing chat-message + chat-input components where possible.

**Key files:**
- Create: `src/components/chat/chat-widget.tsx`, `chat-widget-provider.tsx`, `mode-selector.tsx`, `plan-message.tsx`, `execute-confirmation.tsx`
- Modify: `src/app/(app)/layout.tsx`

---

## P2-S14-FE-02 — Page Context Integration (MED)

**Priority:** 2 (after FE-01 + BE-02)
**Dependencies:** P2-S14-FE-01, P2-S14-BE-02
**Gates:** G1, G4, G5

Track `usePathname()` in ChatWidgetProvider to auto-fetch page context. @mention autocomplete in chat input for block search.

**Key files:**
- Modify: `src/components/chat/chat-widget-provider.tsx`, `src/components/chat/chat-input.tsx`

---

## P2-S14-FE-03 — Remove/Redirect Full-Page Chat (LOW)

**Priority:** 3 (after FE-01)
**Dependencies:** P2-S14-FE-01
**Gates:** G1, G5

Redirect `/chat` to dashboard with widget auto-open. Remove "Chat" from sidebar nav.

**Key files:**
- Modify: `src/app/(app)/chat/page.tsx`, `src/components/shell/app-sidebar.tsx`
