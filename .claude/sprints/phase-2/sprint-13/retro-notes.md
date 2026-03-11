# Sprint 13 Retrospective

**Date:** 2026-03-11
**Completion Rate:** 5/5 tasks, 100%
**Conducted by:** ORCHESTRATOR

## What Went Well
- All 5 tasks completed in a single session — efficient execution with clear plan from Sprint 13 task file
- update_block handler's expression whitelist approach (ALLOWED_EXPRESSION_PREFIXES) is clean and extensible
- Onboarding removal was surgical — grep confirmed zero dead imports; only placeholder text remains
- Canvas-first workflow creation dramatically simplifies the UX (300-line modal → 120-line name-only dialog)
- Test count stayed stable despite major deletions (486 = 484 + 18 new - 16 removed)

## What Was Harder Than Expected
- Canvas-layout test file had a subtle syntax error (premature describe close at line 362) that was only caught by running full test suite — test file structure needs more careful insertion point verification
- e2e-workflow.test.ts had an assertion expecting `onboarding.start` in REGISTRY — cross-file test dependencies need to be traced before deletions
- The update_block config panel needed a custom field editor (add/remove/rename with key preservation) — more complex than a simple form, but necessary for the template expression UX

## Build Signals Generated This Sprint
- 0 new signals this sprint
- 1 PENDING signal from Sprint 11 (shadcn JSX→TSX)
- No strong signal patterns emerging

## Phase Exit Condition Status
- ≥5 complete workflows using canvas + Google + doc gen: NOT MET (infrastructure built, no live runs)
- ≥1 workflow with email + document generation: NOT MET (steps exist, no combined run)
- Internal company onboarding preparation: NOT MET (not documented yet)

## Next Sprint Priorities
1. **Chat widget shell (FE-01)** — critical path; FE-02, FE-03, and QA-01 all depend on it
2. **Chat API mode support (BE-01)** — parallel with widget; defines the discuss/plan/execute backend
3. **Page context integration (FE-02)** — makes the widget context-aware and genuinely useful

## What the Next Sprint Must Account For
- **Execute mode security:** RBAC must be enforced at the tool execution layer, not just in prompts. Cap tool calls at 3 per conversation.
- **Widget performance:** Lazy-load the chat widget to avoid increasing initial bundle size
- **Prompt engineering:** Three mode-specific system prompts need careful crafting — plan mode should output structured steps, execute mode should use tool_use correctly
- **Existing chat code reuse:** chat-message.tsx and chat-input.tsx should be refactored into the widget, not duplicated
