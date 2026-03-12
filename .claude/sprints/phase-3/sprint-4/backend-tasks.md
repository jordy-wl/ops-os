# Sprint 4 — Backend Tasks

## P3-S4-BE-01 — Policy Block Schema & Routing Config

**Complexity:** MEDIUM
**Priority:** 1 (start immediately -- on critical path)
**Dependencies:** None (Sprint 3 complete is a sprint-level prerequisite)
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 2 days

### Description

Define the Policy block type's field schema with routing configuration fields. Policies determine how workflow steps are routed -- to humans, AI agents, or hybrid queues -- based on confidence thresholds and risk levels.

### What to Build

1. **Policy block type field_schema:**
   - `routing_mode` -- enum: `human_only`, `ai_only`, `hybrid`, `escalation_chain`
   - `confidence_threshold` -- number (0.0 to 1.0): minimum AI confidence score to auto-approve
   - `risk_levels` -- array of objects: `{ name: string, min_confidence: number, routing_mode: string }`
   - `risk_routing_map` -- object mapping risk level names to routing decisions:
     ```json
     {
       "low": { "mode": "ai_only", "threshold": 0.8 },
       "medium": { "mode": "hybrid", "threshold": 0.9 },
       "high": { "mode": "human_only", "threshold": 1.0 }
     }
     ```
   - `approval_chain` -- array of objects: `{ role: string, order: number, required: boolean }`
   - `fallback_routing` -- enum: `human_only` (default when no policy matches)
   - `max_ai_attempts` -- number (default 3): how many times AI can retry before escalating

2. **Add to block_type_definitions:**
   - Migration to insert/update the Policy type with the routing-aware field_schema
   - Must be idempotent (ON CONFLICT UPDATE if Policy type already exists from Sprint 2)

3. **Policy resolution utility:**
   - `resolvePolicy(orgId, workflowTemplateId?, stepId?)` -- finds the most specific applicable policy
   - Priority: step-level policy > workflow-level policy > org default policy

### Files to Create/Modify

- `src/lib/blocks/system-types.ts` (update Policy field_schema)
- `src/lib/routing/policy.ts` (new: policy resolution)
- `supabase/migrations/[timestamp]_policy_routing_schema.sql`

### Acceptance Criteria

- [ ] Policy block type has all routing configuration fields
- [ ] Field schema validation accepts valid routing configs
- [ ] Field schema rejects invalid configs (confidence > 1.0, unknown routing modes)
- [ ] Policy resolution returns correct priority: step > workflow > org default
- [ ] Migration is idempotent
- [ ] Unit tests for schema validation and policy resolution

---

## P3-S4-BE-02 — Routing Decision Engine

**Complexity:** HIGH
**Priority:** 2 (after BE-01)
**Dependencies:** P3-S4-BE-01
**Applicable Gates:** G1, G2, G3, G5, G6
**Assigned Role:** Backend Engineer
**Estimate:** 3 days

### Description

Build the core routing decision engine at `src/lib/routing/engine.ts`. Given a step configuration, applicable policy, and AI confidence score, the engine produces a routing decision that determines whether a task goes to a human, AI agent, or requires approval.

### What to Build

1. **`makeRoutingDecision(input: RoutingInput): RoutingDecision`**

   Input:
   ```typescript
   interface RoutingInput {
     stepConfig: {
       routing_mode?: string       // step-level override
       required_permissions?: string[]
       instructions?: string       // SOP for this step
     }
     policy: Policy                // resolved from resolvePolicy()
     confidenceScore?: number      // 0.0-1.0, from AI evaluation
     riskLevel?: string           // low/medium/high
     context: {
       orgId: string
       workflowInstanceId: string
       stepIndex: number
     }
   }
   ```

   Output:
   ```typescript
   interface RoutingDecision {
     route: 'human' | 'agent' | 'approval_chain'
     reason: string               // human-readable explanation
     confidence: number           // the score that drove the decision
     policyId: string             // which policy was applied
     requiredPermissions: string[] // who can handle this
     escalationPath?: string[]    // if approval_chain, ordered approver roles
   }
   ```

2. **Decision logic:**
   - Step-level `routing_mode` override takes absolute priority
   - If no step override: use policy's `risk_routing_map` based on `riskLevel`
   - If confidence score >= policy's `confidence_threshold`: route to agent
   - If confidence score < threshold: route to human
   - If routing_mode is `escalation_chain`: build approval chain from policy
   - If no policy found: fall back to `human_only`

3. **Logging:**
   - Every routing decision logged as an Event (type: `routing.decision`)
   - Include: input summary, decision, confidence, policy applied, reason

### Files to Create

- `src/lib/routing/engine.ts`
- `src/lib/routing/types.ts` (RoutingInput, RoutingDecision interfaces)

### Acceptance Criteria

