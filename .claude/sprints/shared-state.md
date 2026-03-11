# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 13
**Sprint Goal:** update_block step type for living blocks, remove hardcoded onboarding, canvas-first workflow creation.
**Sprint Started:** 2026-03-11
**Sprint Target End:** 2026-03-25

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P2-S13-BE-01 | `update_block` step type | Backend | OPEN | 2026-03-11 |
| P2-S13-FE-01 | Update Block canvas node | Frontend | OPEN | 2026-03-11 |
| P2-S13-BE-02 | Remove hardcoded onboarding | Backend | OPEN | 2026-03-11 |
| P2-S13-FE-02 | Canvas-first workflow creation | Frontend | OPEN | 2026-03-11 |
| P2-S13-QA-01 | Workflow system tests | QA | OPEN | 2026-03-11 |

**Sprint metrics:** 0/5 DONE (0%). Sprint 13 initiated.

**Critical path:** BE-01 → FE-01 → QA-01 | BE-02 and FE-02 independent

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
| 2026-03-11 | ORCHESTRATOR | **SPRINT 12 RETRO COMPLETE** — 6/6 DONE (100%). User-configurable block fields: 12 field types with x-* extensions, field management API (CRUD), admin config UI, 7 per-type field components, inline editing on block detail. 484 tests (+75). PR #35. |
| 2026-03-11 | ORCHESTRATOR | **SPRINT 13 INITIATED** — 5 tasks (2 BE, 2 FE, 1 QA). update_block step + onboarding removal + canvas-first creation. Critical path: BE-01 → FE-01 → QA-01. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| (none yet) | | | | | |

---

## Recently Completed — Sprint 12 Archive

Sprint 12 (2026-03-11): 6/6 DONE (100%).
Deliverables: 12 field type definitions (field-types.ts), field schema builder (add/remove/update/extract), AJV strict:false for x-* extensions, field management API (GET/POST/PATCH/DELETE with system field protection + relation constraints), 7 per-type field components (date, multi-select, currency, url, phone, rich-text, relation), DynamicFieldRenderer V2 dispatcher, BlockDataPanel inline editing, settings block-types list + detail pages, FieldManager + FieldConfigPanel. Test count: 484 (+75). PR #35.

## Recently Completed — Sprint 11 Archive

Sprint 11 (2026-03-10): 7/7 DONE (100%).
Deliverables: Persistent left sidebar (SidebarProvider, cookie state, mobile overlay, Cmd+B), Geist font integration, 7 animation keyframes + 5 utility classes, 6 shadcn JSX→TSX conversions, PageContainer + ContentSection layout components, 9 loading skeletons standardized, 14 navigation regression tests. Test count: 409 (+14). PR #34.

## Recently Completed — Sprint 10 Archive

Sprint 10 (2026-03-10): 8/8 DONE (100%).
Deliverables: UX research + design spec, dashboard overhaul, loading skeletons, PageHeader + Skeleton + EmptyState + ErrorBoundary, nav fixes, breadcrumbs, event color coding, seed demo script, E2E workflow test, manual test plan. Test count: 395 (+13).

## Earlier Sprints

Sprints 1–9 complete. Full details in `shared-state-history.md`.
