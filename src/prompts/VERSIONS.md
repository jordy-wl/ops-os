# Prompt Version Registry

| Feature | Version | Date | Author | Pass Rate | What Changed |
|---------|---------|------|--------|-----------|-------------|
| chat-system | v1 | 2026-03-02 | AI-ML-ENGINEER | Pending eval | Initial version — Sprint 1. Establishes tone (operational, not chatbot), action-naming convention, and human-approval requirement. |

## Eval Notes

Eval suite deferred to Phase 2 per Sprint 1 scope (`prd/07-ai-ml-spec.md`).
Baseline results will be recorded in `sprint-1/gate-results.md` once manual smoke tests complete (DE-01 seed data required).

## Versioning Rules (from ai-ml-standards.md)

- NEVER overwrite an existing prompt file — create a new version file.
- File naming: `{feature-name}.v{N}.md`
- Every version file must contain: version number, date, author, what changed from previous version, eval result that triggered the change.
- Update this registry table whenever a new version is created.
