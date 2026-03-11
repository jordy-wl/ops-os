# Sprint 16 — DevOps Tasks

## P2-S16-OPS-01 — Performance Audit (MED)

**Priority:** 1 (independent)
**Deps:** None
**Gates:** G1, G5

### What to Audit
Bundle size, function sizes, layout shift, chat widget load impact.

### Deliverables
1. `next build` output analysis — identify pages with First Load JS > 200kB
2. Verify chat widget is not loaded on initial page load (only when opened)
3. Check field components are code-split (dynamic imports where appropriate)
4. Document findings in `sprints/phase-2/sprint-16/performance-report.md`

### Acceptance Criteria
- [ ] Performance report written with specific findings
- [ ] Any critical issues (>300kB pages) flagged with mitigation plan
- [ ] Build output captured and documented
