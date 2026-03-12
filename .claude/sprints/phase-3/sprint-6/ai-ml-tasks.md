# Sprint 6 — AI/ML Tasks

## P3-S6-AI-01 — Context-Aware Document Generation (HIGH)

**Priority:** 2 (depends on BE-01 for template structure)
**Deps:** P3-S6-BE-01
**Gates:** G1, G2, G3, G5, G6

### What to Build
Enhance the existing `document-generate.ts` action handler to produce context-rich documents. The generation pipeline fetches the source block, all connected blocks (via block_edges), recent events on those blocks, and the reference template's extracted structure. Claude generates document content that matches the reference template's style and layout while populating it with actual block data.

### Key Files
- Modify: `src/lib/actions/handlers/document-generate.ts` -- enhance context assembly and generation prompt
- Create: `src/lib/documents/context-assembly.ts` -- fetch source block + connected blocks + events + template structure
- Create: `src/prompts/document-generation.v2.md` -- enhanced prompt with template style matching instructions
- Modify: `src/lib/documents/renderer.ts` -- accept richer context for rendering (if exists)

### Acceptance Criteria
- [ ] Context assembly fetches: source block fields, connected blocks (1 hop via edges), last 20 events, reference template structure
- [ ] Generation prompt instructs Claude to match reference template's section structure, formatting, and tone
- [ ] Generated content includes actual data from block fields (names, dates, amounts, statuses)
- [ ] Output respects brand kit settings (logo URL, primary color, font family) if configured
- [ ] Fallback: if no reference template specified, generates with a sensible default structure
- [ ] Generation time under 15 seconds for typical documents (10-20 sections)
