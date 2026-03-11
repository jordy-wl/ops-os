# Sprint 16 Dependencies

## Dependency Graph

```
FE-01 (visual polish) ──── independent ──┐
FE-02 (dark mode) ──────── independent ──┤
FE-03 (dead code) ──────── independent ──┤
OPS-01 (performance) ───── independent ──┤
                                         │
QA-01 (regression) ── depends on FE-01 + FE-02 + FE-03
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 15 complete | DONE | All 5 tasks done, 550 tests |
| All Sprint 11-14 PRs merged | DONE | PRs #34-#37 |
| Chat widget infrastructure | DONE | Sprint 14 |
| Integration wizard | DONE | Sprint 15 |
| AI entity creation | DONE | Sprint 15 |

## Parallelization

Four tasks can start immediately in parallel:
1. FE-01 (Visual polish)
2. FE-02 (Dark mode)
3. FE-03 (Dead code cleanup)
4. OPS-01 (Performance audit)

Then:
5. QA-01 (Full regression) — after all FE tasks complete
