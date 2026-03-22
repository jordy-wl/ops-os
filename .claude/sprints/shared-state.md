# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 7 — Design Partner Readiness — **ACTIVE**
**Phase Status:** **IN PROGRESS** — 4 workstreams. WS4 (Google OAuth) DONE. WS3 (Timer Relocation) DONE. WS2 (Entity Dropdown Fields) DONE. WS1 (Client Portal System) DONE.
**Sprint:** 24 — Phase 7 Build — **IN PROGRESS**
**Next:** Testing, deploy, design partner outreach
**Previous:** Phase 6 complete (60/60, S18–S23, 1746 tests). Phase 5 (48/48). Phase 4 (42/42). Phase 3 (70/70). Phase 2 (86/88).

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P7-S24-WS4 | Google OAuth setup guide + granular consent | AI/BE | DONE | 2026-03-18 |
| P7-S24-WS3 | Timer widget relocation to My Work Time tab | FE | DONE | 2026-03-18 |
| P7-S24-WS2 | Entity dropdown fields (multi-relation, conversions, UX) | FE/BE | DONE | 2026-03-18 |
| P7-S24-WS1A | Portal foundation (migration, form_template, config API) | BE | DONE | 2026-03-18 |
| P7-S24-WS1B | Portal UI (layout, dashboard, documents, requests, forms) | FE | DONE | 2026-03-18 |
| P7-S24-WS1C | Portal public API + admin config panel | BE/FE | DONE | 2026-03-18 |

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
| 2026-03-18 | ORCHESTRATOR | **PHASE 7 BUILD — Design Partner Readiness.** 4 workstreams shipped: **WS4** Google OAuth setup guide (docs/google-oauth-setup.md) + granular consent handling (Jan 2026 policy), gmail.readonly deferred (restricted tier). **WS3** Timer widget relocated from floating global → My Work Time tab only, provider restructured as layout wrapper. **WS2** Multi-relation field type added, 7 system type fields converted to relation/multi-relation, RelationField rewritten with searchable dropdown. **WS1** Client Portal System: portal_configurations table + form_template block type + portal validation lib + admin CRUD API + 7 public API endpoints (blocks/docs/events/requests/forms) + 5 portal UI pages (layout+shell, dashboard, documents hub, requests, form filling with 12 question types + branching) + admin config panel on client block detail page. Middleware updated for /portal public routes. New files: ~25. Modified: ~15. Supabase migration applied. Build clean. |
| 2026-03-18 | ORCHESTRATOR | **SPRINT 23 COMPLETE — Per-Node Improvements (15/15).** 8-wave execution: Route node (component + config + handler + engine branching), For Each node (component + config + placeholder handler), condition handler rewrite (370 lines, 8 operators, AND/OR, 56 new tests), node label renames (user-friendly names, consolidated palette from 30→27 items), trigger configs (4 types: manual/event/webhook/schedule with scoping + condition builder), Wait/Delay DurationPicker, workflow completion config (restart/chain), External Action consolidation with ConnectorTemplates (Xero/HubSpot/Generic), AI template picker wired to 4 AI nodes, data operations abstraction (entity-driven dropdowns), human interaction improvements (multi-channel notifications, share link permissions, task attachments), sub-workflow preview dropdown, External Action test/preview panel, VariablePickerInput wired across 9 inputs in 3 config files, context-aware auto-fill (5 autoSuggestion hints). New files: 5 (route-node, for-each-node, route-config, for-each-config, connector-templates, workflow-settings-panel, route handler, for-each handler). Modified: ~25 files. Step engine now supports N-way branching via next_step_name. Handler registry: 22. Test count: 1746 (+57). Build clean. |
| 2026-03-18 | ORCHESTRATOR | **SPRINT 22 COMPLETE — Workflow Builder UX Foundation (8/8).** Decomposed 1,697-line `node-config-panel.tsx` monolith into 8 per-node config components (`panels/configs/`) + 7 shared components (`panels/shared/`): form primitives, routing section, duration picker, condition builder, variable picker, schedule config, AI template picker. Created 14 built-in AI prompt templates (`lib/workflow/ai-prompt-templates.ts`). Added `panels/types.ts` with shared NodeConfigProps, getNodeData, makeConfigUpdater helpers. Zero new TypeScript errors. Main dispatcher now ~90 lines. Sprint 23 (15 tasks) planned for per-node improvements. |
| 2026-03-18 | AI-ML-ENGINEER | **AI LAYER DEEP-DIVE — 6 improvements shipped.** (1) User context enrichment: `assembleContext` now queries user role, assigned tasks, recent activity — chat knows who it's talking to. (2) Delta context injection: `loadDeltaContext()` wired into chat route for workflow_instance blocks — chat references health score and overdue steps. (3) Discuss mode action chips: v2 prompt extracts `<SUGGESTIONS>` tags → SSE events → clickable pill buttons below messages. (4) Plan mode accept/reject: v2 prompt outputs `<PLAN_JSON>` → interactive checkboxes, Accept/Reject/Add More buttons → auto-execute on accept. (5) Block-level embeddings: `embedBlock()` added (fire-and-forget on create/update via chat-tools), semantic search now returns blocks + events. (6) AI suggestions panel: new `/api/blocks/:id/suggestions` route + `BlockSuggestionsPanel` component on all non-workflow block detail pages. 3 new prompts registered in VERSIONS.md. 1689 tests passing, 0 failures. |
| 2026-03-17 | ORCHESTRATOR | **PHASE 6 CODE COMPLETE** — 37/37 tasks, 1689 tests, 4 sprints (S18–S21). Deliverables: Time tracking (floating timer, timestamp-based elapsed, timebox mode, manual entry, weekly bar chart, billable vs non-billable), Calendar integration (Google Calendar sync pull-based 30-day window, week/month CSS grid views, event CRUD, deadline markers, "Connect Google Calendar" CTA), Performance metrics (weekly cron snapshots, dashboard API with trend data, team utilization API, recharts trend charts, stat cards, "Collecting Data" empty state, AI time estimation), responsive polish (7-tab My Work horizontal scroll, 5-tab Org page scroll, metric card grid optimization), integration health dashboard in Settings, 3 infrastructure research reports (event-bus-kafka-vs-postgres, graph-db-neo4j-vs-adjacency, multi-db-architecture-design). New DB objects: time_entries, calendar_events, performance_snapshots tables + task_deadlines_v view. New API routes: /api/time-entries, /api/time-entries/active, /api/calendar-events, /api/calendar-events/sync, /api/performance/snapshot, /api/performance/dashboard, /api/performance/team. |
| 2026-03-15 | ORCHESTRATOR | **PHASE 5 CODE COMPLETE** — 48/48 tasks, 1414 tests, 5 sprints (S13–S17). Deliverables: Org page 5-tab layout (Overview/Revenue/Strategy/Offerings/Team), revenue forecast API (deal pipeline + solution pricing + product/service pricing), SWOT Analysis + Value Proposition block types with AI generation, interactive SWOT editor + value prop editor, custom block type creation + deletion UI, step engine refactored to handler registry (20 handlers), 9 new step handlers (create_edge, search_blocks, send_notification, create_shared_link, ai_analysis, ai_classify, ai_summarize, ai_risk_assessment, store_file), node palette expanded to 6 categories with 25+ items, delta engine wired to chat Execute mode (calculate_delta tool), enhanced My Work Task Inbox (priority badges, deadline countdown, AI suggestion chips, confidence scores), Google OAuth null org fallback fix, integration health check endpoint + capabilities model, block browser dynamic type seeding. |
| 2026-03-13 | ORCHESTRATOR | **PHASE 4 CODE COMPLETE** — 42/42 tasks, 1230 tests, 4 sprints. 22 features across 7 groups: Workflow Builder UX, Client Portal, Document Gen V3, Custom Actions, Inter-Workflow, Chat Panel V2, Workflow Analytics. |
| 2026-03-12 | ORCHESTRATOR | **PHASE 3 CODE COMPLETE** — 70/70 tasks, 1230 tests, 8 sprints. Deliverables: custom RBAC, routing engine, AI delta engine, document gen V2, workflow canvas I/O nodes, block configurability, admin settings, org overview page, API key management, notification system, audit log. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|
| 2026-03-12 | supabase | apply_migration: create_api_keys_table | SUCCESS | P3-S8-BE-02 | BACKEND |
| 2026-03-13 | supabase | apply_migration: create_shared_links_and_form_submissions | SUCCESS | P4-S10-BE-01 | BACKEND |
| 2026-03-13 | supabase | apply_migration: create_signature_events | SUCCESS | P4-S10-BE-04 | BACKEND |
| 2026-03-13 | supabase | apply_migration: create_conversations_and_messages | SUCCESS | P4-S12-BE-01 | BACKEND |
| 2026-03-17 | supabase | apply_migration: create_time_entries | SUCCESS | P6-S18-BE-01 | BACKEND |
| 2026-03-17 | supabase | apply_migration: create_calendar_events | SUCCESS | P6-S19-BE-01 | BACKEND |
| 2026-03-17 | supabase | apply_migration: create_performance_snapshots | SUCCESS | P6-S20-BE-01 | BACKEND |
| 2026-03-18 | supabase | apply_migration: create_portal_configurations | SUCCESS | P7-S24-WS1A | BACKEND |

