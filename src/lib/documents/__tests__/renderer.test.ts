import { describe, it, expect } from 'vitest'
import {
  renderDocument,
  buildVariableMap,
  interpolate,
  isMarkdown,
  markdownToHtml,
  escapeHtml,
} from '../renderer'
import type { TemplateBlock, SourceBlock, BrandKit } from '../renderer'

/* ---------- Fixtures ---------- */

const sourceBlock: SourceBlock = {
  id: 'block-1',
  name: 'Thornfield Capital Partners',
  type: 'client',
  state: 'active',
  metadata: {
    jurisdiction: 'AU',
    entity_type: 'company',
    aum: '£450M',
  },
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
}

const brandKit: BrandKit = {
  company_name: 'Ops OS Demo Corp',
  tagline: 'Operational Excellence',
  primary_color: '#1a2b3c',
  secondary_color: '#4a5b6c',
  font_family: 'Georgia, serif',
  logo_url: 'https://example.com/logo.png',
  header_style: {
    background_color: '#0a1b2c',
    text_color: '#f0f0f0',
    show_logo: true,
  },
  footer_content: '&copy; 2026 Ops OS Demo Corp. All rights reserved.',
}

function makeTemplate(content: string): TemplateBlock {
  return {
    id: 'tmpl-1',
    name: 'Test Template',
    metadata: {
      template_content: content,
      variables: [],
    },
  }
}

/* ---------- escapeHtml ---------- */

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#x27;s')
  })
})

/* ---------- buildVariableMap ---------- */

describe('buildVariableMap', () => {
  it('maps all block fields', () => {
    const vars = buildVariableMap(sourceBlock)
    expect(vars['block.id']).toBe('block-1')
    expect(vars['block.name']).toBe('Thornfield Capital Partners')
    expect(vars['block.type']).toBe('client')
    expect(vars['block.state']).toBe('active')
    expect(vars['block.created_at']).toBe('2026-01-15T00:00:00Z')
    expect(vars['block.updated_at']).toBe('2026-03-10T00:00:00Z')
  })

  it('flattens metadata to block.metadata.* keys', () => {
    const vars = buildVariableMap(sourceBlock)
    expect(vars['block.metadata.jurisdiction']).toBe('AU')
    expect(vars['block.metadata.entity_type']).toBe('company')
    expect(vars['block.metadata.aum']).toBe('£450M')
  })

  it('ignores null/undefined metadata values', () => {
    const block = { ...sourceBlock, metadata: { a: null, b: undefined, c: 'ok' } }
    const vars = buildVariableMap(block as unknown as SourceBlock)
    expect(vars['block.metadata.a']).toBeUndefined()
    expect(vars['block.metadata.b']).toBeUndefined()
    expect(vars['block.metadata.c']).toBe('ok')
  })

  it('merges extra variables (overrides block values)', () => {
    const vars = buildVariableMap(sourceBlock, { 'block.name': 'Override', custom: 'value' })
    expect(vars['block.name']).toBe('Override')
    expect(vars['custom']).toBe('value')
  })
})

/* ---------- interpolate ---------- */

describe('interpolate', () => {
  it('replaces known variables', () => {
    const { rendered, missing } = interpolate(
      'Hello {{name}}, you are {{age}} years old.',
      { name: 'Alice', age: '30' }
    )
    expect(rendered).toBe('Hello Alice, you are 30 years old.')
    expect(missing).toEqual([])
  })

  it('tracks missing variables', () => {
    const { rendered, missing } = interpolate(
      'Hello {{name}}, your role is {{role}}.',
      { name: 'Bob' }
    )
    expect(rendered).toContain('{{role}}')
    expect(missing).toEqual(['role'])
  })

  it('deduplicates missing variables', () => {
    const { missing } = interpolate('{{x}} and {{x}}', {})
    expect(missing).toEqual(['x'])
  })

  it('escapes HTML in variable values', () => {
    const { rendered } = interpolate('Name: {{name}}', { name: '<b>Bold</b>' })
    expect(rendered).toBe('Name: &lt;b&gt;Bold&lt;/b&gt;')
  })

  it('handles variables with whitespace in braces', () => {
    const { rendered } = interpolate('Hello {{ name }}', { name: 'Alice' })
    expect(rendered).toBe('Hello Alice')
  })
})

/* ---------- isMarkdown ---------- */

