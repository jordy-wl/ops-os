# Sprint 16 — Performance Audit Report

**Date:** 2026-03-11
**Task:** P2-S16-OPS-01
**Build tool:** Next.js 15.5.12
**Build time:** 10.3s compile + static generation

---

## Bundle Analysis Summary

### Shared JS (loaded on every page)
- **Total shared:** 102 kB
  - `chunks/1255-*.js`: 46 kB (React + core framework)
  - `chunks/4bd1b696-*.js`: 54.2 kB (Clerk auth + Next.js runtime)
  - Other shared chunks: 2.05 kB

### Page-Level First Load JS

| Page | First Load JS | Page-specific JS | Status |
|------|--------------|-------------------|--------|
| `/workflows/[id]/builder` | **176 kB** | 63.7 kB | WATCH |
| `/org-setup` | 142 kB | 405 B | OK (Clerk auth) |
| `/sign-in`, `/sign-up` | 142 kB | 405 B | OK (Clerk auth) |
| `/dashboard` | 122 kB | 5.09 kB | OK |
| `/blocks/[id]` | 120 kB | 3.79 kB | OK |
| `/settings/block-types/[id]` | 119 kB | 6.53 kB | OK |
| `/workflows` | 118 kB | 5.45 kB | OK |
| `/library/integrations` | 117 kB | 4.22 kB | OK |
| `/library/blocks` | 115 kB | 2.97 kB | OK |
| `/my-work` | 115 kB | 2.76 kB | OK |
| `/integrations` | 115 kB | 3.06 kB | OK |
| `/blocks` | 114 kB | 1.57 kB | OK |
| `/library/documents` | 107 kB | 1.77 kB | OK |
| `/settings/brand` | 105 kB | 2.46 kB | OK |
| `/settings/block-types` | 106 kB | 165 B | OK |
| `/tasks` | 111 kB | 1.98 kB | OK |

### Threshold Analysis
- **> 300 kB (critical):** None
- **> 200 kB (warning):** None
- **> 150 kB (watch):** `/workflows/[id]/builder` at 176 kB

---

## Key Findings

### 1. Workflow Builder (176 kB) — Largest Page
The workflow builder page loads 63.7 kB of page-specific JS. This is expected — it includes:
- React Flow canvas library (~40 kB)
- Node palette, config panels, canvas controls
- Template serialization logic

**Verdict:** Acceptable for a complex canvas-based UI. React Flow is the dominant contributor. No immediate action needed — this is a power-user page, not a landing page.

### 2. Chat Widget — Not Lazy Loaded
The chat widget (`ChatWidgetProvider`) is imported directly in the app layout, meaning its JS is included in every page's bundle as part of the shared chunks.

**Impact:** Minimal — the widget's JS is small (~3-4 kB) and the component renders only a floating button when collapsed (minimal DOM). The actual chat panel renders on demand (user click).

**Recommendation (future):** If bundle size becomes a concern, wrap in `next/dynamic` with `ssr: false` to defer loading until first interaction.

### 3. No Dynamic Imports Used
Zero `next/dynamic` or `React.lazy` calls found in the codebase. All components are statically imported.

**Verdict:** Acceptable at current scale. Next.js App Router's automatic code-splitting by route provides sufficient isolation — each page loads only its own component tree.

### 4. Field Components — Not Code-Split
The 7 field renderer components (`currency-field.tsx`, `date-field.tsx`, etc.) are statically imported. They're small (<2 kB each) and only loaded on block detail pages.

**Verdict:** No action needed — too small to benefit from code splitting.

### 5. Middleware Size
- **Middleware:** 132 kB (Clerk auth middleware)

**Verdict:** Expected for Clerk. Runs at edge, not client-loaded.

### 6. Dead Code Removal Impact
Removed 39 unused shadcn UI components (~3000 lines). This reduces:
- Source tree clutter
- IDE indexing time
- Build trace collection time

Production bundle was unaffected (Next.js tree-shakes unused imports).

---

## Overall Assessment

| Metric | Value | Status |
|--------|-------|--------|
| Largest page | 176 kB (builder) | OK |
| Pages > 300 kB | 0 | PASS |
| Pages > 200 kB | 0 | PASS |
| Shared bundle | 102 kB | OK |
| Build time | 10.3s | OK |
| Static pages | 34 | OK |
| Dynamic imports | 0 | Acceptable |

**Overall: PASS** — No critical performance issues. The codebase is well within acceptable bundle sizes for a prototype-tier application. The builder page at 176 kB is the only watch item, driven by React Flow (expected for a canvas-based UI).

---

## Recommendations (Phase 3)
1. Lazy-load chat widget with `next/dynamic({ ssr: false })` if shared bundle grows
2. Consider code-splitting the workflow builder's node config panels
3. Add `@next/bundle-analyzer` for ongoing monitoring
4. Evaluate replacing Clerk's 54 kB shared chunk with lighter auth if bundle becomes a concern
