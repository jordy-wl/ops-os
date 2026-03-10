# Sprint 9 Tasks — Document Generation + Brand System

**Phase:** 2 — Composable Blocks, Visual Builder & Integrations
**Sprint:** 9
**Sprint Goal:** Build document templates, brand components, template rendering engine, PDF generation, and AI-powered document generation. Document Library and Brand Kit management UI.
**Target Duration:** ~2 weeks
**Carried Over:** P2-S8-BE-03 (Gmail receive trigger — optional, low priority)

---

## Task List

| ID | Title | Role | Complexity | Deps | Status |
|----|-------|------|-----------|------|--------|
| P2-S9-BE-01 | Document Template Block Type | Backend | MED | — | OPEN |
| P2-S9-BE-02 | Brand Components System | Backend | MED | — | OPEN |
| P2-S9-BE-03 | Template Rendering Engine | Backend | HIGH | BE-01, BE-02 | OPEN |
| P2-S9-BE-04 | PDF Generation | Backend | HIGH | BE-03 | OPEN |
| P2-S9-BE-05 | AI Document Generation Action | Backend | HIGH | BE-03 | OPEN |
| P2-S9-FE-01 | Document Library + Template Editor | Frontend | HIGH | BE-01 | OPEN |
| P2-S9-FE-02 | Brand Kit Management UI | Frontend | MED | BE-02 | OPEN |
| P2-S9-FE-03 | Document Generation Modal | Frontend | MED | BE-05 | OPEN |
| P2-S9-FE-04 | Wire to Canvas + Action Menu | Frontend | LOW | S7 canvas, S8 actions | OPEN |
| P2-S9-QA-01 | Document Generation Tests | QA | MED | BE-03, BE-04 | OPEN |

**Total:** 10 tasks (5 BE, 4 FE, 1 QA)
**Critical path:** BE-01 + BE-02 → BE-03 (rendering) → BE-04 (PDF) + BE-05 (AI gen) → QA-01

---

## Task Details

### P2-S9-BE-01 — Document Template Block Type (MED)

**What:** New block type `document_template` with field_schema for template content and variables.

**Files:**
- Supabase migration to seed `document_template` block type definition
- Alternatively: use existing `block_type_definitions` API to create the type

**Details:**
- field_schema: `{ template_name, template_content (HTML/markdown), variables[], output_format }`
- Templates stored as blocks with type `document_template`
- Template content uses `{{block.name}}`, `{{block.metadata.field}}` variable syntax

**Gates:** G1, G2, G5

---

### P2-S9-BE-02 — Brand Components System (MED)

**What:** New block type `brand_kit` with brand identity components. One per org.

**Files:**
- Seed `brand_kit` block type definition

**Details:**
- field_schema: `{ logo_url, primary_color, secondary_color, font_family, header_style, footer_content, company_name, tagline }`
- One brand_kit block per organisation
- Used by rendering engine to apply consistent brand styling

**Gates:** G1, G2, G5

---

### P2-S9-BE-03 — Template Rendering Engine (HIGH)

**What:** Take a document_template block + source block data + brand_kit → interpolate variables, apply brand styling, output HTML.

**Files:**
- `src/lib/documents/renderer.ts`

**Details:**
- `renderDocument(templateBlock, sourceBlock, brandKit)` → HTML string
- Variable interpolation: `{{block.name}}`, `{{block.metadata.jurisdiction}}`, etc.
- Brand styling: inject CSS for colors, fonts, header/footer from brand_kit
- Support both HTML and Markdown template_content (Markdown converted to HTML)

**Gates:** G1, G2, G3, G5

---

### P2-S9-BE-04 — PDF Generation (HIGH)

**What:** Convert rendered HTML to PDF. Store in Google Drive if connected.

**Files:**
- `src/lib/documents/pdf.ts`

