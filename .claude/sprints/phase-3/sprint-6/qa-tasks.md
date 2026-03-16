# Sprint 6 — QA Tasks

## P3-S6-QA-01 — Document Generation Tests (MEDIUM)

**Priority:** 4 (wait for all implementation tasks)
**Deps:** P3-S6-BE-01, P3-S6-AI-01, P3-S6-FE-01, P3-S6-FE-02, P3-S6-BE-02
**Gates:** G1, G2, G5

### What to Test
Template upload and AI structure extraction, context assembly for generation, brand kit styling application, document versioning, and template library UI.

### Key Files
- Create: `src/lib/documents/__tests__/template-extraction.test.ts` -- AI extraction mocking, structure validation
- Create: `src/lib/documents/__tests__/context-assembly.test.ts` -- block + edges + events + template fetching
- Create: `src/lib/documents/__tests__/storage.test.ts` -- version management, path generation, signed URLs
- Create: `src/components/documents/__tests__/template-card.test.tsx` -- card rendering, category display
- Create: `src/components/documents/__tests__/document-preview.test.tsx` -- preview rendering, version switching, edit mode

### Test Cases
- Template upload: valid file types accepted, oversized files rejected, extraction returns structured metadata
- Context assembly: fetches source block, connected blocks via edges, recent events, template structure
- Brand kit: logo URL rendered, primary color applied, font family set
- Versioning: auto-increment version numbers, list sorted by recency, download returns correct version
- Template library: grid renders cards, filter by category works, upload dialog validates inputs
- Document preview: renders content, inline edit toggles, version history loads, PDF download triggers

### Acceptance Criteria
- [ ] All new test files pass
- [ ] Full suite passes with 0 failures
- [ ] Lint clean, build clean
- [ ] Edge cases: empty template structure, block with no connected blocks, first version (no history)
