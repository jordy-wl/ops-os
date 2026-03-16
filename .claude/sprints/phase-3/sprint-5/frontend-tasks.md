# Sprint 5 — Frontend Tasks

## P3-S5-FE-01 — Input/Output Node Types (HIGH)

**Priority:** 1 (critical path -- BE-01 and FE-04 depend on this)
**Deps:** None (Sprint 4 complete is external prerequisite)
**Gates:** G1, G2, G4, G5, G6

### What to Build
New React Flow node components for data flow: InputNode (accepts block fields or external payload as data source) and OutputNode (produces updated fields, documents, events, or API calls). Both nodes must expose typed handles for data flow edges connecting to other canvas nodes.

### Key Files
- Create: `src/components/canvas/nodes/input-node.tsx` -- InputNode component with configurable field mappings
- Create: `src/components/canvas/nodes/output-node.tsx` -- OutputNode component with output type selection
- Modify: `src/components/canvas/canvas-workspace.tsx` -- register new node types in React Flow nodeTypes map
- Modify: `src/lib/workflow/template-schema.ts` -- add input/output step type definitions to schema

### Acceptance Criteria
- [ ] InputNode renders with field selector (block fields or external payload)
- [ ] OutputNode renders with output type options (updated fields, documents, events, API calls)
- [ ] Both nodes expose typed handles (source/target) for data flow edge connections
- [ ] Nodes are draggable from palette and configurable via config panel
- [ ] Responsive at all 4 breakpoints (375/768/1280/1920)

---

## P3-S5-FE-02 — Reorganized Node Palette (MEDIUM)

**Priority:** 1 (independent, start immediately)
**Deps:** None
**Gates:** G1, G2, G4, G5

### What to Build
Reorganize the workflow canvas node palette into logical categories with collapsible sections. Categories: Triggers (manual, event, webhook, schedule), Actions (emit event, run action, call API, send email, generate doc, book meeting, update block), Conditions (if/else, switch), Flow (wait/delay, input, output).

### Key Files
- Modify: `src/components/canvas/node-palette.tsx` -- restructure into categorized, collapsible sections
- Create: `src/components/canvas/palette-category.tsx` -- reusable collapsible category component

### Acceptance Criteria
- [ ] Palette displays 4 categories: Triggers, Actions, Conditions, Flow
- [ ] Each category is collapsible/expandable with chevron indicator
- [ ] All existing node types are correctly categorized
- [ ] Input and Output nodes appear under Flow category
- [ ] Categories persist open/closed state within session

---

## P3-S5-FE-03 — Step Instructions Panel (MEDIUM)

**Priority:** 1 (independent, start immediately)
**Deps:** None
**Gates:** G1, G2, G4, G5

### What to Build
Add an "Instructions" tab to the canvas node config panel. Supports rich text with Markdown formatting and a preview mode toggle. Instructions are visible during task execution so operators know what to do at each step.

### Key Files
- Modify: `src/components/canvas/config-panel.tsx` -- add Instructions tab alongside existing config tabs
- Create: `src/components/canvas/instructions-editor.tsx` -- Markdown editor with preview toggle
- Modify: `src/lib/workflow/template-schema.ts` -- add `instructions` field to step definition

### Acceptance Criteria
- [ ] Instructions tab appears in config panel for all step types
- [ ] Markdown editor with toolbar (bold, italic, lists, headings, links)
- [ ] Preview mode toggle shows rendered Markdown
- [ ] Instructions persist through save/reload (serialized in template)
- [ ] Instructions visible in task execution view (read-only)

---

## P3-S5-FE-04 — Data Flow Visualization (HIGH)

**Priority:** 2 (depends on FE-01 for Input/Output nodes)
**Deps:** P3-S5-FE-01
**Gates:** G1, G2, G4, G5, G6

### What to Build
Visual indicators on canvas edges showing data flow between nodes. Edges are color-coded: blue for data flow, gray for control flow. Hover over an edge to display a tooltip showing field mappings between source and target nodes.

### Key Files
- Create: `src/components/canvas/edges/data-flow-edge.tsx` -- custom React Flow edge with color coding and hover tooltip
- Modify: `src/components/canvas/canvas-workspace.tsx` -- register custom edge types, apply data/control classification
- Modify: `src/lib/workflow/canvas-layout.ts` -- add edge type metadata (data vs control) to serialization

### Acceptance Criteria
- [ ] Data flow edges render in blue, control flow edges in gray
- [ ] Hovering over a data flow edge shows field mapping tooltip
- [ ] Edge classification is automatic based on connected node types (Input/Output = data, others = control)
- [ ] Visualization updates in real-time as nodes are connected/disconnected
- [ ] Edge colors are accessible (sufficient contrast in both light and dark mode)