**Details:**
- Evaluate: `@react-pdf/renderer` vs `jspdf` vs Puppeteer
- `generatePdf(html, options?)` → Buffer
- If Google connector active: upload PDF to Drive via google-drive.ts
- Return: PDF buffer + optional Drive file URL

**Gates:** G1, G2, G3, G5

---

### P2-S9-BE-05 — AI Document Generation Action (HIGH)

**What:** Register `document.generate` in action registry. Uses Claude to generate document content.

**Files:**
- `src/lib/actions/handlers/document-generate.ts`
- Update `src/lib/actions/registry.ts`

**Details:**
- Zod schema: `{ template_id?, source_block_id, prompt, output_format? }`
- If template_id provided: use template + block data + brand kit
- If no template: AI generates from prompt + block data + brand kit
- Uses Claude Sonnet for generation (reuse existing AI chat infrastructure)
- Records `document.generated` event

**Gates:** G1, G2, G3, G5

---

### P2-S9-FE-01 — Document Library + Template Editor (HIGH)

**What:** Browse templates and generated documents. Rich text/markdown editor for templates.

**Files:**
- `src/app/(app)/library/documents/page.tsx`
- `src/components/library/document-browser.tsx`
- `src/components/documents/template-editor.tsx`

**Details:**
- Browse: list document_template blocks + any generated documents
- Editor: markdown/HTML editor with variable insertion buttons
- Preview: render template with sample data
- Download: PDF generation link

**Gates:** G1, G4, G5

---

### P2-S9-FE-02 — Brand Kit Management UI (MED)

**What:** Upload logo, pick colors, set fonts, preview brand components.

**Files:**
- `src/app/(app)/settings/brand/page.tsx`
- `src/components/settings/brand-kit-editor.tsx`

**Details:**
- Color pickers for primary/secondary colors
- Font family selector
- Logo upload (or URL)
- Live preview panel showing how brand appears in documents

**Gates:** G1, G4, G5

---

### P2-S9-FE-03 — Document Generation Modal (MED)

**What:** Select template or "AI Generate", select source block, preview, generate.

**Files:**
- `src/components/documents/generate-document-modal.tsx`

**Details:**
- Accessible from action menu on block detail + Document Library
- Select template (or "AI Generate")
- Select source block (pre-filled when launched from block detail)
- Preview rendered document
- Generate PDF + download

**Gates:** G1, G4, G5

---

### P2-S9-FE-04 — Wire to Canvas + Action Menu (LOW)

**What:** Add "Generate Document" node type to canvas. Already in action menu from Sprint 8.

**Files:**
- No new files — `generate_document` step type already in template-schema.ts and action menu

**Details:**
- Verify canvas config panel handles `generate_document` step type
- Verify action menu dispatches `document.generate` action
- Wire step-engine `generate_document` case

**Gates:** G1, G4, G5

---

### P2-S9-QA-01 — Document Generation Tests (MED)

**What:** Template rendering tests, variable interpolation, brand application, PDF output.

**Files:**
- `src/lib/documents/__tests__/renderer.test.ts`
- `src/lib/documents/__tests__/pdf.test.ts`

**Details:**
- Template variable interpolation (valid, missing, nested)
- Brand styling application (colors, fonts, header/footer)
- PDF generation (mock or lightweight)
- AI generation (mocked Claude response)

**Gates:** G1, G2, G5

---

## Dependencies

```
BE-01 (Document Template Type)
  └── BE-03 (Rendering Engine) ← also needs BE-02
BE-02 (Brand Kit Type)
  └── BE-03 (Rendering Engine)
        ├── BE-04 (PDF Generation)
        └── BE-05 (AI Generation)

FE-01 (Document Library) ← needs BE-01
FE-02 (Brand Kit UI) ← needs BE-02
FE-03 (Generation Modal) ← needs BE-05
FE-04 (Canvas Wiring) ← needs S7 canvas, S8 actions

QA-01 — after BE-03, BE-04
```
