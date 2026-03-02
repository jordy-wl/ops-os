/**
 * Structured JSON logger — satisfies ENGINEERING-STANDARDS.md requirement.
 *
 * All log output is structured JSON with required fields:
 *   level, timestamp, service, event
 *
 * Usage:
 *   logger.info('api-blocks', 'block.created', { block_id: block.id, org_id: ctx.orgId })
 *   logger.error('withAuth', 'auth.org_lookup_failed', { error_code: err.code })
 *
 * Never log: PII, raw request/response bodies, passwords, or tokens.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  timestamp: string
  service: string
  event: string
  [key: string]: unknown
}

function write(
  level: LogLevel,
  service: string,
  event: string,
  fields: Record<string, unknown> = {}
): void {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    service,
    event,
    ...fields,
  }
  // process.stdout.write keeps output synchronous and avoids console lint rules
  process.stdout.write(JSON.stringify(entry) + '\n')
}

export const logger = {
  /**
   * Debug-level log — verbose, development only.
   * @param service - The service/module name (e.g. 'api-blocks')
   * @param event   - The event identifier in dot-notation (e.g. 'db.query_started')
   * @param fields  - Additional structured fields (no PII)
   */
  debug: (service: string, event: string, fields?: Record<string, unknown>) =>
    write('debug', service, event, fields),

  /**
   * Info-level log — normal operational events (request completed, token usage, etc.).
   * @param service - The service/module name
   * @param event   - The event identifier in dot-notation
   * @param fields  - Additional structured fields (no PII)
   */
  info: (service: string, event: string, fields?: Record<string, unknown>) =>
    write('info', service, event, fields),

  /**
   * Warn-level log — degraded state that did not cause a failure (e.g. partial data).
   * @param service - The service/module name
   * @param event   - The event identifier in dot-notation
   * @param fields  - Additional structured fields (no PII)
   */
  warn: (service: string, event: string, fields?: Record<string, unknown>) =>
    write('warn', service, event, fields),

  /**
   * Error-level log — unexpected failures. Include error_code but never stack traces or PII.
   * @param service - The service/module name
   * @param event   - The event identifier in dot-notation
   * @param fields  - Additional structured fields — include `error_code`, optionally `critical: true`
   */
  error: (service: string, event: string, fields?: Record<string, unknown>) =>
    write('error', service, event, fields),
}