---

## Recently Completed — Sprint 23 Archive

Sprint 23 (2026-03-18): 15/15 DONE (100%).
Deliverables: Per-Node Improvements across 8 execution waves. **Wave 1** — Route node (`route-node.tsx`, `route-config.tsx`, `route.ts` handler; N-way branching with `next_step_name` engine support), For Each node (`for-each-node.tsx`, `for-each-config.tsx`, `for-each.ts` placeholder handler), Condition handler rewrite (~370 lines replacing always-true stub; 8 operators, AND/OR compound mode, advanced expression mode, 56 new tests). **Wave 2** — Node label renames (user-friendly names, "Log Event", "External Action", "Link Records", "Share Link"; consolidated palette from 30→27 items, removed redundant "Run Action"/"Webhook Send"/"Update CRM"/"Create Invoice"). **Wave 3** — Trigger configs upgraded (4 types: manual/event/webhook/schedule; event scoping with ConditionBuilder; webhook payload schema; ScheduleConfig with presets), Wait/Delay integrated with DurationPicker, Workflow completion config (none/restart_after_delay/trigger_workflow). **Wave 4** — External Action consolidation with `connector-templates.ts` (Xero/HubSpot/Generic providers, 3-step progressive disclosure), AI template picker wired into 4 AI node configs, Data operations abstraction (entity-driven dropdowns for record type/status/relationship), Human interaction improvements (multi-channel notifications, share link permissions/branding/password, task attachments), Sub-workflow preview dropdown with step list. **Wave 5** — External Action request preview panel + disabled Send Test button. **Wave 7** — VariablePickerInput wired across 9 inputs in 3 config files (action-config, task-config, trigger-config). **Wave 8** — Context-aware auto-fill (5 autoSuggestion hints: email→block.email, subject→block.name, meeting title→block.name, attendees→block.email, task title→block.name). Schema changes: added route/for_each step types, 10+ new optional fields. Handler registry: 22 (up from 20). Canvas layout: route/foreach node types registered. Step engine: N-way branching via `next_step_name` output. Test count: 1746 (+57 from condition handler tests). Build clean.

