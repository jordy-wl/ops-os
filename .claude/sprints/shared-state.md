# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 15
**Sprint Goal:** Self-service integration connection wizard. AI entity creation tools with duplicate detection. @mention block autocomplete in chat.
**Sprint Started:** 2026-03-11
**Sprint Target End:** 2026-03-25

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P2-S15-FE-01 | Integration onboarding wizard | Frontend | OPEN | 2026-03-11 |
| P2-S15-BE-01 | AI entity creation tools | Backend/AI | OPEN | 2026-03-11 |
| P2-S15-FE-02 | AI creation UX in chat widget | Frontend | OPEN | 2026-03-11 |
| P2-S15-FE-03 | @mention block autocomplete | Frontend | OPEN | 2026-03-11 |
| P2-S15-QA-01 | Integration and AI tests | QA | OPEN | 2026-03-11 |

**Sprint metrics:** 0/5 DONE (0%). Sprint 15 initiated.

**Critical path:** BE-01 (AI entity creation) → FE-02 (creation UX) → QA-01 | FE-01 and FE-03 independent

---

## Blockers

| Task ID | Task Title | Blocked By | Age (days) | Escalated? |
|---------|-----------|-----------|-----------|-----------|
| (none) | | | | |

---

## Signals Queue

| Date | Signal | Status |
|------|--------|--------|
| 2026-03-10 | shadcn JSX→TSX: components as `.jsx` lose all TypeScript type safety (P2-S11-FE-03) | PENDING |

---

## Notes (cross-role communications)

| Date | Author | Note |
|------|--------|------|
| 2026-03-11 | ORCHESTRATOR | **SPRINT 14 RETRO COMPLETE** — 6/6 DONE (100%). Chat widget (bottom-left, 480x600, slide-up), 3 AI modes (discuss/plan/execute), mode-specific prompts, execute mode tool_use with RBAC (ops-admin only), page context endpoint + auto-tracking, full-page chat removed. 35 new tests (521 total). PR #37 merged. |
| 2026-03-11 | ORCHESTRATOR | **SPRINT 15 INITIATED** — 5 tasks (1 BE/AI, 3 FE, 1 QA). Integration wizard + AI entity creation + @mention. 3 tasks can start in parallel: FE-01, BE-01, FE-03. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| (none yet) | | | | | |

---

## Recently Completed — Sprint 14 Archive

Sprint 14 (2026-03-11): 6/6 DONE (100%).
Deliverables: Chat widget shell (bottom-left floating, 480x600, slide-up animation, localStorage persistence), 3 AI modes (discuss/plan/execute) with mode-specific system prompts, execute mode multi-turn tool_use loop (max 3 rounds) with RBAC at tool handler layer (ops-admin only for mutations), page context endpoint (auto-detects page type from route, fetches block + events + related), page context integration (usePathname tracking, blockId extraction), full-page chat replaced with redirect. 4 chat tools: search_blocks, create_block, update_block, trigger_workflow. New test infra: @testing-library/react + jsdom + @vitejs/plugin-react. 21 files changed, +1862/-48. Test count: 521 (+35). PR #37 merged.

## Recently Completed — Sprint 13 Archive

Sprint 13 (2026-03-11): 5/5 DONE (100%).
Deliverables: update_block step handler (expression whitelist, field validation, metadata PATCH, block.updated event), Update Block canvas node (Pencil icon, palette entry, config panel with dynamic field editor), onboarding removal (4 files deleted), canvas-first workflow creation (name-only modal, builder redirect, inline name editing, trigger pre-placement). 30 files changed, +1564/-697. Test count: 486 (+2 net). PR #36 merged.

## Recently Completed — Sprint 12 Archive

Sprint 12 (2026-03-11): 6/6 DONE (100%).
Deliverables: 12 field type definitions, field schema builder, field management API, 7 per-type field components, DynamicFieldRenderer V2, BlockDataPanel inline editing, settings block-types pages. Test count: 484 (+75). PR #35.

## Earlier Sprints

Sprints 1–11 complete. Full details in `shared-state-history.md`.
