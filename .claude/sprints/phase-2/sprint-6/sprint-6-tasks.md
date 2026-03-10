# Sprint 6 -- Task Overview

> Phase 2, Sprint 6: Integration Connectors & Inbound Webhooks
> Sprint Goal: Build the integration connector framework (table + CRUD API), inbound webhook processing with workflow trigger evaluation, webhook trigger type in the step execution engine, outbound API call step type, and a connectors management UI. This sprint makes workflows triggerable by external systems and gives them the ability to call external APIs.

---

## Priority 0: Merge Bug Fix PR (Manual Action)

**PR #20 (fix/pii-and-atomicity) must be merged to main before Sprint 6 code work begins.** This PR fixes 4 bugs found during gap analysis: edge_type column naming, missing actor_id, PII in embeddings, block+event atomicity. All Sprint 6 work builds on corrected foundations.

---

## Task Summary

| Task ID | Title | Role | Complexity | Est | Blocked By | Gates |
|---------|-------|------|-----------|-----|-----------|-------|
| P2-S6-BE-01 | Integration Connectors Table + CRUD API | Backend | HIGH | 2d | PR #20 merge | 1, 2, 3, 5, 6 |
| P2-S6-BE-02 | Inbound Webhook Processing | Backend | HIGH | 2.5d | BE-01 | 1, 2, 3, 5, 6 |
| P2-S6-BE-03 | Webhook Trigger Evaluation | Backend | MEDIUM | 1.5d | BE-02 | 1, 2, 3, 5 |
| P2-S6-BE-04 | Outbound API Call Step Type | Backend | MEDIUM | 1.5d | BE-01 | 1, 2, 3, 5 |
| P2-S6-FE-01 | Integration Connectors Management UI | Frontend | MEDIUM | 2d | BE-01 | 1, 4, 5 |
| P2-S6-FE-02 | Workflow Jobs Dashboard | Frontend | MEDIUM | 1.5d | none | 1, 4, 5 |
| P2-S6-QA-01 | Integration + Webhook Contract Tests | QA | MEDIUM | 1.5d | BE-02, BE-03, BE-04 | 1, 2, 5 |

**Total estimated effort:** 12.5 days across 3 roles
**Critical path:** PR #20 merge -> BE-01 -> BE-02 -> BE-03 + QA-01
**Parallel track:** FE-02 (no backend dependency) can start immediately

---

## P2-S6-BE-01: Integration Connectors Table + CRUD API

**Description:** Create the `integration_connectors` table via Supabase migration and build the CRUD API. This is the foundation for all external system integrations. Each connector represents a connection to an external system (inbound webhook, outbound API, or bidirectional). The table stores connection config (never secrets -- those use env var references), status, and last sync timestamp.

**Acceptance Criteria:**
- [ ] Supabase migration creates `integration_connectors` table per PRD-04 schema (id, org_id, name, provider, direction, config, credentials_ref, status, last_sync_at, created_by, created_at, updated_at)
- [ ] RLS policies enforce org isolation (org_id from JWT, not request body)
- [ ] `GET /api/integrations` lists connectors for the org with optional filters (provider, status, direction)
- [ ] `POST /api/integrations` creates a connector. For inbound webhook type, generates and returns a unique webhook URL
- [ ] `PATCH /api/integrations/[id]` updates connector config and status
- [ ] `DELETE /api/integrations/[id]` soft-deletes (sets status to `archived`)
- [ ] `integration.connector.created` event emitted on create
- [ ] Webhook URL format: `POST /api/webhooks/integration/[connector_id]`
- [ ] Unit tests for CRUD operations + org isolation
- [ ] No secrets stored in config JSONB -- validated at API layer

**Applicable Gates:** 1, 2, 3, 5, 6
**Dependencies:** PR #20 merged
**Complexity:** HIGH
**Estimate:** 2 days
**Assigned Role:** BACKEND

---

## P2-S6-BE-02: Inbound Webhook Processing

**Description:** Build the inbound webhook endpoint that receives HTTP payloads from external systems via integration connectors. When a webhook is received: validate the connector exists and is active, parse the payload, record an `integration.webhook.received` event, and pass the event to the trigger evaluation system to check if any workflow templates should be auto-spawned.

**Key design:**
- Endpoint: `POST /api/webhooks/integration/[connector_id]`
- No Clerk auth on this endpoint (external systems cannot authenticate via Clerk). Instead, validate via: (a) connector_id exists and is active, (b) optional HMAC signature verification if configured in connector config
- Rate limit: 30 req/min per connector_id to prevent abuse
- Payload stored in event.payload with connector metadata (connector_id, provider, received_at)
- PII warning: webhook payloads from external systems may contain PII. Strip known PII fields before storing in events. Log a sanitized version only.

