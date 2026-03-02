import { describe, it, expect } from 'vitest'
import { parseSseChunk } from '@/lib/chat/parse-sse'

describe('parseSseChunk', () => {
  describe('text chunks', () => {
    it('parses a single text chunk', () => {
      const result = parseSseChunk('data: {"text":"Hello"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'Hello' }])
    })

    it('parses multiple text chunks in one read', () => {
      const result = parseSseChunk(
        'data: {"text":"Hello"}\n\ndata: {"text":" world"}\n\n'
      )
      expect(result).toEqual([
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ])
    })

    it('handles empty string text chunk', () => {
      const result = parseSseChunk('data: {"text":""}\n\n')
      expect(result).toEqual([{ type: 'text', text: '' }])
    })

    it('handles text with special characters', () => {
      const result = parseSseChunk('data: {"text":"line1\\nline2"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'line1\nline2' }])
    })
  })

  describe('done sentinel', () => {
    it('parses [DONE] sentinel', () => {
      const result = parseSseChunk('data: [DONE]\n\n')
      expect(result).toEqual([{ type: 'done' }])
    })

    it('parses text chunk followed by [DONE]', () => {
      const result = parseSseChunk('data: {"text":"last token"}\n\ndata: [DONE]\n\n')
      expect(result).toEqual([
        { type: 'text', text: 'last token' },
        { type: 'done' },
      ])
    })
  })

  describe('error chunks', () => {
    it('parses an error chunk', () => {
      const result = parseSseChunk(
        'data: {"error":"AI service temporarily unavailable"}\n\n'
      )
      expect(result).toEqual([
        { type: 'error', message: 'AI service temporarily unavailable' },
      ])
    })
  })

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseSseChunk('')).toEqual([])
    })

    it('returns empty array for non-data lines (comments, keep-alive)', () => {
      expect(parseSseChunk(': keep-alive\n\n')).toEqual([])
      expect(parseSseChunk('\n\n')).toEqual([])
    })

    it('skips malformed JSON without throwing', () => {
      const result = parseSseChunk('data: {bad json}\n\ndata: {"text":"ok"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'ok' }])
    })

    it('skips unknown JSON shapes', () => {
      // Valid JSON but neither text nor error shape
      const result = parseSseChunk('data: {"unknown": true}\n\n')
      expect(result).toEqual([])
    })

    it('handles a raw string without trailing newline (partial chunk)', () => {
      // Simulates a partial read where the chunk ends mid-line — no data: lines match
      const result = parseSseChunk('data: {"text":"partial')
      // The line is incomplete — JSON parse will fail — no result
      expect(result).toEqual([])
    })

    it('trims trailing carriage return from Windows-style line endings', () => {
      const result = parseSseChunk('data: {"text":"hello"}\r\n\r\n')
      expect(result).toEqual([{ type: 'text', text: 'hello' }])
    })
  })
})
