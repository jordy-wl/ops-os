# Sprint 2 Dependencies

## Dependency Graph

```
BE-01 (new types) --------+
                           |
BE-02 (contact enrich) --- | --- independent
                           |
BE-03 (sub-org) ---------- | --- independent
                           |
                           v
                    BE-04 (seed migration)
                           |
                           v
                    BE-05 (dynamic validation)
                           |
                           v
                    FE-01 (creation UI)
                           |
                           v
                    QA-01 (test all)
```

## Critical Path

**BE-01 --> BE-04 --> BE-05 --> FE-01 --> QA-01**

This is the longest sequential chain. BE-02 and BE-03 can run in parallel with the critical path.

## Parallel Work Streams

| Stream | Tasks | Can Start |
|--------|-------|-----------|
| Critical path | BE-01 --> BE-04 --> BE-05 --> FE-01 | Immediately (BE-01) |
| Contact enrichment | BE-02 | Immediately |
| Sub-org hierarchy | BE-03 | Immediately |
| QA | QA-01 | After BE-05 + FE-01 |

## External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sprint 1 complete | Required | BE-01 dynamic validation groundwork |
| block_type_definitions table | DONE | Created in Phase 1, used in Phase 2 |
| Supabase orgs table | DONE | Created in Phase 1 |

## Inter-Sprint Dependencies

| This Sprint | Depends On | Status |
|-------------|-----------|--------|
| Sprint 2 | Sprint 1 BE-01 (dynamic block types) | OPEN |
| Sprint 3 | Sprint 2 BE-03 (sub-org hierarchy) | FUTURE |
| Sprint 3 | Sprint 2 BE-05 (dynamic validation) | FUTURE |