## Recently Completed — Sprint 22 Archive

Sprint 22 (2026-03-18): 8/8 DONE (100%).
Deliverables: Workflow Builder UX Foundation — architecture decomposition of the 1,697-line node-config-panel.tsx monolith. Created 8 per-node config components in `panels/configs/` (trigger-config.tsx, action-config.tsx at 723 lines, condition-config.tsx, wait-config.tsx, input-config.tsx, output-config.tsx, task-config.tsx, step-instructions-panel.tsx) + barrel index.ts. Created 7 shared components in `panels/shared/` (form-primitives.tsx with 7 primitives, routing-section.tsx, duration-picker.tsx with seconds↔amount+unit conversion, condition-builder.tsx with 3-mode progressive disclosure and 8 operators, variable-picker.tsx with VariablePickerButton/VariablePickerInput and cursor-position insertion, schedule-config.tsx with 6 presets and timezone selector, ai-template-picker.tsx with tag-style category inputs). Created `panels/types.ts` with NodeConfigProps interface and helper functions. Created `lib/workflow/ai-prompt-templates.ts` with 14 templates (3 analysis, 3 classify, 4 summarise, 4 risk assessment) + getTemplatesForNodeType helper. Main dispatcher reduced to ~90 lines. Zero new TypeScript errors. Test count: 1689 (unchanged — architecture refactor, no new tests). Build clean.

