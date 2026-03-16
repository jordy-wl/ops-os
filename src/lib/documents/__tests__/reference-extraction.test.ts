import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { extractTemplateStructure, extractTextFromHtml } from '../reference-extraction'

describe('extractTemplateStructure', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses valid AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          structure_description: 'A formal contract with header, terms, and signature block',
          detected_variables: [
            { name: 'client_name', type: 'string', description: 'Client company name' },
            { name: 'contract_date', type: 'date', description: 'Date of agreement' },
          ],
          suggested_category: 'contract',
        }),
      }],
      usage: { output_tokens: 150 },
    })

    const result = await extractTemplateStructure('Some document content', 'contract.html', 'text/html')

    expect(result.structureDescription).toBe('A formal contract with header, terms, and signature block')
    expect(result.detectedVariables).toHaveLength(2)
    expect(result.detectedVariables[0].name).toBe('client_name')
    expect(result.suggestedCategory).toBe('contract')
  })

  it('handles markdown code blocks in AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n{"structure_description":"Test","detected_variables":[],"suggested_category":"report"}\n```',
      }],
      usage: { output_tokens: 50 },
    })

    const result = await extractTemplateStructure('Content', 'report.md', 'text/markdown')
    expect(result.structureDescription).toBe('Test')
    expect(result.suggestedCategory).toBe('report')
  })

  it('returns defaults on AI failure', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const result = await extractTemplateStructure('Content', 'doc.html', 'text/html')

    expect(result.structureDescription).toBe('Uploaded reference document: doc.html')
    expect(result.detectedVariables).toEqual([])
    expect(result.suggestedCategory).toBe('other')
  })

  it('returns defaults when AI returns no text', async () => {
    mockCreate.mockResolvedValue({
      content: [],
      usage: { output_tokens: 0 },
    })

    const result = await extractTemplateStructure('Content', 'empty.html', 'text/html')
    expect(result.structureDescription).toBe('Uploaded reference document: empty.html')
  })

  it('handles missing fields in AI response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({ structure_description: 'Minimal response' }),
      }],
      usage: { output_tokens: 30 },
    })

    const result = await extractTemplateStructure('Content', 'test.txt', 'text/plain')
    expect(result.structureDescription).toBe('Minimal response')
    expect(result.detectedVariables).toEqual([])
    expect(result.suggestedCategory).toBe('other')
  })

  it('truncates content to 15000 chars', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          structure_description: 'Long doc',
          detected_variables: [],
          suggested_category: 'report',
        }),
      }],
      usage: { output_tokens: 40 },
    })

    const longContent = 'x'.repeat(20000)
    await extractTemplateStructure(longContent, 'big.txt', 'text/plain')

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content.length).toBeLessThan(16000)
  })
})

describe('extractTextFromHtml', () => {
  it('strips HTML tags', () => {
    const result = extractTextFromHtml('<p>Hello <strong>world</strong></p>')
    expect(result).toContain('Hello')
    expect(result).toContain('world')
    expect(result).not.toContain('<strong>')
  })

  it('removes style blocks', () => {
    const result = extractTextFromHtml('<style>body { color: red; }</style><p>Content</p>')
    expect(result).not.toContain('color')
    expect(result).toContain('Content')
  })

  it('removes script blocks', () => {
    const result = extractTextFromHtml('<script>alert("hi")</script><p>Safe</p>')
    expect(result).not.toContain('alert')
    expect(result).toContain('Safe')
  })

  it('decodes HTML entities', () => {
    const result = extractTextFromHtml('<p>&amp; &lt; &gt; &quot; &#x27;</p>')
    expect(result).toContain('&')
    expect(result).toContain('<')
    expect(result).toContain('>')
    expect(result).toContain('"')
    expect(result).toContain("'")
  })

  it('converts block elements to newlines', () => {
    const result = extractTextFromHtml('<h1>Title</h1><p>Paragraph</p>')
    expect(result).toContain('Title')
    expect(result).toContain('Paragraph')
  })

  it('handles empty input', () => {
    expect(extractTextFromHtml('')).toBe('')
  })
})
