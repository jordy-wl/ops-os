import { NextResponse } from 'next/server'
import type { ZodIssue } from 'zod'

/**
 * Returns a standard success response.
 *
 * @param data   - The response payload (any serialisable value)
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with shape `{ data: T, error: null }`
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status })
}

/**
 * Returns a standard API error response.
 *
 * @param message - Human-readable description safe to surface to users
 * @param code    - Machine-readable error code in namespace/kebab format (e.g. 'db/query-failed')
 * @param status  - HTTP status code
 * @returns NextResponse with shape `{ data: null, error: { message, code } }`
 */
export function apiError(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ data: null, error: { message, code } }, { status })
}

/**
 * Returns a 400 validation error response built from Zod issues.
 *
 * @param issues - Array of ZodIssue objects from a failed `safeParse` call
 * @returns NextResponse 400 with shape `{ data: null, error: { message, code, details[] } }`
 */
export function validationError(issues: ZodIssue[]): NextResponse {
  return NextResponse.json(
    {
      data: null,
      error: {
        message: 'Validation failed',
        code: 'validation/invalid-input',
        details: issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    },
    { status: 400 }
  )
}