describe('isMarkdown', () => {
  it('detects heading syntax', () => {
    expect(isMarkdown('# Hello')).toBe(true)
    expect(isMarkdown('## Subheading')).toBe(true)
  })

  it('detects bold syntax', () => {
    expect(isMarkdown('This is **bold** text')).toBe(true)
  })

  it('detects list syntax', () => {
    expect(isMarkdown('- Item one\n- Item two')).toBe(true)
  })

  it('detects link syntax', () => {
    expect(isMarkdown('[link](https://example.com)')).toBe(true)
  })

  it('detects code block syntax', () => {
    expect(isMarkdown('```\ncode\n```')).toBe(true)
  })

  it('returns false for plain HTML', () => {
    expect(isMarkdown('<div>Hello</div>')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(isMarkdown('Just some plain text.')).toBe(false)
  })
})

/* ---------- markdownToHtml ---------- */

describe('markdownToHtml', () => {
  it('converts headings', () => {
    const html = markdownToHtml('# Title\n\nParagraph')
    expect(html).toContain('<h1>')
    expect(html).toContain('Title')
    expect(html).toContain('<p>')
  })

  it('converts bold text', () => {
    const html = markdownToHtml('This is **bold**.')
    expect(html).toContain('<strong>bold</strong>')
  })
})

/* ---------- renderDocument ---------- */

describe('renderDocument', () => {
  it('renders HTML template with variable interpolation', () => {
    const template = makeTemplate('<h1>{{block.name}}</h1><p>Jurisdiction: {{block.metadata.jurisdiction}}</p>')
    const result = renderDocument(template, sourceBlock)

    expect(result.html).toContain('Thornfield Capital Partners')
    expect(result.html).toContain('AU')
    expect(result.missingVariables).toEqual([])
  })

  it('renders Markdown template as HTML', () => {
    const template = makeTemplate('# Report for {{block.name}}\n\n**Type:** {{block.type}}')
    const result = renderDocument(template, sourceBlock)

    expect(result.html).toContain('<h1>')
    expect(result.html).toContain('Thornfield Capital Partners')
    expect(result.html).toContain('<strong>Type:</strong>')
    expect(result.missingVariables).toEqual([])
  })

  it('tracks missing variables', () => {
    const template = makeTemplate('Name: {{block.name}}, Missing: {{block.metadata.nonexistent}}')
    const result = renderDocument(template, sourceBlock)

    expect(result.html).toContain('Thornfield Capital Partners')
    expect(result.missingVariables).toEqual(['block.metadata.nonexistent'])
  })

  it('applies brand styling when brand kit provided', () => {
    const template = makeTemplate('<p>Hello {{block.name}}</p>')
    const result = renderDocument(template, sourceBlock, brandKit)

    // Check brand CSS is injected
    expect(result.html).toContain('#1a2b3c') // primary color
    expect(result.html).toContain('Georgia, serif') // font
    expect(result.html).toContain('doc-header')
    expect(result.html).toContain('doc-footer')
    expect(result.html).toContain('Ops OS Demo Corp') // company name
    expect(result.html).toContain('Operational Excellence') // tagline
    expect(result.html).toContain('logo.png') // logo
  })

  it('includes brand variables in interpolation', () => {
    const template = makeTemplate('Company: {{brand.company_name}}, Tagline: {{brand.tagline}}')
    const result = renderDocument(template, sourceBlock, brandKit)

    expect(result.html).toContain('Ops OS Demo Corp')
    expect(result.html).toContain('Operational Excellence')
  })

  it('renders without brand when noBrand option is set', () => {
    const template = makeTemplate('<p>Test</p>')
    const result = renderDocument(template, sourceBlock, brandKit, { noBrand: true })

    expect(result.html).not.toContain('doc-header')
    expect(result.html).not.toContain('doc-footer')
  })

  it('renders without brand when brandKit is null', () => {
    const template = makeTemplate('<p>Test</p>')
    const result = renderDocument(template, sourceBlock, null)

    expect(result.html).toContain('<p>Test</p>')
    expect(result.html).not.toContain('doc-header')
  })

  it('returns empty HTML for empty template_content', () => {
    const template: TemplateBlock = {
      id: 'tmpl-empty',
      name: 'Empty',
      metadata: { template_content: '' },
    }
    const result = renderDocument(template, sourceBlock)
    expect(result.html).toBe('')
  })

  it('merges extra variables from options', () => {
    const template = makeTemplate('{{custom_field}}')
    const result = renderDocument(template, sourceBlock, null, {
      extraVariables: { custom_field: 'Custom Value' },
    })
    expect(result.html).toContain('Custom Value')
  })

  it('wraps output in a full HTML document', () => {
    const template = makeTemplate('<p>Content</p>')
    const result = renderDocument(template, sourceBlock)

    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('<html')
    expect(result.html).toContain('</html>')
    expect(result.html).toContain('<title>Test Template</title>')
  })

  it('escapes template name in title', () => {
    const template: TemplateBlock = {
      id: 'tmpl-xss',
      name: '<script>alert("xss")</script>',
      metadata: { template_content: '<p>Hello</p>' },
    }
    const result = renderDocument(template, sourceBlock)
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })
})