**Acceptance Criteria:**
- [ ] `POST /api/webhooks/integration/[connector_id]` accepts external payloads
- [ ] Validates connector exists, is active, and belongs to the correct org
- [ ] Optional HMAC signature verification (SHA-256) when connector config includes `hmac_secret_ref`
- [ ] Records `integration.webhook.received` event with sanitized payload
- [ ] Passes event to trigger evaluation for webhook-type triggers
- [ ] Returns `{ received: true, event_id, workflows_triggered }` per PRD-05 contract
- [ ] Returns 404 for unknown connector_id, 403 for inactive connector
- [ ] Returns 400 for invalid HMAC signature when HMAC is configured
- [ ] Unit tests for happy path, inactive connector, invalid HMAC, PII sanitization
- [ ] No PII in log statements from webhook payloads

**Applicable Gates:** 1, 2, 3, 5, 6
**Dependencies:** P2-S6-BE-01
**Complexity:** HIGH
**Estimate:** 2.5 days
**Assigned Role:** BACKEND

---

## P2-S6-BE-03: Webhook Trigger Evaluation

**Description:** Extend the trigger evaluation system (built in Sprint 5 P2-S5-BE-03) to support `webhook` trigger type. When an `integration.webhook.received` event is created, check all workflow templates for webhook-type triggers that match the connector_id and optional event_type_mapping from the connector config. Auto-spawn workflow instances for matches.

**Key design:**
- Reuse the `evaluateEventTriggers()` function from Sprint 5 BE-03 as a pattern
- New function: `evaluateWebhookTriggers(connectorId, eventPayload, orgId)`
- Template trigger config for webhook type: `{ type: "webhook", config: { connector_id: "uuid", event_type_mapping: { "crm.lead.created": "block.created" } } }`
- When a webhook arrives, find templates whose trigger.config.connector_id matches
- Apply event_type_mapping to translate external event types to internal types
- Spawn workflow instance with the mapped block_id (from payload or connector config)
- Anti-loop: webhook-triggered workflows cannot re-trigger via the same webhook

**Acceptance Criteria:**
- [ ] `evaluateWebhookTriggers()` finds matching templates by connector_id
- [ ] Event type mapping translates external event types to internal types
- [ ] Workflow instances auto-spawned for matching webhook triggers
- [ ] Anti-loop protection: webhook-spawned workflows do not re-trigger
- [ ] No matches = no instances spawned (silent, logged at debug level)
- [ ] Unit tests for: match found, no match, anti-loop, multiple templates matching

**Applicable Gates:** 1, 2, 3, 5
**Dependencies:** P2-S6-BE-02
**Complexity:** MEDIUM
**Estimate:** 1.5 days
**Assigned Role:** BACKEND

---

## P2-S6-BE-04: Outbound API Call Step Type

**Description:** Add a `call_api` step type to the workflow step execution engine (built in Sprint 5 P2-S5-BE-02). When a workflow step has `type: "call_api"`, the engine makes an HTTP request to the URL configured in the step config, using credentials from the referenced integration connector. Records success/failure events.

**Key design:**
- Step config: `{ connector_id: "uuid", method: "POST", path: "/api/endpoint", body_template: "{{block.data}}", timeout_ms: 5000 }`
- Resolve connector from connector_id to get base_url and auth config
- Template variables ({{block.*}}, {{context.*}}) interpolated in body_template before sending
- On success: record `integration.api_call.completed` event, advance to next step
- On failure: record `integration.api_call.failed` event, retry up to step config max_retries (default 1)
- Timeout: configurable per step, default 5000ms, max 30000ms
- Never log response bodies that may contain PII -- log status code + headers only

**Acceptance Criteria:**
- [ ] `call_api` step handler registered in step execution engine
- [ ] Resolves connector for base URL and auth configuration
- [ ] Template variable interpolation in request body
- [ ] `integration.api_call.completed` event on success
- [ ] `integration.api_call.failed` event on failure with sanitized error
- [ ] Retry logic with configurable max_retries
- [ ] Timeout enforcement (default 5s, max 30s)
- [ ] No PII in logs from response bodies
- [ ] Unit tests for success, failure, retry, timeout, template interpolation

**Applicable Gates:** 1, 2, 3, 5
**Dependencies:** P2-S6-BE-01
**Complexity:** MEDIUM
**Estimate:** 1.5 days
**Assigned Role:** BACKEND