- [ ] Step-level routing_mode override takes priority over policy
- [ ] Policy risk_routing_map correctly maps risk levels to routing modes
- [ ] Confidence threshold comparison works correctly (>= routes to agent, < routes to human)
- [ ] Escalation chain builds correct approval order from policy
- [ ] Fallback to human_only when no policy exists
- [ ] Every decision creates an Event log entry
- [ ] Unit tests cover all routing paths (at least 10 test cases)
- [ ] Integration test: full routing flow from step config through policy resolution to decision

---

## P3-S4-BE-03 — Enrich Workflow Template Schema for Routing

**Complexity:** MEDIUM
**Priority:** 1 (independent, start immediately)
**Dependencies:** None (Sprint 3 complete is a sprint-level prerequisite)
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 1.5 days

### Description

Add per-step routing configuration fields to the workflow template schema. Each step in a workflow template can specify its own routing mode, SOP instructions, and required permissions.

### What to Build

1. **New fields on each step in the template schema:**
   - `routing_mode` -- optional enum: `human_only`, `ai_only`, `hybrid`, `escalation_chain` (overrides org policy for this step)
   - `instructions` -- optional text: Standard Operating Procedure (SOP) for this step. Displayed to human workers and used as context for AI agents.
   - `required_permissions` -- optional array of Permission slugs: which permissions a user needs to handle this step (uses Sprint 3 RBAC permissions)

2. **Update template-schema.ts:**
   - Extend the Zod step schema with the 3 new optional fields
   - All fields are optional -- steps without routing config inherit from workflow or org policy
   - Validate that `required_permissions` values are valid Permission slugs

3. **Migration:**
   - No database migration needed (these are JSON fields within the template's step config)
   - Existing templates without these fields remain valid (all optional)

### Files to Modify

- `src/lib/workflow/template-schema.ts` (extend step schema)
- `src/lib/rbac/types.ts` (import Permission type for validation)

### Acceptance Criteria

- [ ] Step schema accepts `routing_mode`, `instructions`, `required_permissions`
- [ ] All three fields are optional (existing templates remain valid)
- [ ] `routing_mode` validates against allowed enum values
- [ ] `required_permissions` validates against Permission slugs from RBAC
- [ ] `instructions` accepts multiline text
- [ ] Unit tests for valid and invalid step routing configs
- [ ] Existing workflow creation and update flows unaffected

---

## P3-S4-BE-04 — Enhanced Task Card Data Model

**Complexity:** MEDIUM
**Priority:** 3 (after BE-02)
**Dependencies:** P3-S4-BE-02
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 2 days

### Description

Enrich the `task_queue_item` data model with fields for AI recommendations, confidence scoring, routing decisions, and structured input/output. This transforms task cards from simple work items into rich decision cards.

### What to Build

1. **New columns on task_queue_items table (migration):**
   - `ai_recommendation` -- jsonb: AI's suggested action/output for this task
   - `confidence_score` -- numeric(3,2): 0.00-1.00, AI confidence in its recommendation
   - `routing_decision` -- text: 'human' | 'agent' | 'approval_chain'
   - `routing_reason` -- text: human-readable explanation of why this routing was chosen
   - `input_data` -- jsonb: structured input context for the task (block data, previous step output)
   - `expected_output_schema` -- jsonb: JSON schema describing what the output should look like
   - `actual_output` -- jsonb: the actual output produced by the handler (human or AI)
   - `completed_by` -- text: Clerk user ID or 'agent' identifier
   - `decision` -- text: 'approved' | 'rejected' | 'modified' | null

2. **Update task queue API:**
   - `GET /api/tasks` returns enriched fields
   - `PATCH /api/tasks/[id]` accepts `decision` and `actual_output`
   - New query parameter: `?routing=human` or `?routing=agent` to filter by routing decision

3. **Task creation enrichment:**
   - When workflow engine creates a task_queue_item, populate:
     - `input_data` from previous step output + relevant block data
     - `routing_decision` and `routing_reason` from the routing engine
     - `expected_output_schema` from the step config

### Files to Create/Modify

- `supabase/migrations/[timestamp]_enhanced_task_cards.sql`
- `src/app/api/tasks/route.ts` (extend GET)
- `src/app/api/tasks/[id]/route.ts` (extend PATCH)
- `src/lib/workflow/task-enrichment.ts` (new: task creation enrichment logic)

### Acceptance Criteria

- [ ] Migration adds all new columns with correct types and defaults
- [ ] GET /api/tasks returns enriched fields when present
- [ ] PATCH /api/tasks/[id] accepts decision and actual_output
- [ ] Task filtering by routing_decision works
- [ ] Task creation populates input_data, routing_decision, routing_reason
- [ ] Existing task flows continue to work (all new fields nullable)
- [ ] Integration tests for enriched task CRUD
