/**
 * Template Rendering Engine — P2-S9-BE-03
 *
 * Takes a document_template block + source block data + brand_kit → interpolates
 * variables, applies brand styling, outputs HTML.
 *
 * Supports both HTML and Markdown template_content (Markdown converted to HTML via `marked`).
 */

import { marked } from 'marked'

/* ---------- Types ---------- */

export interface TemplateBlock {
  id: string
  name: string
  metadata: {
    template_content: string
    variables?: Array<{ name: string; type: string; required?: boolean }>
    output_format?: 'pdf' | 'html' | 'markdown'
    category?: string
    [key: string]: unknown
  }
}

export interface SourceBlock {
  id: string
  name: string
  type: string
  state: string
  metadata: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface BrandKit {
  logo_url?: string
  primary_color: string
  secondary_color?: string
  font_family?: string
  header_style?: {
    background_color?: string
    text_color?: string
    show_logo?: boolean
  }
  footer_content?: string
  company_name: string
  tagline?: string
}

export interface RenderOptions {
  /** Extra variables to merge (overrides block-derived values) */
  extraVariables?: Record<string, string>
  /** Skip brand styling */
  noBrand?: boolean
}

export interface RenderResult {
  html: string
  missingVariables: string[]
}

/* ---------- Variable interpolation ---------- */

const VAR_REGEX = /\{\{(.+?)\}\}/g

/**
 * Build a flat variable map from a source block.
 * Supports: {{block.name}}, {{block.type}}, {{block.state}},
 * {{block.metadata.field}}, {{block.created_at}}, {{block.updated_at}}
 */
function buildVariableMap(
  source: SourceBlock,
  extra?: Record<string, string>
): Record<string, string> {
  const vars: Record<string, string> = {
    'block.id': source.id,
    'block.name': source.name,
    'block.type': source.type,
    'block.state': source.state,
  }

  if (source.created_at) vars['block.created_at'] = source.created_at
  if (source.updated_at) vars['block.updated_at'] = source.updated_at

  // Flatten metadata — supports {{block.metadata.jurisdiction}} etc.
  if (source.metadata) {
    for (const [key, value] of Object.entries(source.metadata)) {
      if (value !== null && value !== undefined) {
        vars[`block.metadata.${key}`] = String(value)
      }
    }
  }

  // Merge extra variables (overrides)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      vars[key] = value
    }
  }

  return vars
}

/**
 * Interpolate {{variable}} placeholders in content.
 * Returns the rendered string and a list of missing variables.
 */
function interpolate(
  content: string,
  variables: Record<string, string>
): { rendered: string; missing: string[] } {
  const missing: string[] = []

  const rendered = content.replace(VAR_REGEX, (match, varName: string) => {
    const trimmed = varName.trim()
    if (trimmed in variables) {
      return escapeHtml(variables[trimmed])
    }
    missing.push(trimmed)
    return match // Leave unresolved variables in place
  })

  return { rendered, missing: [...new Set(missing)] }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/* ---------- Markdown detection + conversion ---------- */

function isMarkdown(content: string): boolean {
  // Simple heuristic: if it contains markdown-specific syntax
  return /^#{1,6}\s|^\*\*|\*\*\w|^-\s|\[.+\]\(.+\)|^```/m.test(content)
}

function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string
}

/* ---------- Brand styling ---------- */

function buildBrandCss(brand: BrandKit): string {
  const headerBg = brand.header_style?.background_color ?? brand.primary_color
  const headerText = brand.header_style?.text_color ?? '#ffffff'
  const fontFamily = brand.font_family ?? 'Inter, Helvetica, Arial, sans-serif'

  return `
    body {
      font-family: ${fontFamily};
      color: #1a1a1a;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .doc-header {
      background-color: ${headerBg};
      color: ${headerText};
      padding: 24px 40px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .doc-header img {
      max-height: 48px;
      width: auto;
    }
    .doc-header .company-name {
      font-size: 20px;
      font-weight: 600;
    }
    .doc-header .tagline {
      font-size: 13px;
      opacity: 0.85;
    }
    .doc-body {
      padding: 40px;
      max-width: 800px;
    }
    .doc-body h1, .doc-body h2, .doc-body h3 {
      color: ${brand.primary_color};
    }
    .doc-body a {
      color: ${brand.secondary_color ?? brand.primary_color};
    }
    .doc-footer {
      border-top: 1px solid #e5e7eb;
      padding: 20px 40px;
      font-size: 12px;
      color: #6b7280;
    }
    @media print {
      .doc-header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  `
}

function buildBrandHeader(brand: BrandKit): string {
  const showLogo = brand.header_style?.show_logo !== false && brand.logo_url
  return `
    <div class="doc-header">
      ${showLogo ? `<img src="${escapeHtml(brand.logo_url!)}" alt="${escapeHtml(brand.company_name)} logo" />` : ''}
      <div>
        <div class="company-name">${escapeHtml(brand.company_name)}</div>
        ${brand.tagline ? `<div class="tagline">${escapeHtml(brand.tagline)}</div>` : ''}
      </div>
    </div>
  `
}

function buildBrandFooter(brand: BrandKit): string {
  if (!brand.footer_content) {
    return `<div class="doc-footer">&copy; ${new Date().getFullYear()} ${escapeHtml(brand.company_name)}</div>`
  }
  return `<div class="doc-footer">${brand.footer_content}</div>`
}

/* ---------- Main render function ---------- */

/**
 * Render a document from a template block, source block data, and optional brand kit.
 *
 * @param template - The document_template block
 * @param source - The source block providing data for variable interpolation
 * @param brandKit - Optional brand kit for styling
 * @param options - Additional render options
 * @returns RenderResult with HTML output and list of missing variables
 */
export function renderDocument(
  template: TemplateBlock,
  source: SourceBlock,
  brandKit?: BrandKit | null,
  options?: RenderOptions
): RenderResult {
  const { template_content } = template.metadata
  if (!template_content) {
    return { html: '', missingVariables: [] }
  }

  // Build variable map from source block + extras
  const variables = buildVariableMap(source, options?.extraVariables)

  // Add brand variables
  if (brandKit && !options?.noBrand) {
    variables['brand.company_name'] = brandKit.company_name
    if (brandKit.tagline) variables['brand.tagline'] = brandKit.tagline
    if (brandKit.primary_color) variables['brand.primary_color'] = brandKit.primary_color
  }

  // Interpolate variables
  const { rendered: interpolated, missing } = interpolate(template_content, variables)

  // Convert markdown to HTML if needed
  let bodyHtml: string
  if (isMarkdown(interpolated)) {
    bodyHtml = markdownToHtml(interpolated)
  } else {
    bodyHtml = interpolated
  }

  // Build full document with brand styling
  if (brandKit && !options?.noBrand) {
    const css = buildBrandCss(brandKit)
    const header = buildBrandHeader(brandKit)
    const footer = buildBrandFooter(brandKit)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(template.name)}</title>
  <style>${css}</style>
</head>
<body>
  ${header}
  <div class="doc-body">${bodyHtml}</div>
  ${footer}
</body>
</html>`

    return { html, missingVariables: missing }
  }

  // No brand — return simple HTML wrapper
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(template.name)}</title>
  <style>
    body { font-family: Inter, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`

  return { html, missingVariables: missing }
}

/* ---------- Exports for testing ---------- */
export { buildVariableMap, interpolate, isMarkdown, markdownToHtml, escapeHtml }
