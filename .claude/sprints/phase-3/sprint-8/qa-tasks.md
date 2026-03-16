# Sprint 8 — QA Tasks

Note: Sprint 8 does not have a dedicated QA task. QA coverage is embedded within each task's acceptance criteria and gate requirements. The backend tasks (BE-01, BE-02) include their own test files as part of the implementation. Frontend tasks include component-level test expectations in Gate 2.

If a separate QA pass is needed after all tasks complete, it should be added as a follow-up task in the next sprint's regression scope.

## Recommended Post-Sprint QA Focus Areas

- Settings sidebar navigation: all 10 sections render, active state works, mobile collapse functions
- Routing policy: save/load round-trip, validation errors shown for invalid input
- API key lifecycle: generate -> use -> revoke -> rejected after revocation
- Notification preferences: toggle state persists across page refresh
- Audit log: filters combine correctly, pagination loads more events, date range filters work
- Cross-cutting: RBAC enforcement (non-admin cannot access routing policies or API key management)
