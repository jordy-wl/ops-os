# Sprint 15 — Backend/AI Tasks

## P2-S15-BE-01 — AI Entity Creation Tools (HIGH)

**Priority:** 1 (critical path — FE-02 depends on this)
**Deps:** None
**Gates:** G1, G2, G3, G5, G6

### What to Build
Enhance chat tools for intelligent block creation with field validation and duplicate detection.

### Key Files
- Modify: `src/lib/ai/chat-tools.ts` — enhance create_block with field population, add configure_block_type
- Create: `src/lib/ai/entity-creation.ts` — NL→block translation, field_schema validation
- Create: `src/lib/ai/research-tools.ts` — embeddings search for duplicate detection
- Create: `src/prompts/entity-creation.v1.md` — structured entity extraction prompt

### Acceptance Criteria
- [ ] `create_block` tool accepts metadata fields, validates against block_type field_schema
- [ ] Duplicate detection: search embeddings before creation, warn if >0.85 similarity
- [ ] `configure_block_type` tool (ops-admin only): add/remove fields on block types
- [ ] Entity creation prompt extracts structured data from NL ("Create a client called Acme in Sydney")
- [ ] All tools return structured results with success/error
- [ ] 80%+ test coverage on new files
