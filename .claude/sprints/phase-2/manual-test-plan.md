# Ops OS — Manual Test Plan (Phase 2)

> Step-by-step testing guide for manual verification of all Phase 2 features.
> Test with a real browser at your Vercel preview URL or `localhost:3000`.

---

## Prerequisites

- [ ] Logged in via Clerk (org selected)
- [ ] Supabase project running with all migrations applied
- [ ] Google OAuth credentials configured (for Google integration tests)
- [ ] `ANTHROPIC_API_KEY` set (for AI document generation)
- [ ] Demo data seeded (`npm run seed:demo`) OR willing to create data manually

---

## 1. Navigation & Layout

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 1.1 | Click each nav item: Dashboard, My Work, Workflows, Library, Chat | Each page loads without error | |
| 1.2 | Hover over "Library" in nav | Dropdown shows: Blocks, Integrations, Documents | |
| 1.3 | Click Library > Blocks | Navigates to `/library/blocks` | |
| 1.4 | Click Library > Integrations | Navigates to `/library/integrations` | |
| 1.5 | Click Library > Documents | Navigates to `/library/documents` | |
| 1.6 | Resize browser to 375px width | Nav collapses to mobile layout, no overflow | |
| 1.7 | Resize browser to 768px width | Nav adjusts to tablet layout | |
| 1.8 | Resize browser to 1920px width | Full nav visible, no wasted space | |

---

## 2. Dashboard

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 2.1 | Navigate to `/dashboard` | Page loads with summary content | |
| 2.2 | Verify block count displays | Shows count of blocks in org | |
| 2.3 | Verify recent events section | Shows recent activity (if events exist) | |
| 2.4 | With no data (empty org) | Shows appropriate empty state messaging | |

---

## 3. Block Management

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 3.1 | Go to Library > Blocks | Block library loads with type filters and search | |
| 3.2 | Search for a block by name | Results filter as you type | |
| 3.3 | Filter by block type (e.g., "client") | Only blocks of that type shown | |
| 3.4 | Toggle between grid and list view | Layout switches without losing state | |
| 3.5 | Click a block card | Navigates to block detail page `/blocks/[id]` | |
| 3.6 | On block detail: verify metadata displays | All metadata fields rendered correctly | |
| 3.7 | On block detail: verify events tab | Events listed chronologically with types | |
| 3.8 | On block detail: verify connections/edges | Related blocks shown with edge labels | |
| 3.9 | On block detail: click Action Menu button | Dropdown shows available actions | |
| 3.10 | With no blocks: verify empty state | Helpful message with "Create Block" action | |

---

## 4. Google OAuth Connection

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 4.1 | Go to Integrations page | Google integration card visible | |
| 4.2 | Click "Connect Google" button | Redirects to Google OAuth consent screen | |
| 4.3 | Approve Google permissions | Redirected back to app with success message | |
| 4.4 | Verify connected status | Google shows as "Connected" with account email | |
| 4.5 | Verify scopes granted | Gmail, Calendar, Drive scopes listed | |

---

## 5. Send Email (Gmail)

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 5.1 | Go to a block detail page | Action menu visible | |
| 5.2 | Click Action Menu > Send Email | Email form modal opens | |
| 5.3 | Fill in: To, Subject, Body | All fields accept input | |
| 5.4 | Click Send | Email sends, success notification shown | |
| 5.5 | Check Gmail sent folder | Email appears in sent items | |
| 5.6 | Verify event created | `email.sent` event appears on block detail | |
| 5.7 | Send with invalid email address | Validation error shown, email not sent | |

---

## 6. Book Meeting (Google Calendar)

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 6.1 | Click Action Menu > Book Meeting | Meeting form modal opens | |
| 6.2 | Fill in: Title, Start, End, Attendees | All fields accept input, date pickers work | |
| 6.3 | Click Book | Meeting created, success notification shown | |
| 6.4 | Check Google Calendar | Event appears with Meet link | |
| 6.5 | Verify event created | `meeting.booked` event appears on block detail | |

