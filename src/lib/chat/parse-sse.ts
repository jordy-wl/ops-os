/**
 * SSE chunk types emitted by POST /api/ai/chat.
 *
 * The chat route streams Server-Sent Events in the format:
 *   data: {"text": "..."}\n\n        — token chunk
 *   data: [DONE]\n\n                 — stream end sentinel
 *   data: {"error": "..."}\n\n       — error mid-stream
 *   data: {"suggestions": [...]}\n\n  — discuss mode action suggestions
 *   data: {"plan_data": {...}}\n\n    — plan mode structured plan data
 */
export type ToolCallChunk = {
  name: string
  input: unknown
  result: { success: boolean; data?: unknown; error?: string }
}

export type ActionSuggestion = {
  label: string
  action: string
  blockId?: string
  params?: Record<string, unknown>
}

export type PlanData = {
  title: string
  steps: Array<{
    index: number
    description: string
    actionType?: string | null
    blockType?: string
  }>
  prerequisites: string[]
  complexity: string
}

export type SseChunk =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'tool_call'; tool_call: ToolCallChunk }
  | { type: 'suggestions'; suggestions: ActionSuggestion[] }
  | { type: 'plan_data'; plan_data: PlanData }

/**
 * parseSseChunk — parses a raw SSE string into typed chunk objects.
 *
 * Handles partial delivery: a single `ReadableStream.read()` call may contain
 * multiple data lines or lines without the terminating newline. Each `data: `
 * line is parsed independently; malformed JSON is silently skipped.
 *
 * @param raw - Raw bytes decoded to string from the ReadableStream reader
 * @returns Array of parsed SseChunk objects (may be empty if no data lines present)
 */
export function parseSseChunk(raw: string): SseChunk[] {
  const results: SseChunk[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd()
    if (!trimmed.startsWith('data: ')) continue

    const payload = trimmed.slice(6) // strip "data: " prefix

    if (payload === '[DONE]') {
      results.push({ type: 'done' })
      continue
    }

    try {
      const parsed: unknown = JSON.parse(payload)
      if (parsed === null || typeof parsed !== 'object') continue

      const obj = parsed as Record<string, unknown>

      if ('text' in obj && typeof obj.text === 'string') {
        results.push({ type: 'text', text: obj.text })
      } else if ('error' in obj && typeof obj.error === 'string') {
        results.push({ type: 'error', message: obj.error })
      } else if ('tool_call' in obj && typeof obj.tool_call === 'object') {
        results.push({
          type: 'tool_call',
          tool_call: obj.tool_call as ToolCallChunk,
        })
      } else if ('suggestions' in obj && Array.isArray(obj.suggestions)) {
        results.push({
          type: 'suggestions',
          suggestions: obj.suggestions as ActionSuggestion[],
        })
      } else if ('plan_data' in obj && typeof obj.plan_data === 'object') {
        results.push({
          type: 'plan_data',
          plan_data: obj.plan_data as PlanData,
        })
      }
    } catch {
      // Malformed JSON — skip silently (partial chunk edge case)
    }
  }

  return results
}

/**
 * Strip structured tag blocks (<SUGGESTIONS>, <PLAN_JSON>) from visible message content.
 * These blocks are parsed server-side and emitted as separate SSE events,
 * but they may also appear in the streamed text content.
 */
export function stripStructuredTags(content: string): string {
  return content
    .replace(/<SUGGESTIONS>[\s\S]*?<\/SUGGESTIONS>/g, '')
    .replace(/<PLAN_JSON>[\s\S]*?<\/PLAN_JSON>/g, '')
    .trim()
}
