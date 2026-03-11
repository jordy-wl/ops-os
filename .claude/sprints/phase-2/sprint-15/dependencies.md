# Sprint 15 Dependencies

## Dependency Graph

```
FE-01 (wizard) ──────────── independent ──┐
BE-01 (AI entity creation) ── independent ──┤
FE-03 (@mention) ─────────── independent ──┤
                                           │
FE-02 (AI creation UX) ── depends on BE-01 ─┤
                                           │
QA-01 (tests) ────── depends on FE-01 + BE-01 + FE-02
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 14 complete | DONE | PR #37 merged |
| Chat tools infrastructure | DONE | `src/lib/ai/chat-tools.ts` from Sprint 14 |
| Widget provider | DONE | `chat-widget-provider.tsx` from Sprint 14 |
| Block types + field schemas | DONE | Sprint 12 |
| Embeddings search | DONE | Sprint 1 |
| Integration connectors API | DONE | Sprint 6 |
| Google OAuth | DONE | Sprint 8 |

## Parallelization

Three tasks can start immediately in parallel:
1. FE-01 (Integration wizard) — no dependencies
2. BE-01 (AI entity creation) — no dependencies
3. FE-03 (@mention autocomplete) — no dependencies

Then:
4. FE-02 (AI creation UX) — after BE-01 completes
5. QA-01 (tests) — after FE-01 + BE-01 + FE-02 complete
