# Sprint 14 Dependencies

```
BE-01 (chat API modes) ────── no deps (start immediately)
BE-02 (page context) ─────── no deps (start immediately)

FE-01 (widget shell) ─────── no deps (start immediately, CRITICAL PATH)
  ├── FE-02 (page context) ── waits for FE-01 + BE-02
  ├── FE-03 (remove old chat) ── waits for FE-01
  └── QA-01 (tests) ───────── waits for FE-01 + BE-01
```

## Critical Path
FE-01 → FE-02 → FE-03

## Parallel Tracks
- Track A: BE-01 + BE-02 (backend, independent)
- Track B: FE-01 (frontend, critical path)
- Track C: QA-01 (after Track A + B converge)

## External Dependencies
- Sprint 13 COMPLETE (merged PR #36)
- Existing chat components: chat-panel.tsx, chat-message.tsx, chat-input.tsx
- Existing AI prompts: src/prompts/chat-system.v1.md
- Animation system from Sprint 11 (fade-in, slide-up keyframes)
