# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 3 — Platform Evolution (RBAC, Routing Engine, Delta AI, Document Gen V2, Block Configurability)
**Phase Status:** ACTIVE. Sprints 0-6 COMPLETE. Sprint 7 READY.
**Sprint:** 7 — AI Delta Engine + Inline Field Manager (8 tasks) — READY
**Previous:** Sprint 6 DONE (8/8, 100%). Sprint 5 DONE (9/9, 100%).

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P3-S7-AI-01 | Delta calculation engine | AI/ML | OPEN | 2026-03-12 |
| P3-S7-AI-02 | AI Insights generator | AI/ML | OPEN | 2026-03-12 |
| P3-S7-BE-01 | Auto task generation from deltas | Backend | OPEN | 2026-03-12 |
| P3-S7-FE-01 | AI Insights panel component | Frontend | OPEN | 2026-03-12 |
| P3-S7-FE-02 | Inline field manager on block detail page | Frontend | OPEN | 2026-03-12 |
| P3-S7-AI-03 | Delta-aware chat context | AI/ML | OPEN | 2026-03-12 |
| P3-S7-BE-02 | Notification system foundation | Backend | OPEN | 2026-03-12 |
| P3-S7-QA-01 | Delta engine + field manager tests | QA | OPEN | 2026-03-12 |

**Sprint metrics:** Phase 3: Sprints 0-6 DONE. Sprint 7: 0/8 DONE (0%). 46/69 engineering tasks DONE (67%) across 8 planned sprints. 885 tests passing.

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
| 2026-03-12 | ORCHESTRATOR | **Block configurability scope added** — 8 new tasks woven across Sprints 5-8: field group schema, AI field suggestion engine, block config chat tools, field group UI, AI-assisted block creation, inline field manager, org page. Manual + AI-guided, applies to every block type. Total Phase 3 tasks now 69 (was 53). |
| 2026-03-12 | ORCHESTRATOR | **Sprint 5 retro complete** — 9/9 tasks, 100%. 0 blockers, 0 new signals. 823 tests (+63). Canvas I/O nodes, data flow visualization, field group schema, AI field suggestion engine, block config chat tools all shipped. Sprint 6 tasks updated to include 2 block config UI tasks (FE-03 + FE-04). |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| (none yet — Sprint 7) | | | | | |

---

## Recently Completed — Sprint 6 Archive

Sprint 6 (2026-03-12): 8/8 DONE (100%).
Deliverables: Reference template storage (multipart upload to Supabase Storage, AI structure extraction via Claude, document_template block creation), document storage & versioning (documents table with auto-increment version trigger, Supabase Storage bucket, 4 API endpoints, storage service), context-aware document generation (assembleDocumentContext fetches connected blocks + events, buildDocGenSystemPrompt includes Connected Blocks/Recent Activity/Reference Structure/Brand Context), template library page (/library/templates with upload, search, category filters, responsive grid), document preview component (slide-over panel with inline editing, version history, PDF download, block detail integration), field group UI (grouped field list, group management, field-to-group assignment, grouped block detail rendering), AI-assisted block creation modal (describe-what-you-need textarea, suggest_fields API, field preview with accept/reject), QA tests (27 new: template card, version history, field group utilities). Test count: 885 (+27). Lint + build clean.

## Recently Completed — Sprint 5 Archive

Sprint 5 (2026-03-12): 9/9 DONE (100%).
Deliverables: Input/Output node types (InputNode indigo + OutputNode teal with specialized handles), reorganized node palette (4 categories: Triggers/Actions/Conditions/Flow with collapsible sections), step instructions panel (edit/preview toggle + simpleMarkdown renderer, 5000 char limit), canvas data flow serialization (DataInputSchema/DataOutputSchema Zod schemas, canvasToTemplate/stepsToCanvas round-trip for I/O nodes, data_inputs/data_outputs optional arrays), data flow visualization (DataFlowEdge custom edge — blue dashed for data, gray solid for control, hover tooltip for field mappings), field group schema extension (FieldGroup interface, getFieldGroups/groupFieldsByCategory utilities, x-field-group/x-field-groups schema extensions, default groups on 5 system types), AI field suggestion engine (Claude claude-sonnet-4-6, prompt versioned at field-suggestion.v1.md, field type validation, name sanitization, safe fallback), block configuration chat tools (4 new tools: suggest_fields, configure_block_type, create_block_type, create_relationship — all ops-admin RBAC), comprehensive QA (54 new tests: canvas I/O round-trip, field groups, template schema validation, RBAC enforcement). Test count: 823 (+63). Lint + build clean.

## Recently Completed — Sprint 4 Archive

Sprint 4 (2026-03-12): 8/8 DONE (100%).
Deliverables: Routing type system, policy resolution, routing decision engine (6-level priority), confidence scoring via Claude claude-sonnet-4-6, enriched workflow template schema, enhanced task card data model, routing config in workflow builder, enhanced task card UI, 22 new integration tests. Test count: 760 (+22).

## Recently Completed — Sprint 3 Archive

Sprint 3 (2026-03-12): 8/8 DONE (100%).
Deliverables: Custom RBAC engine (3 tables, 10 permissions, 3 system roles), withAuth refactor, Team Member CRUD, Org Hierarchy API, Roles API, Team + Roles settings pages, sidebar nav. 71 new tests. Test count: 706 (+77).

## Recently Completed — Sprint 2 Archive

Sprint 2 (2026-03-12): 7/7 DONE (100%).
Deliverables: 5 new system block types, contact enrichment, sub-org hierarchy, field-level validation, frontend type updates, dynamic block-create. 79 new tests. Test count: 629 (+79).

## Recently Completed — Sprint 1 Archive

Sprint 1 (2026-03-12): 6/6 DONE (100%).
Deliverables: Workflow 400 fix, chat widget position, dark mode toggle, responsive fixes. Test count: 550.

## Earlier Sprints

Phase 2 Sprints 1–16 complete. Phase 3 Sprint 0 complete. Full details in `shared-state-history.md`.
