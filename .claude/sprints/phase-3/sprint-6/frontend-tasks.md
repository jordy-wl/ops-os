# Sprint 6 — Frontend Tasks

## P3-S6-FE-01 — Template Library Page (MEDIUM)

**Priority:** 2 (depends on BE-01 for template API)
**Deps:** P3-S6-BE-01
**Gates:** G1, G2, G4, G5

### What to Build
A `/library/templates` page for browsing, uploading, and categorizing document templates. Users can preview template structure, upload new reference documents, link templates to workflow steps, and filter by category.

### Key Files
- Create: `src/app/(app)/library/templates/page.tsx` -- template library page with grid/list view
- Create: `src/components/documents/template-card.tsx` -- template preview card (name, category, upload date, section count)
- Create: `src/components/documents/template-upload-dialog.tsx` -- upload dialog with file picker, category selector, name input
- Modify: `src/app/(app)/library/layout.tsx` -- add Templates tab to library navigation (if exists)

### Acceptance Criteria
- [ ] Page displays all document_template blocks for the org in grid layout
- [ ] Upload dialog accepts PDF/DOCX/HTML with progress indicator
- [ ] Category filter (e.g., Proposals, Reports, Letters, Compliance) with multi-select
- [ ] Template card shows: name, category, section count from extracted structure, upload date
- [ ] Click on template opens detail view with full structure preview
- [ ] Responsive at all 4 breakpoints (375/768/1280/1920)

---

## P3-S6-FE-02 — Document Preview Component (HIGH)

**Priority:** 3 (depends on AI-01 for generated content and BE-02 for versioning)
**Deps:** P3-S6-AI-01, P3-S6-BE-02
**Gates:** G1, G2, G4, G5, G6

### What to Build
An artifact-like document preview panel with brand kit styling applied. Supports inline editing of generated content, PDF download, email sending, and version history navigation. Appears as a slide-over or modal from block detail pages.

### Key Files
- Create: `src/components/documents/document-preview.tsx` -- main preview component with rendered content
- Create: `src/components/documents/document-toolbar.tsx` -- toolbar: download PDF, send email, edit toggle, version selector
- Create: `src/components/documents/version-history.tsx` -- version list with timestamps and diff indicators
- Create: `src/components/documents/inline-editor.tsx` -- contentEditable sections for inline editing

### Acceptance Criteria
- [ ] Preview renders document with brand kit styling (logo, colors, fonts)
- [ ] Inline editing: click section to edit, saves back to storage as new version
- [ ] Download PDF button generates and downloads formatted PDF
- [ ] Send via email button opens email compose with document attached
- [ ] Version history dropdown shows all versions with timestamps, click to switch
- [ ] Responsive: full-width on mobile, slide-over panel on desktop
