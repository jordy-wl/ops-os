import { describe, it, expect, vi } from 'vitest'
import { validateReportingDepth, isValidStatusTransition } from '../validation'

// ─── Supabase mock for hierarchy queries ────────────────────────────────────

function makeChainMock(responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve(queue[i++] ?? { data: null, error: null })
    ),
  }

  return chain as unknown as Parameters<typeof validateReportingDepth>[0]
}

describe('validateReportingDepth', () => {
  it('returns null for a manager with no parent (depth=1)', async () => {
    const supabase = makeChainMock([
      { data: { id: 'manager-1', metadata: { reporting_to: null } }, error: null },
    ])

    const result = await validateReportingDepth(supabase, 'org-1', 'manager-1')
    expect(result).toBeNull()
  })

  it('returns null for a chain of 3 levels (within limit)', async () => {
    const supabase = makeChainMock([
      { data: { id: 'lvl-1', metadata: { reporting_to: 'lvl-2' } }, error: null },
      { data: { id: 'lvl-2', metadata: { reporting_to: 'lvl-3' } }, error: null },
      { data: { id: 'lvl-3', metadata: { reporting_to: null } }, error: null },
    ])

    const result = await validateReportingDepth(supabase, 'org-1', 'lvl-1')
    expect(result).toBeNull()
  })

  it('returns error when chain exceeds 4 levels', async () => {
    const supabase = makeChainMock([
      { data: { id: 'a', metadata: { reporting_to: 'b' } }, error: null },
      { data: { id: 'b', metadata: { reporting_to: 'c' } }, error: null },
      { data: { id: 'c', metadata: { reporting_to: 'd' } }, error: null },
      { data: { id: 'd', metadata: { reporting_to: 'e' } }, error: null },
      { data: { id: 'e', metadata: { reporting_to: null } }, error: null },
    ])

    const result = await validateReportingDepth(supabase, 'org-1', 'a')
    expect(result).toContain('exceed')
  })

  it('returns error when reporting-to team member not found', async () => {
    const supabase = makeChainMock([
      { data: null, error: null }, // not found
    ])

    const result = await validateReportingDepth(supabase, 'org-1', 'missing-id')
    expect(result).toContain('not found')
  })

  it('detects cycle when selfId appears in the chain', async () => {
    const supabase = makeChainMock([
      { data: { id: 'manager-1', metadata: { reporting_to: 'self-id' } }, error: null },
    ])

    const result = await validateReportingDepth(supabase, 'org-1', 'manager-1', 'self-id')
    expect(result).toContain('cycle')
  })
})

describe('isValidStatusTransition', () => {
  it('allows active → on_leave', () => {
    expect(isValidStatusTransition('active', 'on_leave')).toBe(true)
  })

  it('allows active → offboarding', () => {
    expect(isValidStatusTransition('active', 'offboarding')).toBe(true)
  })

  it('allows on_leave → active', () => {
    expect(isValidStatusTransition('on_leave', 'active')).toBe(true)
  })

  it('allows offboarding → inactive', () => {
    expect(isValidStatusTransition('offboarding', 'inactive')).toBe(true)
  })

  it('allows same status (no-op)', () => {
    expect(isValidStatusTransition('active', 'active')).toBe(true)
  })

  it('rejects inactive → active (terminal state)', () => {
    expect(isValidStatusTransition('inactive', 'active')).toBe(false)
  })

  it('rejects active → inactive (must go through offboarding)', () => {
    expect(isValidStatusTransition('active', 'inactive')).toBe(false)
  })

  it('rejects offboarding → active', () => {
    expect(isValidStatusTransition('offboarding', 'active')).toBe(false)
  })
})
