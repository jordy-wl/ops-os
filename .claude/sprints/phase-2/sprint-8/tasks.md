# Sprint 8 Tasks — Google Integration + Action Menu + Library Pages

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations
**Sprint:** 8
**Sprint Goal:** Connect Google Workspace (OAuth, Gmail, Calendar, Drive). Build action menu for block detail pages. Create Block Library and Integration Library pages.
**Target Duration:** ~2 weeks
**Carried Over:** P2-S7-UI-01 (deferred UX research — folded into Library page design)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S8-BE-01 | Google OAuth Flow | Backend | HIGH | — | OPEN |
| P2-S8-BE-02 | Gmail Send Action Handler | Backend | MED | BE-01 | OPEN |
| P2-S8-BE-03 | Gmail Receive Trigger | Backend | HIGH | BE-01 | OPEN |
| P2-S8-BE-04 | Calendar Booking Action | Backend | MED | BE-01 | OPEN |
| P2-S8-BE-05 | Google Drive Document Storage | Backend | MED | BE-01 | OPEN |
| P2-S8-FE-01 | Action Menu Component | Frontend | MED | — | OPEN |
| P2-S8-FE-02 | Google Connect UI | Frontend | LOW | BE-01 | OPEN |
| P2-S8-FE-03 | Wire Actions to Canvas Nodes | Frontend | MED | S7 canvas, BE-02, BE-04 | OPEN |
| P2-S8-FE-04 | Integration Library Page | Frontend | MED | — | OPEN |
| P2-S8-FE-05 | Block Library Page | Frontend | MED | — | OPEN |
| P2-S8-QA-01 | Action + Integration Tests | QA | MED | BE-02, BE-04 | OPEN |

**Total:** 11 tasks (5 BE, 4 FE, 1 QA, 1 deferred from S7)
**Critical path:** BE-01 (OAuth) → BE-02 + BE-04 (action handlers) → FE-03 (canvas wiring) + QA-01

---

## Task Details

### P2-S8-BE-01 — Google OAuth Flow (HIGH)

**What:** OAuth 2.0 flow for Google Workspace with `googleapis` npm package.

**Files:**
- `src/app/api/auth/google/route.ts` — initiate OAuth, redirect to Google consent
- `src/app/api/auth/google/callback/route.ts` — exchange code for tokens, store refresh token
- `src/lib/integrations/google-client.ts` — shared Google API client with token refresh

**Details:**
- Scopes: `gmail.send`, `gmail.readonly`, `calendar.events`, `drive.file`
- Store refresh token in `integration_connectors` config (create a Google connector)
- `getGoogleClient(connectorId)` helper handles transparent token refresh
- Env vars required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

**Gates:** G1, G2, G3, G5

---

### P2-S8-BE-02 — Gmail Send Action Handler (MED)

**What:** Register `email.send` action handler in the action registry.

**Files:**
- `src/lib/actions/handlers/email-send.ts`
- Update `src/lib/actions/registry.ts` — register handler

**Details:**
- Zod schema: `{ to: string, subject: string, body: string, attachments?: string[] }`
- Uses Gmail API via `getGoogleClient()`
- Add `send_email` step type handler in `step-engine.ts`

**Gates:** G1, G2, G3, G5

---

### P2-S8-BE-03 — Gmail Receive Trigger (HIGH)

**What:** Receive inbound emails via Gmail push notifications or polling.

**Files:**
- `src/app/api/webhooks/gmail/route.ts` — Gmail push notification handler (Pub/Sub)
- Alternative: add to cron job to poll Gmail inbox periodically

**Details:**
- Creates inbound events (`email.received`) that can trigger workflows
- Maps Gmail message to event payload (from, subject, snippet, attachment count)
- Consider polling first (simpler) with Pub/Sub as follow-up

**Gates:** G1, G2, G3, G5

---

### P2-S8-BE-04 — Calendar Booking Action (MED)

**What:** Register `meeting.book` action handler.

**Files:**
- `src/lib/actions/handlers/meeting-book.ts`
- Update `src/lib/actions/registry.ts`

**Details:**
- Zod schema: `{ title: string, start: string (ISO), end: string (ISO), attendees?: string[], description?: string }`
- Creates Google Calendar event + Meet link
- Add `book_meeting` step type handler in `step-engine.ts`

