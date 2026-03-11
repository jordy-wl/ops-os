# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 14
**Sprint Goal:** Replace full-page chat with collapsible bottom-left widget. Discuss/Plan/Execute modes. Page context integration. Tool-use with RBAC.
**Sprint Started:** 2026-03-11
**Sprint Target End:** 2026-03-25

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P2-S14-BE-01 | Chat API mode support | Backend | OPEN | 2026-03-11 |
| P2-S14-BE-02 | Page context endpoint | Backend | OPEN | 2026-03-11 |
| P2-S14-FE-01 | Chat widget shell | Frontend | OPEN | 2026-03-11 |
| P2-S14-FE-02 | Page context integration | Frontend | OPEN | 2026-03-11 |
| P2-S14-FE-03 | Remove/redirect full-page chat | Frontend | OPEN | 2026-03-11 |
| P2-S14-QA-01 | Chat widget tests | QA | OPEN | 2026-03-11 |

**Sprint metrics:** 0/6 DONE (0%). Sprint 14 initiated.

**Critical path:** FE-01 → FE-02 → FE-03 | BE-01 and BE-02 independent

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
| 2026-03-11 | ORCHESTRATOR | **SPRINT 13 RETRO COMPLETE** — 5/5 DONE (100%). update_block step handler with expression whitelist, Update Block canvas node + config panel, onboarding removal (4 files deleted), canvas-first workflow creation (name-only modal → builder redirect), 11 new tests. 486 tests (+2 net). PR #36 merged. |
| 2026-03-11 | ORCHESTRATOR | **SPRINT 14 INITIATED** — 6 tasks (2 BE, 3 FE, 1 QA). Chat widget + AI modes. Critical path: FE-01 → FE-02 → FE-03. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| (none yet) | | | | | |

---

## Recently Completed — Sprint 13 Archive

Sprint 13 (2026-03-11): 5/5 DONE (100%).
Deliverables: update_block step handler (expression whitelist, field validation, metadata PATCH, block.updated event), Update Block canvas node (Pencil icon, palette entry, config panel with dynamic field editor), onboarding removal (4 files deleted: onboarding-start.ts, onboarding.ts, onboarding.test.ts, start-onboarding-button.tsx), canvas-first workflow creation (name-only modal, builder redirect, inline name editing, trigger pre-placement). 30 files changed, +1564/-697. Test count: 486 (+2 net). PR #36 merged.

## Recently Completed — Sprint 12 Archive

Sprint 12 (2026-03-11): 6/6 DONE (100%).
Deliverables: 12 field type definitions (field-types.ts), field schema builder (add/remove/update/extract), AJV strict:false for x-* extensions, field management API (GET/POST/PATCH/DELETE with system field protection + relation constraints), 7 per-type field components (date, multi-select, currency, url, phone, rich-text, relation), DynamicFieldRenderer V2 dispatcher, BlockDataPanel inline editing, settings block-types list + detail pages, FieldManager + FieldConfigPanel. Test count: 484 (+75). PR #35.

## Recently Completed — Sprint 11 Archive

Sprint 11 (2026-03-10): 7/7 DONE (100%).
Deliverables: Persistent left sidebar (SidebarProvider, cookie state, mobile overlay, Cmd+B), Geist font integration, 7 animation keyframes + 5 utility classes, 6 shadcn JSX→TSX conversions, PageContainer + ContentSection layout components, 9 loading skeletons standardized, 14 navigation regression tests. Test count: 409 (+14). PR #34.

## Earlier Sprints

Sprints 1–10 complete. Full details in `shared-state-history.md`.
