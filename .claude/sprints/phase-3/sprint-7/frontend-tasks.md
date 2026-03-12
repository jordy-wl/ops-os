# Sprint 7 — Frontend Tasks

## P3-S7-FE-01 — AI Insights Panel Component (HIGH)

**Priority:** 3 (depends on AI-02 for insights data format)
**Deps:** P3-S7-AI-02
**Gates:** G1, G2, G4, G5, G6

### What to Build
A right-side panel on block detail pages (for workflow_instance blocks) that displays delta-powered AI insights. Shows a progress visualization (progress bar with step markers), upcoming steps with expected timing, risk indicators for overdue or at-risk steps, and AI recommendations. Panel is collapsible. Data refreshes via polling or event-based updates.

### Key Files
- Create: `src/components/blocks/insights-panel.tsx` -- main panel component with collapsible sections
- Create: `src/components/blocks/delta-progress-bar.tsx` -- visual progress bar with step markers and health color
- Create: `src/components/blocks/risk-indicators.tsx` -- risk badges (overdue, at-risk, skipped) with tooltips
- Create: `src/app/api/blocks/[id]/insights/route.ts` -- API endpoint that returns delta + insights for a block
- Modify: `src/app/(app)/blocks/[id]/page.tsx` -- integrate insights panel on workflow_instance block pages

### Acceptance Criteria
- [ ] Panel renders on right side of block detail page for workflow_instance blocks only
- [ ] Progress bar shows completed/current/remaining steps with color-coded health (green/yellow/red)
- [ ] Four collapsible sections: "What's Done", "What's Next", "What's at Risk", "Recommendations"
- [ ] Risk indicators: red badge for overdue, amber for at-risk, gray for skipped
- [ ] Auto-refresh: polls every 30 seconds or refreshes on new event (via existing event subscription)
- [ ] Responsive: full-width below panel on mobile, right sidebar on desktop (>= 1280px)

---

## P3-S7-FE-02 — Inline Field Manager on Block Detail Page (MEDIUM)

**Priority:** 4 (parallel with FE-01, depends on S5-AI-01 + S5-BE-02)
**Deps:** P3-S5-AI-01 (complete), P3-S5-BE-02 (complete)
**Gates:** G1, G2, G4, G5

### What to Build
Add "Configure Fields" tab/section to block detail page with: (1) Grouped field list showing current fields organized by `x-field-group` sections, (2) "Add Field" button with popover: field name, type selector (12 types), group assignment dropdown, required toggle, (3) "AI Suggest" button that calls `suggest_fields` with block type + existing fields + groups as context, shows categorized suggestions inline with accept/dismiss per field, (4) Inline group management — drag fields between groups, create new group. Reuses `field-manager.tsx` and `field-config-panel.tsx` patterns adapted for inline use. Only visible to users with `manage_settings` permission. Confirmation dialog on save explains "This changes the field configuration for all [type] blocks".

### Key Files
- Modify: `src/app/(app)/blocks/[id]/page.tsx` -- add Configure Fields tab/section
- Create: `src/components/blocks/inline-field-manager.tsx` -- inline field management component
- Reuse: `src/components/settings/field-manager.tsx` -- patterns for field CRUD
- Reuse: `src/components/settings/field-config-panel.tsx` -- per-field config
- Reuse: `src/lib/ai/field-suggestion.ts` -- AI field suggestion engine

### Acceptance Criteria
- [ ] "Configure Fields" section visible only to users with manage_settings permission
- [ ] Grouped field list renders fields organized by x-field-group sections
- [ ] "Add Field" popover with name, type selector (12 types), group dropdown, required toggle
- [ ] "AI Suggest" button calls suggest_fields API, shows categorized suggestions inline
- [ ] Accept/dismiss per suggested field
- [ ] Confirmation dialog on save: "This changes the field configuration for all [type] blocks"
- [ ] Inline group management: create new group, assign fields to groups
