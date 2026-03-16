# Sprint 5 — Backend Tasks

## P3-S5-BE-01 — Canvas Data Flow Serialization (MEDIUM)

**Priority:** 2 (depends on FE-01 for Input/Output node definitions)
**Deps:** P3-S5-FE-01
**Gates:** G1, G2, G3, G5

### What to Build
Extend the canvas serialization layer to support Input/Output nodes. Update `canvasToTemplate()` to serialize Input/Output node configurations (field mappings, output types) into the workflow template JSON. Update `stepsToCanvas()` to reconstruct Input/Output nodes from saved templates, preserving all data flow metadata.

### Key Files
- Modify: `src/lib/workflow/canvas-layout.ts` -- extend canvasToTemplate() and stepsToCanvas() for Input/Output nodes
- Modify: `src/lib/workflow/template-schema.ts` -- add input/output step type definitions and data flow edge metadata
- Create: `src/lib/workflow/__tests__/canvas-data-flow.test.ts` -- round-trip serialization tests

### Acceptance Criteria
- [ ] `canvasToTemplate()` correctly serializes Input nodes with field mappings and Output nodes with output types
- [ ] `stepsToCanvas()` reconstructs Input/Output nodes from template JSON with all metadata intact
- [ ] Round-trip test: canvas -> template -> canvas produces identical node configurations
- [ ] Data flow edge metadata (source field, target field, edge type) persisted in template
- [ ] Backward compatible: existing templates without Input/Output nodes still serialize correctly