---

## 7. Document Templates

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 7.1 | Go to Library > Documents | Document library loads | |
| 7.2 | Verify seeded templates visible | Contract, Proposal, Report templates shown (if seeded) | |
| 7.3 | Filter by category (e.g., "contract") | Only matching templates shown | |
| 7.4 | Search for a template by name | Results filter as you type | |
| 7.5 | Click a template card | Template editor opens | |
| 7.6 | Verify template content displays | HTML/Markdown content shown in editor | |
| 7.7 | Verify variable palette | Common variables listed (block.name, block.metadata.*, brand.*) | |
| 7.8 | Click a variable in palette | Variable inserted into template at cursor position | |
| 7.9 | Click Preview | Preview renders with sample data substituted | |
| 7.10 | With no templates: verify empty state | "No templates yet" message with create link | |

---

## 8. Brand Kit

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 8.1 | Go to Settings > Brand | Brand kit editor loads | |
| 8.2 | Set company name: "Thornfield Capital" | Input accepts text | |
| 8.3 | Set primary color via color picker | Color updates in live preview | |
| 8.4 | Set secondary color | Color updates in live preview | |
| 8.5 | Select font family (e.g., Inter) | Preview font changes | |
| 8.6 | Enter logo URL | Logo preview shows (or placeholder if invalid) | |
| 8.7 | Enter footer content | Footer preview updates | |
| 8.8 | Click Save | Success indicator shown, data persists on reload | |
| 8.9 | Reload page | All brand settings still present | |

---

## 9. Document Generation — Template-Based

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 9.1 | Go to a block detail page | Action menu visible | |
| 9.2 | Click Action Menu > Generate Document | Document generation modal opens | |
| 9.3 | Select "From Template" mode | Template dropdown appears | |
| 9.4 | Select a template (e.g., "Client Onboarding Agreement") | Template selected | |
| 9.5 | Verify source block is pre-selected | Current block shown as source | |
| 9.6 | Select output format: HTML | HTML option selected | |
| 9.7 | Click Generate | Document generates, success shown | |
| 9.8 | Verify generated HTML | Variables replaced with real block data | |
| 9.9 | Verify brand styling applied | Brand colors, fonts, header/footer present | |
| 9.10 | Verify `document.generated` event | Event recorded on block | |

---

## 10. Document Generation — AI-Based

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 10.1 | Open Generate Document modal | Modal opens | |
| 10.2 | Select "AI Generate" mode | Prompt textarea appears | |
| 10.3 | Enter prompt: "Draft a client onboarding summary for this client" | Textarea accepts input | |
| 10.4 | Click Generate | Loading indicator shows, AI generates content | |
| 10.5 | Verify generated document | AI-generated content with block context | |
| 10.6 | Verify brand styling applied | Brand kit styling applied to generated doc | |

---

## 11. Workflow Canvas Builder

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 11.1 | Go to Workflows page | Templates tab shows workflow templates | |
| 11.2 | Click "New Workflow" or "Edit in Builder" | Canvas builder opens | |
| 11.3 | Verify node palette visible | Trigger, Action, Flow Control categories shown | |
| 11.4 | Drag a "Manual Start" trigger node | Node appears on canvas | |
| 11.5 | Drag a "Send Email" action node | Node appears on canvas | |
| 11.6 | Connect trigger → action (drag handle) | Edge drawn between nodes | |
| 11.7 | Click on Send Email node | Config panel opens on the right | |
| 11.8 | Configure email step (to, subject, body fields) | Fields accept input | |
| 11.9 | Add a "Generate Document" node | Node appears, connect to previous | |
| 11.10 | Configure document step (template_id, output_format) | Fields accept input | |
| 11.11 | Click Save | Template saved, success notification | |
| 11.12 | Reload page | Canvas layout and node config preserved | |
| 11.13 | Add a Condition node | Branching node with two output handles | |
| 11.14 | Add a Wait node | Timer configuration available | |
| 11.15 | Zoom in/out using scroll wheel | Canvas zooms smoothly | |
| 11.16 | Pan canvas by dragging background | Canvas pans smoothly | |

