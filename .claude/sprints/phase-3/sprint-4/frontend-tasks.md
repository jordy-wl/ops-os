# Sprint 4 — Frontend Tasks

## P3-S4-FE-01 — Routing Config in Workflow Builder

**Complexity:** MEDIUM
**Priority:** 3 (after BE-03)
**Dependencies:** P3-S4-BE-03
**Applicable Gates:** G1, G2, G4, G5
**Assigned Role:** Frontend Engineer
**Estimate:** 2.5 days

### Description

Add routing configuration controls to the workflow builder canvas node config panel. Each step node can be configured with a routing mode, SOP instructions, and required permissions.

### What to Build

1. **Routing mode selector in node config panel:**
   - Dropdown: Human Only, AI Only, Hybrid, Escalation Chain
   - "Inherit from policy" option (default -- no override)
   - Visual indicator on the canvas node showing the routing mode:
     - Human Only: user icon
     - AI Only: bot icon
     - Hybrid: split icon
     - Escalation Chain: chain icon

2. **Step instructions (SOP) textarea:**
   - Multiline text area in the node config panel
   - Label: "Standard Operating Procedure"
   - Placeholder: "Describe what should happen at this step..."
   - Markdown support (render preview below textarea)
   - Character count indicator

3. **Required permissions multi-select:**
   - Multi-select dropdown listing all 10 RBAC permissions
   - Shows selected permissions as chips/badges
   - Tooltip on each permission explaining what it controls
   - "Any team member" option when no specific permission required

4. **Visual canvas node updates:**
   - Routing mode badge on each node (small icon in top-right corner)
   - SOP indicator: small document icon if instructions are set
   - Permission indicator: lock icon if required_permissions are set

### Files to Modify

- `src/components/workflow/node-config-panel.tsx` (add routing fields)
- `src/components/workflow/canvas-node.tsx` (add visual indicators)
- `src/components/workflow/routing-mode-select.tsx` (new component)
- `src/components/workflow/permission-select.tsx` (new component)

### Acceptance Criteria

- [ ] Routing mode dropdown with all 4 modes + inherit option
- [ ] SOP textarea with markdown preview
- [ ] Permission multi-select with all 10 RBAC permissions
- [ ] Canvas nodes show routing mode, SOP, and permission indicators
- [ ] Changes persist to the workflow template via the existing save flow
- [ ] Tested at 375px (config panel full-width), 768px, 1280px, 1920px
- [ ] Dark mode compatible

---

## P3-S4-FE-02 — Enhanced Task Card UI

**Complexity:** MEDIUM
**Priority:** 4 (after BE-04)
**Dependencies:** P3-S4-BE-04
**Applicable Gates:** G1, G2, G4, G5
**Assigned Role:** Frontend Engineer
**Estimate:** 2.5 days

### Description

Redesign the task card component to display AI recommendations, confidence scores, routing indicators, and action buttons (Approve/Reject/Edit). Transform task cards from simple work items into rich decision cards.

### What to Build

1. **Task card layout:**
   - Header: task title + routing indicator badge (Human/Agent/Approval)
   - Context summary: collapsible section showing input_data formatted as key-value pairs
   - AI recommendation section (if present):
     - Recommendation text in a highlighted box
     - Confidence badge: color-coded score (green >= 0.8, amber 0.5-0.79, red < 0.5)
     - Expandable "Reasoning" section showing confidence factors
   - SOP instructions section (if present):
     - Rendered markdown of the step instructions
     - Collapsible, expanded by default

2. **Action buttons:**
   - **Approve**: accept AI recommendation or mark step complete (green)
   - **Reject**: reject and route to escalation (red)
   - **Edit**: open editor to modify the recommendation before approving (amber)
   - Button visibility based on permissions (from Sprint 3 RBAC)
   - Confirmation dialog on Reject

3. **Routing indicator:**
   - Visual badge showing routing decision: "Routed to Human", "AI Handled", "Pending Approval"
   - Tooltip showing routing reason
   - Confidence score as a small progress bar or badge

4. **Decision outcome:**
   - After Approve/Reject/Edit: card shows the decision outcome
   - Completed by: user name or "AI Agent"
   - Decision timestamp

### Files to Create/Modify

- `src/components/tasks/task-card.tsx` (redesign)
- `src/components/tasks/ai-recommendation.tsx` (new)
- `src/components/tasks/confidence-badge.tsx` (new)
- `src/components/tasks/routing-indicator.tsx` (new)
- `src/components/tasks/task-actions.tsx` (new: Approve/Reject/Edit)

### Acceptance Criteria

- [ ] Task card displays context summary, AI recommendation, and confidence score
- [ ] Confidence badge color-coded: green (>= 0.8), amber (0.5-0.79), red (< 0.5)
- [ ] Routing indicator shows decision and reason on hover
- [ ] Approve/Reject/Edit buttons functional with correct API calls
- [ ] Reject shows confirmation dialog
- [ ] Decision outcome displayed after action taken
- [ ] Permission-based button visibility (approve_tasks permission required)
- [ ] Responsive at 375px (full-width card), 768px, 1280px, 1920px
- [ ] Dark mode compatible
- [ ] Task cards without AI data (legacy) render gracefully (no errors, simplified layout)
