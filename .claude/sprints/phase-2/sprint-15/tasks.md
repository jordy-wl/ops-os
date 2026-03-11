# Sprint 15 Tasks — Integration Onboarding + AI Entity Creation

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations (UI/UX Overhaul)
**Sprint:** 15
**Sprint Goal:** Self-service integration connection wizard. AI creates blocks via chat. @mention block autocomplete in chat input.
**Target Duration:** ~2 weeks
**Depends On:** Sprint 14 (Chat Widget + AI Modes) COMPLETE

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S15-FE-01 | Integration onboarding wizard | Frontend | HIGH | — | OPEN |
| P2-S15-BE-01 | AI entity creation tools | Backend/AI | HIGH | — | OPEN |
| P2-S15-FE-02 | AI creation UX in chat widget | Frontend | MED | BE-01 | OPEN |
| P2-S15-FE-03 | @mention block autocomplete | Frontend | MED | — | OPEN |
| P2-S15-QA-01 | Integration and AI tests | QA | MED | FE-01, BE-01, FE-02 | OPEN |

**Total:** 5 tasks (1 BE/AI, 3 FE, 1 QA)
**Critical path:** BE-01 (AI entity creation) → FE-02 (AI creation UX) → QA-01

---

## Task Details

### P2-S15-FE-01 — Integration Onboarding Wizard (HIGH)

**What:** Create a multi-step wizard for connecting integrations: select provider → authorize (OAuth/API key) → configure scopes → test connection → success.

**Context:**
- Existing: `src/app/(app)/integrations/page.tsx` — integrations list page
- Existing: `src/app/api/integrations/route.ts` — integrations CRUD API
- Existing: `src/app/api/auth/google/route.ts` — Google OAuth flow

**Files to create:**
- `src/app/(app)/integrations/connect/page.tsx` — provider selection page
- `src/app/(app)/integrations/connect/[provider]/page.tsx` — provider-specific connection flow
- `src/components/integrations/onboarding-wizard.tsx` — multi-step wizard component
- `src/components/integrations/connection-test.tsx` — connection test feedback component

**Wizard steps:**
1. Select provider (Google, Webhook, Custom API — from existing connectors)
2. Auth: Google → OAuth redirect; Webhook → generate URL + HMAC secret; Custom API → enter endpoint + key
3. Configure: scopes/permissions selection
4. Test: attempt a test call, show success/failure
5. Complete: redirect to integration detail page

**Gates:** G1, G2, G4, G5, G6

---

### P2-S15-BE-01 — AI Entity Creation Tools (HIGH)

**What:** Extend chat tools so Claude can create blocks with custom fields. Add duplicate detection via embeddings search.

**Context:**
- Existing: `src/lib/ai/chat-tools.ts` — 4 tools (search, create, update, trigger)
- Existing: `src/lib/embeddings.ts` — embedding pipeline
- Existing: `src/app/api/embeddings/search/route.ts` — cosine similarity search
- Existing: `src/lib/block-types/field-types.ts` — 12 field types

**Files to modify:**
- `src/lib/ai/chat-tools.ts` — enhance `create_block` tool with field population, add `configure_block_type` tool

**Files to create:**
- `src/lib/ai/entity-creation.ts` — NL→block translation: parse user intent, map to block type + fields, validate against field_schema
- `src/lib/ai/research-tools.ts` — embeddings search for duplicate detection before creation
- `src/prompts/entity-creation.v1.md` — prompt for structured entity extraction from natural language

**Logic:**
- `create_block` enhanced: accepts field values, validates against block_type field_schema, rejects invalid fields
- Duplicate detection: before creating, search embeddings for similar blocks, warn if >0.85 similarity
- `configure_block_type` (ops-admin only): add/remove fields on block types via AI instruction

**Gates:** G1, G2, G3, G5, G6

---

### P2-S15-FE-02 — AI Creation UX in Chat Widget (MED)

**What:** Add "Create" quick action in widget and a structured preview before block confirmation.

**Context:**
- Existing: `src/components/chat/chat-widget.tsx` — chat widget
- Existing: `src/components/chat/execute-confirmation.tsx` — confirmation dialog

**Files to create:**
- `src/components/chat/block-creation-preview.tsx` — structured preview showing block type, name, fields before AI creates it

**Files to modify:**
- `src/components/chat/chat-widget.tsx` — detect create_block tool calls and render preview instead of generic tool indicator

**Gates:** G1, G4, G5

---

### P2-S15-FE-03 — @mention Block Autocomplete (MED)

**What:** Typing `@` in chat input triggers block search dropdown. Selection inserts block reference into message.

**Context:**
- Deferred from Sprint 14 FE-02 (page context integration)
- Existing: `src/components/chat/chat-input.tsx` — chat input component
- Existing: `src/app/api/blocks/route.ts` — blocks list API with search

**Files to modify:**
- `src/components/chat/chat-input.tsx` — add @mention detection, dropdown rendering, block insertion

**Logic:**
- On `@` keystroke: show dropdown with block search
- Debounced search against blocks API (name ilike)
- Selection inserts `@BlockName` and stores blockId in message metadata
- Send blockId with message to chat API for context

**Gates:** G1, G4, G5

---

### P2-S15-QA-01 — Integration and AI Tests (MED)

**What:** E2E wizard flow (mocked OAuth). Unit tests for entity creation parsing, tool definitions, @mention.

**Files to create:**
- `src/components/integrations/__tests__/onboarding-wizard.test.tsx` — wizard step navigation, provider selection, test connection
- `src/lib/ai/__tests__/entity-creation.test.ts` — NL→block parsing, duplicate detection, field validation
- `src/components/chat/__tests__/chat-input.test.tsx` — @mention detection, dropdown, insertion

**Test cases:**
- Wizard: renders steps, navigates forward/back, shows provider options, test connection success/failure
- Entity creation: parses "Create a client called Acme" → {type: 'client', name: 'Acme'}, rejects invalid field types, detects duplicates
- @mention: `@` triggers dropdown, typing filters results, selection inserts reference, blockId stored

**Gates:** G1, G2, G5

---

## Dependencies

```
FE-01 (wizard) ──────────── independent
BE-01 (AI entity creation) ── independent
FE-03 (@mention) ─────────── independent

FE-02 (AI creation UX) ───── depends on BE-01
QA-01 (tests) ────────────── depends on FE-01 + BE-01 + FE-02
```