---

## 12. End-to-End Workflow Execution

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 12.1 | Create a workflow with: Trigger → Send Email → Generate Document | Template saved via canvas | |
| 12.2 | Create or select a source block (client) | Block exists with metadata | |
| 12.3 | Trigger the workflow (manual start or block event) | Workflow instance created with status "running" | |
| 12.4 | Verify email step executes | Email sent (check Gmail), `email.sent` event recorded | |
| 12.5 | Verify document step executes | Document generated, `document.generated` event recorded | |
| 12.6 | Verify workflow completes | Instance status changes to "done" | |
| 12.7 | Check Workflows > Jobs tab | Job shows as completed with step results | |
| 12.8 | Check block events | All step events recorded on source block | |

---

## 13. My Work Hub

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 13.1 | Navigate to `/my-work` | Personal hub loads | |
| 13.2 | Verify assigned tasks section | Task queue items assigned to you shown | |
| 13.3 | Verify owned workflows section | Your workflow instances with status | |
| 13.4 | Verify owned blocks section | Recently modified blocks shown | |
| 13.5 | Verify recent activity feed | Recent events related to your work | |
| 13.6 | Claim a task from task list | Task status changes to "claimed" | |
| 13.7 | Complete a claimed task | Task marked complete, removed from active list | |

---

## 14. AI Chat

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 14.1 | Navigate to `/chat` | Chat interface loads | |
| 14.2 | Type a question: "What blocks do I have?" | AI responds with relevant block information | |
| 14.3 | Ask about a specific block by name | AI retrieves and describes the block | |
| 14.4 | Ask to create something: "Create a new client block for Acme Corp" | AI initiates block creation action | |
| 14.5 | Verify conversation history persists | Previous messages shown on reload | |

---

## 15. Integration Library

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 15.1 | Go to Library > Integrations | Integration catalog loads | |
| 15.2 | Verify capability grouping | Cards grouped by: Email, Calendar, Documents, Webhooks | |
| 15.3 | Verify connected status | Connected integrations show green status | |
| 15.4 | Verify available actions per capability | Each card lists what actions are available | |

---

## 16. Error Handling & Edge Cases

| # | Step | Expected Result | Pass? |
|---|------|----------------|-------|
| 16.1 | Navigate to a non-existent block ID | 404 or "Block not found" message | |
| 16.2 | Navigate to a non-existent workflow | 404 or "Workflow not found" message | |
| 16.3 | Send email without Google connected | Clear error: "Connect Google first" | |
| 16.4 | Generate document without brand kit | Document generates without brand styling | |
| 16.5 | Generate document with empty template | Graceful handling, no crash | |
| 16.6 | Try to save brand kit with empty company name | Validation error shown | |
| 16.7 | Open app in incognito (not logged in) | Redirected to Clerk login | |

---

## Test Summary

| Section | Tests | Passed | Failed | Notes |
|---------|-------|--------|--------|-------|
| 1. Navigation & Layout | 8 | | | |
| 2. Dashboard | 4 | | | |
| 3. Block Management | 10 | | | |
| 4. Google OAuth | 5 | | | |
| 5. Send Email | 7 | | | |
| 6. Book Meeting | 5 | | | |
| 7. Document Templates | 10 | | | |
| 8. Brand Kit | 9 | | | |
| 9. Doc Gen — Template | 10 | | | |
| 10. Doc Gen — AI | 6 | | | |
| 11. Canvas Builder | 16 | | | |
| 12. E2E Workflow | 8 | | | |
| 13. My Work Hub | 7 | | | |
| 14. AI Chat | 5 | | | |
| 15. Integration Library | 4 | | | |
| 16. Error Handling | 7 | | | |
| **TOTAL** | **121** | | | |

---

**Tested by:** _______________
**Date:** _______________
**Environment:** Vercel Preview / localhost:3000
**Browser:** _______________
