# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 3 — Platform Evolution (RBAC, Routing Engine, Delta AI, Document Gen V2)
**Phase Status:** ACTIVE. Sprint 0 + Sprint 1 COMPLETE. Sprint 2 ready.
**Sprint:** 2 — New Block Types & Schema Foundation (7 tasks)
**Previous:** Sprint 1 DONE (6/6, 100%). Phase 2 CODE COMPLETE (86/88, 98%, 12 sprints, 550 tests)

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| (none active — Sprint 2 ready to claim) | | | | |

**Sprint metrics:** Phase 3: Sprints 0-1 DONE. 6/53 engineering tasks DONE (11%) across 8 planned sprints. Sprint 2 ready (7 tasks).

**Sprint 2 tasks (ready to claim):**
| Task ID | Title | Role | Status |
|---------|-------|------|--------|
| P3-S2-BE-01 | Define 5 new system block types | BE | OPEN |
| P3-S2-BE-02 | Enrich Contact block type | BE | OPEN |
| P3-S2-BE-03 | Sub-org hierarchy data model | BE | OPEN |
| P3-S2-BE-04 | Seed migration for new block types | BE | OPEN |
| P3-S2-BE-05 | Dynamic block type validation API | BE | OPEN |
| P3-S2-FE-01 | Update block creation UI for new types | FE | OPEN |
| P3-S2-QA-01 | Test new block types | QA | OPEN |

---

## Blockers

| Task ID | Task Title | Blocked By | Age (days) | Escalated? |
|---------|-----------|-----------|-----------|-----------|
| (none) | | | | |

---

## Signals Queue

| Date | Signal | Status |
|------|--------|--------|
| 2026-03-10 | shadcn JSX→TSX: components as `.jsx` lose all TypeScript type safety (P2-S11-FE-03) | CLOSED — 39 unused JSX files deleted in S16. 4 remaining `.jsx` files are shadcn library code. Not actionable for Phase 3. |

---

## Notes (cross-role communications)

| Date | Author | Note |
|------|--------|------|
| 2026-03-12 | ORCHESTRATOR | **PHASE 3 ACTIVATED** — 8 sprints planned, 53 tasks. Sprint 0 = scaffold updates (PRDs, rules, standards, agent personas, sprint task files). Sprint 1 = bug fixes + quick wins. Full plan in `.claude/plans/cozy-dancing-giraffe.md`. |
| 2026-03-12 | ORCHESTRATOR | **Phase 2 exit conditions re-scoped** — Original exit conditions required live design partner usage. Re-scoped as Phase 3 milestones since no design partners onboarded yet. Phase 2 closed as code-complete. |
| 2026-03-12 | ORCHESTRATOR | **Phase 3 scope confirmed with user**: 5 new block types (Solution, Product, Service, Team Member, Policy), custom RBAC (Clerk=login only), routing engine (Human/Agent/Auto), AI delta engine, document gen V2, enhanced task cards, workflow canvas I/O nodes, admin settings, bug fixes. Block-specific layouts deferred to Phase 4. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| (none yet) | | | | | |

---

## Recently Completed — Sprint 1 Archive

Sprint 1 (2026-03-12): 6/6 DONE (100%).
Deliverables: Fixed workflow creation 400 error (removed steps.min(1), dynamic block type validation via DB query), moved chat widget to bottom-right, added dark/light mode toggle (ThemeToggle component + flash prevention + localStorage persistence), fixed 5 responsive issues (chat widget fluid width, breadcrumb truncation, header stacking, task list + workflow template truncation). 550 tests passing. Lint + build clean.

## Recently Completed — Sprint 16 Archive

Sprint 16 FINAL (2026-03-11): 5/5 DONE (100%).
Deliverables: Full dark mode conversion (73 files, hardcoded gray→CSS vars), visual polish (consistent focus rings, hover states, primary buttons across all 58 components + 15 pages), dead code cleanup (41 files deleted — 39 unused shadcn components + app-nav.tsx + skeleton.jsx, ~3200 lines removed), performance audit (no pages >200kB, builder 176kB largest, shared bundle 102kB), full regression (550 tests, build clean 10.3s, lint clean). 100 files changed (+660/-3489). PR #39.

## Recently Completed — Sprint 15 Archive

Sprint 15 (2026-03-11): 5/5 DONE (100%).
Deliverables: Integration onboarding wizard (4-step: select provider → configure → test → complete; routes at /integrations/connect and /integrations/connect/[provider]; Google OAuth, Webhook URL+HMAC, Custom API endpoint+key), AI entity creation tools (enhanced create_block with field validation against block_type field_schema + Dice coefficient duplicate detection at 0.85 threshold, new list_block_types tool, entity-creation.ts + research-tools.ts + entity-creation.v1.md prompt), @mention block autocomplete (@ trigger, 300ms debounced search via GET /api/blocks?q=, keyboard nav ArrowUp/Down/Enter/Escape, click-outside close, type badges, dropdown above input), block creation preview (BlockCreationPreview component for create_block tool calls — 3 states: created/duplicate_warning/error with block card + fields + warnings), blocks API q param added. 17 files changed (+550/-68). Test count: 550 (+29).

## Recently Completed — Sprint 14 Archive

Sprint 14 (2026-03-11): 6/6 DONE (100%).
Deliverables: Chat widget shell (bottom-left floating, 480x600, slide-up animation, localStorage persistence), 3 AI modes (discuss/plan/execute) with mode-specific system prompts, execute mode multi-turn tool_use loop (max 3 rounds) with RBAC at tool handler layer (ops-admin only for mutations), page context endpoint + auto-tracking, full-page chat replaced with redirect. 4 chat tools. New test infra: @testing-library/react + jsdom + @vitejs/plugin-react. Test count: 521 (+35). PR #37 merged.

## Recently Completed — Sprint 13 Archive

Sprint 13 (2026-03-11): 5/5 DONE (100%).
Deliverables: update_block step handler, Update Block canvas node, onboarding removal, canvas-first workflow creation. Test count: 486. PR #36 merged.

## Earlier Sprints

Sprints 1–12 complete. Full details in `shared-state-history.md`.
