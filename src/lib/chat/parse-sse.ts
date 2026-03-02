/**
 * SSE chunk types emitted by POST /api/ai/chat.
 *
 * The chat route streams Server-Sent Events in the format:
 *   data: {"text": "..."}\n\n   — token chunk
 *   data: [DONE]\n\n            — stream end sentinel
 *   data: {"error": "..."}\n\n  — error mid-stream
 */
export type SseChunk =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

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
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'text' in parsed &&
        typeof (parsed as Record<string, unknown>).text === 'string'
      ) {
        results.push({ type: 'text', text: (parsed as { text: string }).text })
      } else if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as Record<string, unknown>).error === 'string'
      ) {
        results.push({ type: 'error', message: (parsed as { error: string }).error })
      }
    } catch {
      // Malformed JSON — skip silently (partial chunk edge case)
    }
  }

  return results
}
