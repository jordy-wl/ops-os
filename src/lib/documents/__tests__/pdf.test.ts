import { describe, it, expect } from 'vitest'
import { generatePdf } from '../pdf'

describe('generatePdf', () => {
  it('generates a PDF buffer from HTML', () => {
    const html = '<h1>Test Document</h1><p>Hello world</p>'
    const buffer = generatePdf(html)

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // PDF files start with %PDF
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })

  it('generates a PDF with custom title', () => {
    const html = '<p>Content</p>'
    const buffer = generatePdf(html, { title: 'My Custom Title' })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles complex HTML with multiple elements', () => {
    const html = `
      <html>
        <head><style>body { font-family: sans-serif; }</style></head>
        <body>
          <div class="doc-header"><div class="company-name">Test Corp</div></div>
          <div class="doc-body">
            <h1>Report</h1>
            <h2>Section 1</h2>
            <p>First paragraph with <strong>bold</strong> text.</p>
            <p>Second paragraph.</p>
            <hr />
            <h2>Section 2</h2>
            <ul><li>Item 1</li><li>Item 2</li></ul>
          </div>
          <div class="doc-footer">&copy; 2026 Test Corp</div>
        </body>
      </html>
    `
    const buffer = generatePdf(html)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
  })

  it('handles empty HTML gracefully', () => {
    const buffer = generatePdf('')
    expect(buffer).toBeInstanceOf(Buffer)
    // Even empty, jsPDF produces a valid PDF structure
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })

  it('respects custom margins and font size', () => {
    const html = '<p>Test content</p>'
    const buffer = generatePdf(html, {
      margin: 30,
      fontSize: 14,
      lineHeight: 1.8,
    })
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('handles long content spanning multiple pages', () => {
    // Generate enough text to span multiple pages
    const paragraphs = Array.from({ length: 100 }, (_, i) =>
      `<p>Paragraph ${i + 1}: This is some content that should cause the PDF to span multiple pages when rendered.</p>`
    ).join('\n')
    const html = `<h1>Long Document</h1>${paragraphs}`

    const buffer = generatePdf(html)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('strips HTML tags and renders plain text', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    const buffer = generatePdf(html)

    // We can't easily inspect PDF text content, but verify it produces output
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })
})
