# Sprint 7 — Backend Tasks

## P3-S7-BE-01 — Auto Task Generation from Deltas (MEDIUM)

**Priority:** 2 (depends on AI-01 for delta calculations)
**Deps:** P3-S7-AI-01
**Gates:** G1, G2, G3, G5

### What to Build
When a delta calculation exceeds configurable thresholds (e.g., health score below 50, step overdue by more than 24 hours), automatically create `task_queue_items` to address the issue. Route the generated task through the existing routing engine. Include the AI recommendation from the delta in the task description.

### Key Files
- Create: `src/lib/ai/delta-task-generator.ts` -- threshold evaluation + task_queue_item creation
- Create: `src/lib/ai/delta-thresholds.ts` -- configurable threshold definitions (health_score_min, overdue_hours_max, etc.)
- Modify: `src/lib/workflow/task-queue.ts` -- accept auto-generated tasks with source='delta_engine'
- Create: `src/lib/ai/__tests__/delta-task-generator.test.ts` -- threshold tests, task creation mocking

### Acceptance Criteria
- [ ] Threshold config: health_score < 50 triggers task, step overdue > 24h triggers task, skip detected triggers task
- [ ] Generated task includes: title derived from delta issue, description with AI recommendation, priority based on severity
- [ ] Task routed through routing engine (route_human or route_agent based on routing policy)
- [ ] De-duplication: do not create duplicate tasks for the same delta issue on the same block
- [ ] Thresholds configurable per-org (stored in org settings, fallback to defaults)

---

## P3-S7-BE-02 — Notification System Foundation (HIGH)

**Priority:** 2 (depends on AI-01 for delta triggers)
**Deps:** P3-S7-AI-01
**Gates:** G1, G2, G3, G5, G6

### What to Build
Foundation for the notification system. Create `notifications` table (user_id, org_id, type, title, body, block_id, read, created_at). API endpoints for listing notifications, marking as read, and marking all as read. Delta thresholds trigger notifications to relevant users (block assignee, workflow owner).

### Key Files
- Create: `supabase/migrations/YYYYMMDD_notifications.sql` -- notifications table with RLS policies
- Create: `src/app/api/notifications/route.ts` -- GET (list, paginated, unread first) and POST (mark all read)
- Create: `src/app/api/notifications/[id]/route.ts` -- PATCH (mark single as read)
- Create: `src/lib/notifications/create.ts` -- helper to create notifications with type, recipient resolution
- Create: `src/lib/notifications/types.ts` -- notification types enum (delta_alert, task_assigned, step_overdue, workflow_complete)
- Modify: `src/lib/ai/delta-task-generator.ts` -- emit notifications when delta threshold triggers

### Acceptance Criteria
- [ ] `notifications` table: id, user_id, org_id, type, title, body, block_id (nullable), read (default false), created_at
- [ ] RLS: users can only read/update their own notifications within their org
- [ ] GET /api/notifications returns paginated list, unread first, with cursor pagination
- [ ] PATCH /api/notifications/[id] marks single notification as read
- [ ] POST /api/notifications/mark-all-read marks all unread for the user as read
- [ ] Delta thresholds create notifications for block assignee and org admins
