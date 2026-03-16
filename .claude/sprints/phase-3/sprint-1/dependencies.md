# Sprint 1 Dependencies

## Dependency Graph

```
BE-01 (workflow fix) -------- independent --+
FE-01 (chat position) ------ independent --+
FE-02 (theme toggle) ------- independent --+
FE-03 (responsive fixes) --- independent --+
ORC-01 (coordination) ------ DONE ---------+
                                            |
QA-01 (regression) -- depends on BE-01 + FE-01 + FE-02 + FE-03
```

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Phase 2 Sprint 16 complete | DONE | 86/88 tasks, 550 tests |
| All Phase 2 PRs merged | DONE | PRs through #39 |
| Dark mode CSS variables | DONE | Sprint 16 FE-01 converted 73 files |
| Chat widget infrastructure | DONE | Sprint 14 |

## Parallelization

All four engineering tasks can start immediately in parallel:
1. BE-01 (Workflow creation fix)
2. FE-01 (Chat widget position)
3. FE-02 (Theme toggle)
4. FE-03 (Responsive fixes)

Then:
5. QA-01 (Regression) -- after all BE/FE tasks complete

## Inter-Sprint Dependencies

| This Sprint | Depends On | Status |
|-------------|-----------|--------|
| Sprint 1 | Phase 2 complete | DONE |
| Sprint 2 | Sprint 1 BE-01 (dynamic block types) | OPEN |
