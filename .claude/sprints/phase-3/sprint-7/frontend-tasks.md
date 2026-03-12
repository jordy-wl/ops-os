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
