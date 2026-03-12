# Sprint 2 — Frontend Tasks

## P3-S2-FE-01 — Update Block Creation UI for New Types

**Complexity:** MEDIUM
**Priority:** 4 (after BE-05 completes)
**Dependencies:** P3-S2-BE-05
**Applicable Gates:** G1, G2, G4, G5
**Assigned Role:** Frontend Engineer
**Estimate:** 2 days

### Description

Update the block creation modal and block list UI to support the 5 new system block types (Solution, Product, Service, Team Member, Policy). The UI should dynamically fetch available types from the API rather than using a hardcoded list.

### What to Build

1. **Block creation modal:**
   - Fetch available block types from `GET /api/blocks/types` (or equivalent)
   - Display all types with their icon, color, and display name
   - Group types logically: People (Contact, Team Member), Business (Organisation, Solution, Product, Service), Operations (Policy, Workflow)
   - Show type-specific fields based on field_schema when a type is selected

2. **Block list/library:**
   - Add new types to the filter dropdown
   - Display correct icon and color badge for each new type
   - Existing type filters continue to work

3. **Icons and colors:**
   - Solution: Lightbulb icon, blue
   - Product: Package icon, green
   - Service: Wrench icon, purple
   - Team Member: UserCircle icon, orange
   - Policy: Shield icon, red

### Files to Modify

- `src/components/blocks/block-creation-modal.tsx` (or equivalent)
- `src/components/blocks/block-list.tsx` (or equivalent)
- `src/lib/blocks/block-type-config.ts` (icon/color mapping -- extend or make dynamic)

### Acceptance Criteria

- [ ] All 5 new block types appear in the creation modal
- [ ] Types are grouped by logical category
- [ ] Selecting a type shows its field_schema-driven form fields
- [ ] New types appear in block list filters with correct icons and colors
- [ ] Block creation for all new types works end-to-end
- [ ] Tested at 375px, 768px, 1280px, 1920px breakpoints
- [ ] Dark mode renders correctly for new type badges and icons