---

## P2-S6-FE-01: Integration Connectors Management UI

**Description:** Create a page at `/integrations` that lists integration connectors for the org and allows creating, editing, and archiving connectors. Shows connector status, last sync time, and the webhook URL for inbound connectors.

**UI Components:**
- Integrations page at `/integrations` (add to sidebar nav)
- Connector list: cards or table showing name, provider, direction, status, last_sync_at
- Create Connector dialog: form fields for name, provider (webhook/custom_api), direction (inbound/outbound/bidirectional), config JSONB editor (simplified key-value pairs for prototype)
- Connector detail: shows webhook URL (copyable) for inbound connectors, config, event history
- Status badge: active (green), paused (yellow), error (red), pending_auth (orange)
- Archive action with confirmation dialog
- Empty state when no connectors exist

**Acceptance Criteria:**
- [ ] `/integrations` page lists connectors for the org
- [ ] Create connector dialog with provider selection and config
- [ ] Webhook URL displayed and copyable for inbound connectors
- [ ] Status badge with correct colors
- [ ] Archive connector with confirmation
- [ ] Empty state with CTA to create first connector
- [ ] Responsive at 375px and 1280px
- [ ] Loading/error states

**Applicable Gates:** 1, 4, 5
**Dependencies:** P2-S6-BE-01
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** FRONTEND

---

## P2-S6-FE-02: Workflow Jobs Dashboard

**Description:** Add a workflow instances (jobs) view to the `/workflows` page. Sprint 5 FE-01 built the Templates tab; this task adds a Jobs/Instances tab that shows running and completed workflow instances with their current step, status, and progress. This was listed in the Sprint 5 FE-01 task as a "tabbed Templates/Jobs shell" but only the Templates tab was built. Sprint 6 completes the Jobs tab.

**UI Components:**
- Jobs tab on existing `/workflows` page (alongside existing Templates tab)
- Instance list: table showing template name, source block name (linked), status (pending/running/done/failed), current step, started_at, completed_at
- Status filters: all, running, done, failed
- Instance detail: expandable row or detail panel showing step_results timeline
- Link to source block from each instance row
- Empty state when no instances exist
- Auto-refresh: poll for updates every 10 seconds when instances are running

**Acceptance Criteria:**
- [ ] Jobs tab added to `/workflows` page
- [ ] Instance list with template name, source block link, status, current step
- [ ] Status filter controls (all/running/done/failed)
- [ ] Instance detail shows step results timeline
- [ ] Empty state with CTA
- [ ] Auto-refresh when running instances exist
- [ ] Responsive at 375px and 1280px
- [ ] Loading/error states

**Applicable Gates:** 1, 4, 5
**Dependencies:** none (reads from existing workflow-instances API)
**Complexity:** MEDIUM
**Estimate:** 1.5 days
**Assigned Role:** FRONTEND

---

## P2-S6-QA-01: Integration + Webhook Contract Tests

**Description:** Contract tests for the integration connector framework and webhook processing. Tests the full lifecycle: create connector -> receive webhook -> trigger evaluation -> workflow instance spawned. Also tests the outbound call_api step type.

**Test cases (minimum):**

### Contract Tests (real Supabase, skip guard)
- [ ] Create inbound webhook connector -> verify connector created with correct fields + webhook URL returned
- [ ] List connectors with provider/status/direction filters
- [ ] Receive webhook on valid connector -> verify `integration.webhook.received` event created
- [ ] Receive webhook on inactive connector -> verify 404/403 response
- [ ] Receive webhook with invalid HMAC -> verify 400 response
- [ ] Webhook triggers workflow instance when template has matching webhook trigger
- [ ] Webhook does not trigger when no matching template exists
- [ ] call_api step type makes outbound request and records success/failure events
- [ ] Org isolation: org A cannot see or use org B's connectors
- [ ] Full lifecycle: create connector -> create template with webhook trigger -> receive webhook -> verify instance spawned

### Unit Tests
- [ ] HMAC signature verification logic
- [ ] Event type mapping (external -> internal)
- [ ] Template variable interpolation in call_api body
- [ ] PII sanitization in webhook payloads

**Files likely created:**
- `tests/api/integrations.test.ts`
- `tests/api/webhooks.test.ts`

**Applicable Gates:** 1, 2, 5
**Dependencies:** P2-S6-BE-02, P2-S6-BE-03, P2-S6-BE-04
**Complexity:** MEDIUM
**Estimate:** 1.5 days
**Assigned Role:** QA