**Gates:** G1, G2, G3, G5

---

### P2-S8-BE-05 — Google Drive Document Storage (MED)

**What:** Upload/create/list files via Drive API.

**Files:**
- `src/lib/integrations/google-drive.ts`

**Details:**
- `uploadFile(connectorId, name, mimeType, content)` — upload buffer
- `createDoc(connectorId, name, content)` — create Google Doc
- `listFiles(connectorId, folderId?)` — list files in folder
- Used by Sprint 9 document generation for PDF storage

**Gates:** G1, G2, G3, G5

---

### P2-S8-FE-01 — Action Menu Component (MED)

**What:** Dropdown action menu on block detail pages.

**Files:**
- `src/components/actions/action-menu.tsx`
- Modify `src/app/(app)/blocks/[id]/page.tsx` or block detail client to include menu

**Details:**
- Dropdown with icons: Send Email, Book Meeting, Generate Document, Run Workflow, Custom Action
- Each action opens a modal with a form (pre-filled from block data where possible)
- Actions dispatch through `POST /api/actions/:type` route
- Available actions filtered by block type + connected integrations

**Gates:** G1, G4, G5

---

### P2-S8-FE-02 — Google Connect UI (LOW)

**What:** OAuth initiation button on integrations page.

**Files:**
- `src/components/integrations/google-connect.tsx`
- Add to integrations page

**Details:**
- "Connect Google" button that redirects to OAuth flow
- Status display: connected/disconnected
- Show connected account email

**Gates:** G1, G4, G5

---

### P2-S8-FE-03 — Wire Actions to Canvas Nodes (MED)

**What:** New canvas node types: Send Email, Book Meeting.

**Files:**
- Modify `src/components/canvas/panels/node-config-panel.tsx`
- Modify `src/components/canvas/workflow-canvas.tsx`

**Details:**
- Config panels for `send_email` and `book_meeting` step types
- Reference connected Google account in config
- Template variable insertion for email body/meeting description

**Gates:** G1, G4, G5

---

### P2-S8-FE-04 — Integration Library Page (MED)

**What:** Capability-focused integration catalog.

**Files:**
- `src/app/(app)/library/integrations/page.tsx`
- `src/components/library/integration-catalog.tsx`

**Details:**
- Cards grouped by capability (Email, Calendar, Documents, Webhooks)
- Each capability shows: connected status, available actions, connector count
- Not just raw connector list — focuses on what users can do

**Gates:** G1, G4, G5

---

### P2-S8-FE-05 — Block Library Page (MED)

**What:** Enhanced block browser with type filters, search, grid/list toggle.

**Files:**
- `src/app/(app)/library/blocks/page.tsx`
- `src/components/library/block-browser.tsx`

**Details:**
- Type filters from `block_type_definitions`
- Search by name
- Grid/list view toggle
- Block type icons and colors from definitions
- Replaces basic `/blocks` list as the Library entry point

**Gates:** G1, G4, G5

---

### P2-S8-QA-01 — Action + Integration Tests (MED)

**What:** Tests for email-send, meeting-book handlers (mocked Google API). Gmail webhook test.

**Files:**
- `src/lib/actions/handlers/__tests__/email-send.test.ts`
- `src/lib/actions/handlers/__tests__/meeting-book.test.ts`
- `tests/api/google-oauth.test.ts`

**Details:**
- Mock `googleapis` to avoid real API calls
- Test action handler schema validation, success, and error cases
- Test OAuth flow redirect and callback

**Gates:** G1, G2, G5

---

## Dependencies

```
BE-01 (Google OAuth)
  ├── BE-02 (Gmail Send)
  ├── BE-03 (Gmail Receive)
  ├── BE-04 (Calendar)
  ├── BE-05 (Drive)
  ├── FE-02 (Connect UI)
  └── FE-03 (Canvas wiring) ← also needs BE-02, BE-04

FE-01 (Action Menu)     — independent
FE-04 (Integration Library) — independent
FE-05 (Block Library)   — independent

QA-01 — after BE-02, BE-04
```

## Environment Setup Required

Before BE-01 can start:
1. Create Google Cloud Console project
2. Enable Gmail API, Calendar API, Drive API
3. Create OAuth 2.0 credentials (web application)
4. Set authorized redirect URI: `{APP_URL}/api/auth/google/callback`
5. Add env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
