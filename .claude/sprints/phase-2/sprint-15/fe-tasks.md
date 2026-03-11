# Sprint 15 — Frontend Tasks

## P2-S15-FE-01 — Integration Onboarding Wizard (HIGH)

**Priority:** 1 (independent, can start immediately)
**Deps:** None
**Gates:** G1, G2, G4, G5, G6

### What to Build
Multi-step wizard for connecting integrations: provider selection → auth → configure → test → complete.

### Key Files
- Create: `src/app/(app)/integrations/connect/page.tsx`
- Create: `src/app/(app)/integrations/connect/[provider]/page.tsx`
- Create: `src/components/integrations/onboarding-wizard.tsx`
- Create: `src/components/integrations/connection-test.tsx`

### Acceptance Criteria
- [ ] Wizard has 4-5 steps with progress indicator
- [ ] Provider selection shows Google, Webhook, Custom API
- [ ] Google → OAuth redirect flow
- [ ] Webhook → generate URL + HMAC secret display
- [ ] Custom API → endpoint + key input
- [ ] Test connection button with success/failure feedback
- [ ] Responsive at all 4 breakpoints (375/768/1280/1920)

---

## P2-S15-FE-02 — AI Creation UX in Chat Widget (MED)

**Priority:** 2 (depends on BE-01)
**Deps:** P2-S15-BE-01
**Gates:** G1, G4, G5

### What to Build
Structured block creation preview in chat widget when AI proposes creating a block.

### Key Files
- Create: `src/components/chat/block-creation-preview.tsx`
- Modify: `src/components/chat/chat-widget.tsx` — detect create_block tool calls, render preview

### Acceptance Criteria
- [ ] When create_block tool call is returned, show structured preview (type, name, fields)
- [ ] User can approve or cancel creation
- [ ] Approved: block created, confirmation shown
- [ ] Cancelled: message indicating cancellation

---

## P2-S15-FE-03 — @mention Block Autocomplete (MED)

**Priority:** 2 (independent, can start anytime)
**Deps:** None
**Gates:** G1, G4, G5

### What to Build
@mention block references in chat input with search dropdown.

### Key Files
- Modify: `src/components/chat/chat-input.tsx`

### Acceptance Criteria
- [ ] Typing `@` triggers dropdown
- [ ] Debounced block search (name ilike)
- [ ] Selection inserts `@BlockName` text
- [ ] blockId stored in message metadata and sent to API
- [ ] Escape/click-outside closes dropdown
