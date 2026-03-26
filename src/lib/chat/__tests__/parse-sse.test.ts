import { describe, it, expect } from 'vitest'
import { parseSseChunk, stripStructuredTags } from '@/lib/chat/parse-sse'

describe('parseSseChunk', () => {
  // ── 1. Text chunks ──────────────────────────────────────────────────────

  describe('text chunks', () => {
    it('parses a single text chunk', () => {
      const result = parseSseChunk('data: {"text":"hello"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'hello' }])
    })

    it('parses text with spaces and punctuation', () => {
      const result = parseSseChunk('data: {"text":"Hello, world!"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'Hello, world!' }])
    })

    it('handles empty string text chunk', () => {
      const result = parseSseChunk('data: {"text":""}\n\n')
      expect(result).toEqual([{ type: 'text', text: '' }])
    })

    it('handles text with escaped special characters', () => {
      const result = parseSseChunk('data: {"text":"line1\\nline2\\ttab"}\n\n')
      expect(result).toEqual([{ type: 'text', text: 'line1\nline2\ttab' }])
    })
  })

  // ── 2. Done sentinel ───────────────────────────────────────────────────

  describe('done sentinel', () => {
    it('parses [DONE] sentinel', () => {
      const result = parseSseChunk('data: [DONE]\n\n')
      expect(result).toEqual([{ type: 'done' }])
    })

    it('parses text chunk followed by [DONE]', () => {
      const result = parseSseChunk(
        'data: {"text":"last token"}\n\ndata: [DONE]\n\n'
      )
      expect(result).toEqual([
        { type: 'text', text: 'last token' },
        { type: 'done' },
      ])
    })
  })

  // ── 3. Error events ────────────────────────────────────────────────────

  describe('error events', () => {
    it('parses an error event', () => {
      const result = parseSseChunk(
        'data: {"error":"something went wrong"}\n\n'
      )
      expect(result).toEqual([
        { type: 'error', message: 'something went wrong' },
      ])
    })

    it('error message content matches the payload', () => {
      const result = parseSseChunk(
        'data: {"error":"AI service temporarily unavailable"}\n\n'
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'error',
        message: 'AI service temporarily unavailable',
      })
    })
  })

  // ── 4. Tool call events ────────────────────────────────────────────────

  describe('tool call events', () => {
    it('parses a tool_call event', () => {
      const payload = JSON.stringify({
        tool_call: {
          name: 'create_block',
          input: {},
          result: { success: true },
        },
      })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toEqual([
        {
          type: 'tool_call',
          tool_call: {
            name: 'create_block',
            input: {},
            result: { success: true },
          },
        },
      ])
    })

    it('preserves tool_call input and result data', () => {
      const payload = JSON.stringify({
        tool_call: {
          name: 'search_blocks',
          input: { query: 'Acme' },
          result: { success: true, data: { blocks: [{ id: 'b1' }] } },
        },
      })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toHaveLength(1)
      const chunk = result[0]
      expect(chunk.type).toBe('tool_call')
      if (chunk.type === 'tool_call') {
        expect(chunk.tool_call.name).toBe('search_blocks')
        expect(chunk.tool_call.input).toEqual({ query: 'Acme' })
        expect(chunk.tool_call.result.success).toBe(true)
      }
    })

    it('parses text followed by tool_call', () => {
      const toolPayload = JSON.stringify({
        tool_call: {
          name: 'create_block',
          input: { name: 'Test', type: 'client' },
          result: { success: true, data: { block_id: 'b1' } },
        },
      })
      const raw = `data: {"text":"Let me create that."}\n\ndata: ${toolPayload}\n\n`
      const result = parseSseChunk(raw)
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('text')
      expect(result[1].type).toBe('tool_call')
    })
  })

  // ── 5. Suggestion events ───────────────────────────────────────────────

  describe('suggestion events', () => {
    it('parses a suggestions event', () => {
      const payload = JSON.stringify({
        suggestions: [
          { label: 'Do X', action: 'do_x' },
        ],
      })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toEqual([
        {
          type: 'suggestions',
          suggestions: [{ label: 'Do X', action: 'do_x' }],
        },
      ])
    })

    it('parses suggestions with optional fields', () => {
      const payload = JSON.stringify({
        suggestions: [
          { label: 'View Client', action: 'navigate', blockId: 'b1', params: { tab: 'overview' } },
          { label: 'Create Deal', action: 'create_block' },
        ],
      })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toHaveLength(1)
      if (result[0].type === 'suggestions') {
        expect(result[0].suggestions).toHaveLength(2)
        expect(result[0].suggestions[0].blockId).toBe('b1')
        expect(result[0].suggestions[1].blockId).toBeUndefined()
      }
    })
  })

  // ── 6. Plan data events ────────────────────────────────────────────────

  describe('plan data events', () => {
    it('parses a plan_data event', () => {
      const planData = {
        title: 'My Plan',
        steps: [],
        prerequisites: [],
        complexity: 'low',
      }
      const payload = JSON.stringify({ plan_data: planData })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toEqual([
        {
          type: 'plan_data',
          plan_data: {
            title: 'My Plan',
            steps: [],
            prerequisites: [],
            complexity: 'low',
          },
        },
      ])
    })

    it('parses plan_data with populated steps', () => {
      const planData = {
        title: 'Onboarding Plan',
        steps: [
          { index: 0, description: 'Create client block', actionType: 'create_block', blockType: 'client' },
          { index: 1, description: 'Add contacts', actionType: null },
        ],
        prerequisites: ['Client name required'],
        complexity: 'medium',
      }
      const payload = JSON.stringify({ plan_data: planData })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toHaveLength(1)
      if (result[0].type === 'plan_data') {
        expect(result[0].plan_data.steps).toHaveLength(2)
        expect(result[0].plan_data.prerequisites).toEqual(['Client name required'])
      }
    })
  })

  // ── 6b. Action preview events ─────────────────────────────────────────

  describe('action preview events', () => {
    it('parses an action_preview event', () => {
      const actions = [
        { id: 'a1', toolName: 'create_block', input: { name: 'Acme' }, description: 'Create client Acme', riskLevel: 'medium' },
      ]
      const payload = JSON.stringify({ action_preview: actions })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toEqual([
        { type: 'action_preview', actions },
      ])
    })

    it('parses action_preview with multiple actions', () => {
      const actions = [
        { id: 'a1', toolName: 'create_block', input: { name: 'Acme' }, description: 'Create Acme', riskLevel: 'medium' },
        { id: 'a2', toolName: 'update_block', input: { id: 'b1' }, description: 'Update block', riskLevel: 'high' },
      ]
      const payload = JSON.stringify({ action_preview: actions })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toHaveLength(1)
      if (result[0].type === 'action_preview') {
        expect(result[0].actions).toHaveLength(2)
        expect(result[0].actions[0].riskLevel).toBe('medium')
        expect(result[0].actions[1].riskLevel).toBe('high')
      }
    })
  })

  // ── 6c. Mode suggestion events ──────────────────────────────────────────

  describe('mode suggestion events', () => {
    it('parses a mode_suggestion event', () => {
      const suggestion = { suggested_mode: 'plan', reason: 'You seem ready to plan' }
      const payload = JSON.stringify({ mode_suggestion: suggestion })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toEqual([
        { type: 'mode_suggestion', mode_suggestion: suggestion },
      ])
    })

    it('parses mode_suggestion for execute transition', () => {
      const suggestion = { suggested_mode: 'execute', reason: 'Plan accepted' }
      const payload = JSON.stringify({ mode_suggestion: suggestion })
      const result = parseSseChunk(`data: ${payload}\n\n`)
      expect(result).toHaveLength(1)
      if (result[0].type === 'mode_suggestion') {
        expect(result[0].mode_suggestion.suggested_mode).toBe('execute')
      }
    })
  })

  // ── 7. Multiple data lines in one chunk ────────────────────────────────

  describe('multiple data lines in one chunk', () => {
    it('parses multiple data lines separated by newlines', () => {
      const raw = [
        'data: {"text":"Hello"}',
        'data: {"text":" world"}',
        'data: [DONE]',
      ].join('\n')
      const result = parseSseChunk(raw)
      expect(result).toEqual([
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
        { type: 'done' },
      ])
    })

    it('parses mixed chunk types in one raw string', () => {
      const toolPayload = JSON.stringify({
        tool_call: { name: 'search', input: {}, result: { success: true } },
      })
      const raw = [
        'data: {"text":"Searching..."}',
        `data: ${toolPayload}`,
        'data: {"text":"Found 3 results."}',
        'data: [DONE]',
      ].join('\n')
      const result = parseSseChunk(raw)
      expect(result).toHaveLength(4)
      expect(result[0].type).toBe('text')
      expect(result[1].type).toBe('tool_call')
      expect(result[2].type).toBe('text')
      expect(result[3].type).toBe('done')
    })
  })

  // ── 8. Malformed JSON ──────────────────────────────────────────────────

  describe('malformed JSON', () => {
    it('silently skips malformed JSON and returns empty result', () => {
      const result = parseSseChunk('data: {invalid json}\n\n')
      expect(result).toEqual([])
    })

    it('skips malformed JSON but continues parsing subsequent valid lines', () => {
      const raw = 'data: {bad json}\n\ndata: {"text":"ok"}\n\n'
      const result = parseSseChunk(raw)
      expect(result).toEqual([{ type: 'text', text: 'ok' }])
    })

    it('skips a partial/truncated JSON payload', () => {
      const result = parseSseChunk('data: {"text":"partial')
      expect(result).toEqual([])
    })
  })

  // ── 9. Partial chunks — lines without data: prefix ─────────────────────

  describe('partial chunks (no data: prefix)', () => {
    it('ignores lines without data: prefix', () => {
      expect(parseSseChunk('')).toEqual([])
      expect(parseSseChunk('\n\n')).toEqual([])
    })

    it('ignores SSE comments (lines starting with colon)', () => {
      expect(parseSseChunk(': keep-alive\n\n')).toEqual([])
    })

    it('ignores random text lines mixed with valid data', () => {
      const raw = 'some random line\ndata: {"text":"valid"}\nanother random line\n'
      const result = parseSseChunk(raw)
      expect(result).toEqual([{ type: 'text', text: 'valid' }])
    })

    it('trims trailing carriage return from Windows-style line endings', () => {
      const result = parseSseChunk('data: {"text":"hello"}\r\n\r\n')
      expect(result).toEqual([{ type: 'text', text: 'hello' }])
    })
  })

  // ── 10. Unknown JSON keys ──────────────────────────────────────────────

  describe('unknown JSON keys', () => {
    it('silently drops objects with unrecognized keys', () => {
      const result = parseSseChunk('data: {"unknown_key": true}\n\n')
      expect(result).toEqual([])
    })

    it('drops objects that are valid JSON but have no matching shape', () => {
      const result = parseSseChunk('data: {"foo": 1, "bar": "baz"}\n\n')
      expect(result).toEqual([])
    })

    it('drops JSON arrays (not objects)', () => {
      const result = parseSseChunk('data: [1, 2, 3]\n\n')
      expect(result).toEqual([])
    })

    it('drops JSON primitives (null)', () => {
      const result = parseSseChunk('data: null\n\n')
      expect(result).toEqual([])
    })

    it('drops JSON primitives (number)', () => {
      const result = parseSseChunk('data: 42\n\n')
      expect(result).toEqual([])
    })
  })
})

// ── stripStructuredTags ─────────────────────────────────────────────────────

describe('stripStructuredTags', () => {
  it('removes SUGGESTIONS block', () => {
    const input = 'Hello <SUGGESTIONS>["do this"]</SUGGESTIONS> world'
    expect(stripStructuredTags(input)).toBe('Hello  world')
  })

  it('removes PLAN_JSON block', () => {
    const input = 'Here is a plan <PLAN_JSON>{"title":"test"}</PLAN_JSON> done'
    expect(stripStructuredTags(input)).toBe('Here is a plan  done')
  })

  it('removes both SUGGESTIONS and PLAN_JSON blocks', () => {
    const input =
      'Start <SUGGESTIONS>[{"label":"X"}]</SUGGESTIONS> middle <PLAN_JSON>{"title":"Y"}</PLAN_JSON> end'
    expect(stripStructuredTags(input)).toBe('Start  middle  end')
  })

  it('removes MODE_SUGGESTION block', () => {
    const input = 'Ready to plan? <MODE_SUGGESTION>{"suggested_mode":"plan","reason":"test"}</MODE_SUGGESTION> done'
    expect(stripStructuredTags(input)).toBe('Ready to plan?  done')
  })

  it('removes multiline MODE_SUGGESTION block', () => {
    const input = `Text before
<MODE_SUGGESTION>
{"suggested_mode": "execute", "reason": "Plan accepted"}
</MODE_SUGGESTION>
Text after`
    expect(stripStructuredTags(input)).toBe('Text before\n\nText after')
  })

  it('removes multiline SUGGESTIONS block', () => {
    const input = `Some text
<SUGGESTIONS>
[{"label": "Do something", "action": "do_it"}]
</SUGGESTIONS>
More text`
    expect(stripStructuredTags(input)).toBe('Some text\n\nMore text')
  })

  it('removes multiline PLAN_JSON block', () => {
    const input = `Planning...
<PLAN_JSON>
{
  "title": "My Plan",
  "steps": [],
  "prerequisites": [],
  "complexity": "low"
}
</PLAN_JSON>
Done planning.`
    expect(stripStructuredTags(input)).toBe('Planning...\n\nDone planning.')
  })

  it('trims leading and trailing whitespace from result', () => {
    const input = '   <SUGGESTIONS>data</SUGGESTIONS>   '
    expect(stripStructuredTags(input)).toBe('')
  })

  it('returns content unchanged when no structured tags present', () => {
    const input = 'Just a normal message with no tags.'
    expect(stripStructuredTags(input)).toBe('Just a normal message with no tags.')
  })

  it('handles empty string', () => {
    expect(stripStructuredTags('')).toBe('')
  })
})
