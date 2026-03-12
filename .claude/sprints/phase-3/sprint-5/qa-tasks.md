# Sprint 5 — QA Tasks

## P3-S5-QA-01 — Canvas Enhancement Tests (MEDIUM)

**Priority:** 3 (wait for all implementation tasks)
**Deps:** P3-S5-FE-01, P3-S5-FE-02, P3-S5-BE-01, P3-S5-FE-03, P3-S5-FE-04
**Gates:** G1, G2, G5

### What to Test
Input/Output node creation and configuration, node palette categories, serialization round-trips, data flow edge rendering, and instructions persistence.

### Key Files
- Create: `src/components/canvas/__tests__/input-output-nodes.test.tsx` -- node rendering, handle connections, config panel
- Create: `src/components/canvas/__tests__/node-palette.test.tsx` -- category rendering, collapse/expand, drag start
- Create: `src/components/canvas/__tests__/data-flow-edge.test.tsx` -- edge rendering, color coding, hover tooltip
- Create: `src/components/canvas/__tests__/instructions-editor.test.tsx` -- markdown editor, preview toggle, persistence
- Create: `src/lib/workflow/__tests__/canvas-serialization.test.ts` -- round-trip tests (if not covered by BE-01)

### Test Cases
- Input/Output nodes: render correctly, expose handles, accept configuration, connect to other nodes
- Node palette: 4 categories rendered, collapse/expand works, all node types present, drag initiates
- Serialization: canvas -> template -> canvas round-trip preserves all Input/Output data and edge metadata
- Data flow edges: blue for data, gray for control, hover shows field mappings, real-time updates
- Instructions: markdown renders, preview mode works, persists through save/reload

### Acceptance Criteria
- [ ] All new test files pass
- [ ] Full suite passes with 0 failures
- [ ] Lint clean, build clean
- [ ] Edge cases: empty instructions, disconnected nodes, palette with no matching category
