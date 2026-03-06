# Sprint 5 — Backend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P2-S5-BE-01: Workflow Instance Spawning

**Complexity:** HIGH | **Est:** 2d | **Blocked By:** PR merge backlog
**Applicable Gates:** 1, 2, 3, 5

**Description:** When a workflow template is triggered, spawn a `workflow_instance` Block. The instance is a Block with type `workflow_instance` whose metadata tracks: template_id, current_step_index, status (pending/running/done/failed), step_results, and the source block_id that triggered it.

**Key design:**
- `workflow_instance` becomes a 7th system block type (add to seed)
- Instance metadata references the template Block ID
- Instance tracks execution state: which step we're on, results so far
- Creating an instance emits a `workflow.instance.spawned` event

**Schema for instance metadata:**
```json
{
  "template_id": "uuid-of-workflow-template-block",
  "source_block_id": "uuid-of-block-that-triggered-this",
  "applies_to_type": "client",
  "status": "pending",
  "current_step_index": 0,
  "step_results": [],
  "started_at": null,
  "completed_at": null
}
```

**API:**
- `POST /api/workflow-instances` — spawn instance from template_id + source_block_id
  - Validates template exists and is a workflow_template
  - Creates workflow_instance Block with initial metadata
  - Emits workflow.instance.spawned event
  - Returns created instance

- `GET /api/workflow-instances` — list instances for org
  - Optional filters: `?status=running`, `?template_id=X`, `?source_block_id=X`

- `GET /api/workflow-instances/[id]` — get instance with current state

**Acceptance Criteria:**
- [ ] workflow_instance Block created from template with correct metadata
- [ ] Instance references source block and template
- [ ] workflow.instance.spawned event emitted
- [ ] List endpoint with status/template/source filters
- [ ] Unit tests for spawn + list + get

---

## P2-S5-BE-02: Step Execution Engine

**Complexity:** HIGH | **Est:** 3d | **Blocked By:** P2-S5-BE-01
**Applicable Gates:** 1, 2, 3, 5

**Description:** Execute workflow steps sequentially from a workflow instance. Each step type (emit_event, run_action, wait, condition) has a handler. The engine advances the instance through steps, recording results and updating status.

**Step handlers:**
- `emit_event` — creates an Event on the source block
- `run_action` — calls an existing Action handler
- `wait` — creates a workflow_job with scheduled_at in the future
- `condition` — evaluates a simple expression; if false, skips to next step

**Execution flow:**
1. Pick up a workflow_instance with status=pending or status=running
2. Read the template's steps array
3. Execute the step at current_step_index
4. Record result in step_results
5. Advance current_step_index
6. If more steps: continue (or schedule next via workflow_job)
7. If done: set status=done, emit workflow.instance.completed event

**API:**
- `POST /api/workflow-instances/[id]/advance` — execute next step (internal/cron use)

**Acceptance Criteria:**
- [ ] emit_event step creates Event on source block
- [ ] run_action step delegates to Action handler
- [ ] wait step schedules a future workflow_job
- [ ] Step results recorded in instance metadata
- [ ] Instance advances through steps and completes
- [ ] workflow.instance.completed event emitted on finish
- [ ] Unit tests for each step type

---

## P2-S5-BE-03: Trigger Evaluation (Manual + Event)

**Complexity:** MEDIUM | **Est:** 1.5d | **Blocked By:** P2-S5-BE-01
**Applicable Gates:** 1, 2, 3, 5

**Description:** Evaluate workflow template triggers to determine when to spawn instances. Two trigger types:

1. **Manual** — user clicks "Run Workflow" on a block detail page → `POST /api/workflow-instances` with template_id + block_id
2. **Event** — when an event is created that matches a template's trigger event_pattern, auto-spawn an instance

**Event trigger flow:**
- After an event is inserted (in the events or blocks POST handler), check if any workflow_template has a trigger matching this event type for this block type
- If match found, spawn a workflow_instance automatically
- Prevent infinite loops: skip event triggers on events emitted by workflow instances

**API:**
- `POST /api/blocks/[id]/run-workflow` — manual trigger: select template, spawn instance
  - Body: `{ template_id: "uuid" }`

**Acceptance Criteria:**
- [ ] Manual trigger creates workflow instance from template
- [ ] Event trigger auto-spawns instance when event matches pattern
- [ ] No infinite loops from workflow-emitted events
- [ ] Unit tests for both trigger types

---

## P2-S5-BE-04: Task Queue API

**Complexity:** MEDIUM | **Est:** 1.5d | **Blocked By:** P2-S5-BE-01
**Applicable Gates:** 1, 2, 3, 5

**Description:** When a workflow step has type `route_human` or `route_agent`, create a task_queue_item Block. The task queue API allows users to list, claim, and complete tasks.

**task_queue_item metadata:**
```json
{
  "workflow_instance_id": "uuid",
  "step_name": "review_documents",
  "assigned_to": null,
  "claimed_at": null,
  "completed_at": null,
  "status": "open",
  "instructions": "Review uploaded documents for compliance"
}
```

**API:**
- `GET /api/tasks` — list open tasks for org (optionally filter by assigned_to)
- `POST /api/tasks/[id]/claim` — claim a task (set assigned_to = current user)
- `POST /api/tasks/[id]/complete` — complete task, advance workflow instance to next step

**Acceptance Criteria:**
- [ ] task_queue_item Block created by route_human step
- [ ] List, claim, complete endpoints
- [ ] Completing a task advances the workflow instance
- [ ] Unit tests for queue CRUD + claim + complete
