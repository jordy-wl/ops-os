# Prompt Version Registry

| Feature | Version | Date | Author | Pass Rate | What Changed |
|---------|---------|------|--------|-----------|-------------|
| chat-system | v1 | 2026-03-02 | AI-ML-ENGINEER | Pending eval | Initial version — Sprint 1. Establishes tone (operational, not chatbot), action-naming convention, and human-approval requirement. |
| delta-insights | v1 | 2026-03-12 | AI-ML-ENGINEER | 22/22 (100%) | Initial version — Sprint 7. Generates 4-section insights (whatsDone, whatsNext, whatsAtRisk, recommendations) from delta analysis. |
| delta-chat-context | v1 | 2026-03-12 | AI-ML-ENGINEER | 15/15 (100%) | Initial version — Sprint 7. Delta-aware chat context instructions: how to interpret WORKFLOW DELTA sections, available actions (reassign_step, extend_deadline), response guidelines. |
| chat-discuss-mode | v2 | 2026-03-18 | AI-ML-ENGINEER | Pending eval | Adds user context awareness, delta reasoning instructions, and `<SUGGESTIONS>` extraction block for actionable chips. |
| chat-plan-mode | v2 | 2026-03-18 | AI-ML-ENGINEER | Pending eval | Adds user context awareness, delta-informed planning, qualifying questions, and `<PLAN_JSON>` structured output for interactive accept/reject/modify UI. |
| chat-discuss-mode | v3 | 2026-03-25 | AI-ML-ENGINEER | Pending eval | Adds `<MODE_SUGGESTION>` tag output — AI suggests transitioning to plan mode when user describes goals or multi-step tasks. Adds `## Mention Context` section — documents `<MENTION_CONTEXT>` injection format (block, type_query, field_query, value_query) with data-accuracy and distribution-citation guidelines. |
| chat-plan-mode | v3 | 2026-03-25 | AI-ML-ENGINEER | Pending eval | Adds `<MODE_SUGGESTION>` tag output — AI suggests execute mode on plan acceptance, or discuss mode when user wants more discussion. Adds `## Mention Context` section — documents `<MENTION_CONTEXT>` injection format with plan-grounding and complexity-scoping guidelines. |
| chat-execute-mode | v2 | 2026-03-25 | AI-ML-ENGINEER | Pending eval | Adds `<MODE_SUGGESTION>` tag output — AI suggests returning to discuss mode after completing all requested actions. Adds `## Mention Context` section — documents `<MENTION_CONTEXT>` injection format with tool-targeting and action-confirmation guidelines. |
| block-suggestions | v1 | 2026-03-18 | AI-ML-ENGINEER | Pending eval | Block-type-specific AI suggestion generation. Returns typed suggestions (action/insight/risk/next_step) with priority levels. |

## Eval Notes

Eval suite deferred to Phase 2 per Sprint 1 scope (`prd/07-ai-ml-spec.md`).
Baseline results will be recorded in `sprint-1/gate-results.md` once manual smoke tests complete (DE-01 seed data required).

## Versioning Rules (from ai-ml-standards.md)

- NEVER overwrite an existing prompt file — create a new version file.
- File naming: `{feature-name}.v{N}.md`
- Every version file must contain: version number, date, author, what changed from previous version, eval result that triggered the change.
- Update this registry table whenever a new version is created.