## Recently Completed — Sprint 21 Archive

Sprint 21 (2026-03-17): 9/9 DONE (100%).
Deliverables: 3 infrastructure research reports — Event Bus (Kafka vs Postgres, confidence 8/10: stay on Postgres 12-18 months, 3-tier migration plan with 5 explicit triggers), Graph Database (Neo4j vs Adjacency List, confidence 7/10: stay on Postgres adjacency list, add recursive CTEs + materialized paths, evaluate Apache AGE later), Multi-DB Architecture (Redis/replicas/event sourcing, confidence 8/10: 3-phase plan — Phase A Redis hot cache when p95 > 200ms, Phase B read replicas when connection pool > 70%, Phase C event sourcing when event bus Tier 2 operational). My Work 7-tab responsive polish (overflow-x-auto scrollbar-none horizontal scroll on mobile, whitespace-nowrap shrink-0). Org page 5-tab responsive polish (TabsList overflow scroll, metric cards grid-cols-2 on mobile). Integration health dashboard in Settings (summary cards healthy/degraded/unhealthy, per-connector health list with check button, capabilities badges). Full regression: 1689 tests passing, 0 failures, 116 test files. TypeScript + lint clean. Test count: 1689 (unchanged from S20 — polish + research sprint, no new tests). Build clean.

## Recently Completed — Sprint 20 Archive

