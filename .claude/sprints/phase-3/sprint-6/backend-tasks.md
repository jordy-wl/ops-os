# Sprint 6 — Backend Tasks

## P3-S6-BE-01 — Reference Template Storage (HIGH)

**Priority:** 1 (critical path -- AI-01 and FE-01 depend on this)
**Deps:** None
**Gates:** G1, G2, G3, G5, G6

### What to Build
Enable upload of reference documents (PDF/DOCX/HTML) as `document_template` blocks stored in Supabase Storage. After upload, AI extracts the document's structure and layout description (headings, sections, formatting patterns, tone) and stores it as structured metadata on the block. This metadata is used by the document generation step to match reference style.

### Key Files
- Create: `src/app/api/templates/route.ts` -- CRUD API for document_template blocks
- Create: `src/app/api/templates/[id]/upload/route.ts` -- file upload endpoint (multipart, stores to Supabase Storage)
- Create: `src/lib/documents/template-extraction.ts` -- AI-powered structure extraction from uploaded documents
- Create: `src/lib/documents/template-types.ts` -- TypeScript types for template metadata (sections, formatting, tone)
- Modify: `src/lib/block-types/` -- add `document_template` block type definition with appropriate field schema

### Acceptance Criteria
- [ ] Upload API accepts PDF, DOCX, HTML files (max 10MB) and stores in Supabase Storage
- [ ] AI extraction produces structured metadata: sections, headings hierarchy, formatting patterns, tone description
- [ ] Metadata stored as JSON on the document_template block's metadata field
- [ ] CRUD endpoints (list, get, update, delete) for template blocks with org_id scoping
- [ ] File type validation rejects unsupported formats with clear error message

---

## P3-S6-BE-02 — Document Storage & Versioning (MEDIUM)

**Priority:** 1 (independent, start immediately)
**Deps:** None
**Gates:** G1, G2, G3, G5

### What to Build
Store generated documents in Supabase Storage linked to their source block. Each generation creates a new version. API endpoints for listing document versions, retrieving a specific version, and downloading files.

### Key Files
- Create: `src/app/api/documents/route.ts` -- list documents for a block (paginated)
- Create: `src/app/api/documents/[id]/route.ts` -- get document by ID, download endpoint
- Create: `src/app/api/documents/[id]/versions/route.ts` -- list versions for a document
- Create: `src/lib/documents/storage.ts` -- Supabase Storage helpers (upload, download, version management)
- Create: `src/lib/documents/types.ts` -- document metadata types (version, source_block_id, generated_at, template_id)

### Acceptance Criteria
- [ ] Generated documents stored in Supabase Storage with path: `org_id/documents/block_id/version_N.pdf`
- [ ] Version number auto-increments per source block
- [ ] List API returns documents for a block with version history (most recent first)
- [ ] Download API returns signed URL for Supabase Storage file
- [ ] Org-scoped: users can only access documents within their organization
