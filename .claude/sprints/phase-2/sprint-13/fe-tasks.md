# Sprint 13 — Frontend Engineer Tasks

## P2-S13-FE-01 — Update Block Canvas Node (MED)

**Priority:** 1 (depends on BE-01)
**Estimated effort:** 2 days

### What to Build
Add an "Update Block" node type to the workflow canvas. Config panel lets user select target block type, pick fields, and set values.

### Files to Create
- `src/components/canvas/nodes/update-block-node.tsx` — custom React Flow node

### Files to Modify
- `src/components/canvas/workflow-canvas.tsx` — register `update-block` node type in `nodeTypes`
- `src/components/canvas/node-palette.tsx` — add "Update Block" item to palette
- `src/components/canvas/panels/node-config-panel.tsx` — add `update_block` config section

### Implementation Details

**Node visual:**
- Icon: Pencil/Edit icon (from Lucide)
- Title: "Update Block"
- Subtitle: target type name (e.g., "client") + field count
- Color: matches action nodes (existing pattern)

**Config panel for update_block:**
1. Block type selector (dropdown, fetches from /api/block-types)
2. Field picker (dropdown, fetches from /api/block-types/{id}/fields — Sprint 12 API)
3. Value input: type-appropriate based on field type
   - text/email/url/phone → text input
   - number/currency → number input
   - boolean → checkbox
   - select → dropdown with enum values
   - date → date input
   - Template expressions: allow `{{context.source_block_id}}`, `{{block.field_name}}`
4. Block ID source: radio (context block / specific block / relation field)

**Serialization:**
```typescript
{
  stepName: 'update_block_1',
  stepType: 'update_block',
  config: {
    block_id: '{{context.source_block_id}}',
    fields: { status: 'active', onboarded_at: '{{context.timestamp}}' }
  }
}
```

### Gates
G1 (Code Quality), G4 (Frontend Quality), G5 (Security)

---

## P2-S13-FE-02 — Canvas-First Workflow Creation (MED)

**Priority:** 2 (independent, no deps)
**Estimated effort:** 2 days

### What to Build
Replace the multi-field CreateTemplateModal with a lightweight name-only dialog. After creation, redirect to canvas builder. Add inline name editing and trigger node pre-placement in builder.

### Files to Modify
- `src/components/workflows/workflow-templates-client.tsx` — simplify CreateTemplateModal
- `src/app/(app)/workflows/[id]/builder/builder-client.tsx` — inline name editing, empty canvas handling

### Implementation Details

**New creation flow:**
1. User clicks "Create Workflow" on templates page
2. Modal shows: name input only + "Create" button
3. POST /api/blocks creates workflow_template block with minimal metadata:
   ```json
   { "name": "...", "type": "workflow_template", "metadata": { "trigger": { "type": "manual" }, "steps": [] } }
   ```
4. Redirect to `/workflows/{id}/builder`

**Builder enhancements:**
- If no `canvas_layout` in template metadata → auto-place trigger node at position (400, 50)
- Builder header: click-to-edit name (input with pencil icon), "applies_to_type" selector dropdown
- Save button: `canvasToTemplate(layout)` → PATCH /api/blocks/{id} with updated metadata
- Back button: return to /workflows

**Remove from CreateTemplateModal:**
- Description field (move to builder)
- Applies_to_type selector (move to builder)
- Trigger configuration (move to canvas trigger node)
- Steps array builder (replaced by canvas)

### Gates
G1 (Code Quality), G4 (Frontend Quality), G5 (Security)