Sprint 20 (2026-03-17): 10/10 DONE (100%).
Deliverables: performance_snapshots table migration (org_id, user_id, period_start/end, tasks_completed/on_time/overdue, total_time_seconds, billable_time_seconds, workflows_completed/failed, avg_task_completion_seconds; unique index on org_id+user_id+period_start), task_deadlines_v SQL view (extracts deadline metadata from task_queue_items), weekly snapshot cron API (GET /api/performance/snapshot — processes all orgs, idempotency guard, aggregates time_entries+tasks+workflows per user; Vercel cron "0 0 * * 0"), performance dashboard API (GET /api/performance/dashboard — user snapshots + team averages + current week live stats), team utilization API (GET /api/performance/team — per-member tasks/time/rates, team totals), PerformanceTab with 4 stat cards (Tasks Completed, On-Time Rate, Time Logged, Billable Rate), PerformanceCharts with recharts (BarChart for task completion, AreaChart for time logged + on-time rate, team average dashed lines), "Collecting Data" empty state (progress dots for Week 1/Week 2/Full Dashboard), enhanced TeamUtilization on Org Overview (fetches /api/performance/team, horizontal bar chart per member, summary stats), AI time estimation module (query similar completed tasks' time_entries, compute weighted avg by title similarity, confidence levels, "not enough data" fallback when < 5 entries), My Work now has 7 tabs (Tasks, Time, Calendar, Performance, Workflows, Blocks, Activity). Test count: 1689 (+81). Build clean.

## Recently Completed — Sprint 19 Archive

Sprint 19 (2026-03-17): 9/9 DONE (100%).
Deliverables: calendar_events table migration (org_id, user_id, title, start_at, end_at, all_day, source, external_id, block_id; unique index on org_id+external_id for Google dedup), calendar events CRUD API (GET with date range filtering + POST local events + PATCH), Google Calendar sync endpoint (POST /api/calendar-events/sync — pull-based 30-day window, singleEvents=true, up to 3 pages/7500 events, upsert by external_id), CalendarTab with week/month toggle + navigation + Today button, CalendarWeekView (7-column CSS grid, hour rows 7AM–10PM, timed event positioning by percentage, all-day events header row, 5 color themes), CalendarMonthView (7×N grid, day cells with event dots + titles, "+X more" overflow, today highlight circle), CalendarEventModal (create/edit form, title/description/start/end/all-day/color, 5 color swatches with ring selection), task deadline markers (fetches task_queue_items, converts deadlines to red all-day events), "Connect Google Calendar" empty state CTA (links to /api/auth/google, skip option), sync trigger button with spinning RefreshCw icon, My Work now has 6 tabs (Tasks, Time, Calendar, Workflows, Blocks, Activity). Test count: 1608 (+101). Build clean.

## Recently Completed — Sprint 18 Archive

Sprint 18 (2026-03-17): 9/9 DONE (100%).
Deliverables: time_entries table migration (org_id, user_id, block_id, started_at, ended_at, duration_seconds, is_billable), time entries CRUD API (GET with date/block filtering + POST with auto-duration computation + PATCH), active timer API (GET running timer + PATCH to stop with duration calculation), recharts installed, TimerWidgetProvider (Context + localStorage + server sync, timestamp-based elapsed — no drift), floating timer widget (z-[45] bottom-left, compact/expanded states, description + billable toggle), timebox mode (Off/15m/25m/45m/60m presets, visual progress bar, countdown, pulsing destructive text on completion), My Work "Time" tab (weekly bar chart, daily entries grouped, billable vs total breakdown), manual time entry form (date + start/end time + billable), My Work now has 5 tabs (Tasks, Time, Workflows, Blocks, Activity). Test count: 1507 (+93). Build clean.

## Recently Completed — Sprint 17 Archive

Sprint 17 (2026-03-15): 9/9 DONE (100%).
Deliverables: Enhanced My Work Task Inbox (priority sorting urgent→low, deadline sorting earliest→latest, PriorityBadge component with 4 levels + icons + colors, DeadlineCountdown component with overdue/urgent/warning/normal states, ConfidenceScore component with percentage color coding, AI suggestion chips with Sparkles icon), delta engine wired to chat Execute mode (calculate_delta tool in CHAT_TOOLS, dispatched via executeChatTool, fetches workflow instance + template + events, maps to DeltaInstanceMeta/DeltaStepResult types, read-only access for all roles), Google OAuth null org fix (clerkOrgId null → fallback to user's primary org via clerk.users.getOrganizationMembershipList), integration capabilities model (capabilities JSONB + health_status + last_health_check columns on integration_connectors, migration 20260315000001), integration health check endpoint (GET /api/integrations/[id]/health — webhook/custom_api URL reachability, Google token presence, default capabilities by provider, DB health_status update), block browser type seeding (seeds typeMap from all block_type_definitions first, then counts from actual blocks — ensures all 17+ types appear in filter even with 0 blocks). Test count: 1414 (+70). Build clean.

## Recently Completed — Sprint 16 Archive

Sprint 16 (2026-03-16): 10/10 DONE (100%).
Deliverables: 4 AI step handlers (ai_analysis, ai_classify, ai_summarize, ai_risk_assessment) + store_file handler, StepSchema extended with 5 new types + AI/file config fields, node palette "AI & Analysis" + "External" categories, config panels for all AI/external nodes. Handler registry now at 20. Test count: 1344 (+30). Build clean.

## Recently Completed — Sprint 15 Archive

Sprint 15 (2026-03-16): 10/10 DONE (100%).
Deliverables: Step engine refactored to handler registry (15 lazy-loaded handlers), 4 new handlers (create_edge, search_blocks, send_notification, create_shared_link), StepSchema extended, node palette "Data Operations" + "Human Interaction" categories, config panels. Test count: 1314 (+28). Build clean.

## Recently Completed — Sprint 14 Archive

Sprint 14 (2026-03-15): 11/11 DONE (100%).
Deliverables: SWOT + Value Proposition block types, Strategy tab, interactive editors, dynamic block type browser, create/delete block type UI, AI SWOT + value prop generation. Test count: 1286. Build clean.

## Recently Completed — Sprint 13 Archive

Sprint 13 (2026-03-15): 10/10 DONE (100%).
Deliverables: Org page 5-tab layout, Revenue forecast API, Solution/Product/Service type enrichment, Overview/Team/Offerings tabs wired. Test count: 1254. Build clean.

## Recently Completed — Sprints 8-12 Archive

Sprint 12 (10/10), Sprint 11 (10/10), Sprint 10 (10/10), Sprint 9 (12/12), Sprint 8 (9/9). Full details in `shared-state-history.md`.

## Earlier Sprints

Phase 2 Sprints 1–16 complete. Phase 3 Sprints 1-7 complete. Full details in `shared-state-history.md`.
