import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { Permission } from '@/lib/rbac/types'

// ─── Mock auth ─────────────────────────────────────────────────────────────

const ALL_PERMS = new Set<Permission>([
  'manage_blocks', 'edit_blocks', 'view_blocks', 'manage_workflows',
  'execute_workflows', 'approve_tasks', 'manage_team', 'manage_settings',
  'manage_integrations', 'view_audit_log',
])

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: vi.fn(
    (handler: (req: NextRequest, ctx: AuthContext, params: Record<string, string>) => Promise<Response>) =>
      async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        const params = await context.params
        return handler(
          req,
          {
            userId: 'user_111', clerkOrgId: 'org_abc', orgId: 'uuid-org-1',
            role: 'ops-admin' as const, roleId: 'role-uuid-admin', permissions: ALL_PERMS,
          },
          params
        )
      }
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { GET } from '../route'

// ─── Mock DB helper ────────────────────────────────────────────────────────

function makeChainedDb(responses: Record<string, { data: unknown; error: unknown }>) {
  // Each from('blocks').select().eq().eq().eq() sequence returns based on block type
  const typeHistory: string[] = []

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
      if (_col === 'type') typeHistory.push(val as string)
      return chain
    }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      const type = typeHistory.shift() || 'unknown'
      const response = responses[type] ?? { data: [], error: null }
      return Promise.resolve(response).then(resolve)
    }),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return chain
}

const makeReq = (url = 'http://localhost/api/org/revenue') =>
  new NextRequest(url, {} as ConstructorParameters<typeof NextRequest>[1])

// ─── Test data ────────────────────────────────────────────────────────────

const DEALS = [
  { id: 'd1', name: 'Acme Deal', data: { deal_value: 100000, stage: 'qualified', expected_close: '2026-04-01' }, metadata: {} },
  { id: 'd2', name: 'Beta Deal', data: { deal_value: 50000, stage: 'closed_won' }, metadata: {} },
  { id: 'd3', name: 'Gamma Deal', data: { deal_value: 200000, stage: 'proposal', expected_close: '2026-05-01' }, metadata: {} },
  { id: 'd4', name: 'Lost Deal', data: { deal_value: 75000, stage: 'closed_lost' }, metadata: {} },
]

const SOLUTIONS = [
  { id: 's1', name: 'Compliance Package', data: { pricing_model: 'subscription', base_price: 5000 } },
  { id: 's2', name: 'Advisory Retainer', data: { pricing_model: 'retainer', deal_value: 8000 } },
  { id: 's3', name: 'One-off Audit', data: { pricing_model: 'fixed', base_price: 15000 } },
]

const PRODUCTS = [
  { id: 'p1', name: 'RegTech Platform', data: { unit_price: 2500, currency: 'AUD' } },
  { id: 'p2', name: 'Risk Dashboard', data: { unit_price: 1000, currency: 'USD' } },
]

const SERVICES = [
  { id: 'sv1', name: 'Compliance Advisory', data: { hourly_rate: 350, currency: 'AUD' } },
  { id: 'sv2', name: 'Implementation', data: { hourly_rate: 250, currency: 'AUD' } },
]

// ─── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/org/revenue', () => {
  it('returns 200 with correct summary from deals', async () => {
    makeChainedDb({
      deal: { data: DEALS, error: null },
      solution: { data: SOLUTIONS, error: null },
      product: { data: PRODUCTS, error: null },
      service: { data: SERVICES, error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)

    const json = await res.json()
    const { summary } = json.data

    // Pipeline = all non-closed-lost: 100000 + 50000 + 200000 = 350000
    expect(summary.total_pipeline).toBe(350000)

    // Weighted: 100000*0.25 + 50000*1.0 + 200000*0.5 + 75000*0 = 25000 + 50000 + 100000 = 175000
    expect(summary.weighted_forecast).toBe(175000)

    // Closed won = 50000
    expect(summary.closed_won).toBe(50000)

    // Deal count
    expect(summary.deal_count).toBe(4)
  })

  it('computes solution recurring revenue', async () => {
    makeChainedDb({
      deal: { data: [], error: null },
      solution: { data: SOLUTIONS, error: null },
      product: { data: [], error: null },
      service: { data: [], error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()
    const { summary } = json.data

    // Recurring = subscription(5000) + retainer(8000) = 13000
    // Fixed pricing_model is NOT recurring
    expect(summary.solution_recurring).toBe(13000)
    expect(summary.solution_count).toBe(3)
  })

  it('returns stage funnel sorted by probability', async () => {
    makeChainedDb({
      deal: { data: DEALS, error: null },
      solution: { data: [], error: null },
      product: { data: [], error: null },
      service: { data: [], error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()
    const { stage_funnel } = json.data

    expect(stage_funnel.length).toBeGreaterThan(0)

    // Should be sorted by probability descending
    for (let i = 1; i < stage_funnel.length; i++) {
      expect(stage_funnel[i - 1].probability).toBeGreaterThanOrEqual(stage_funnel[i].probability)
    }

    // Check specific stages
    const closedWon = stage_funnel.find((s: { stage: string }) => s.stage === 'closed_won')
    expect(closedWon).toBeDefined()
    expect(closedWon.count).toBe(1)
    expect(closedWon.value).toBe(50000)
  })

  it('returns monthly forecast for open deals', async () => {
    makeChainedDb({
      deal: { data: DEALS, error: null },
      solution: { data: [], error: null },
      product: { data: [], error: null },
      service: { data: [], error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()
    const { monthly_forecast } = json.data

    // Two open deals with expected_close: 2026-04 and 2026-05
    expect(monthly_forecast.length).toBe(2)
    expect(monthly_forecast[0].month).toBe('2026-04')
    expect(monthly_forecast[1].month).toBe('2026-05')

    // 2026-04: qualified deal 100000 * 0.25 = 25000
    expect(monthly_forecast[0].value).toBe(25000)
    // 2026-05: proposal deal 200000 * 0.5 = 100000
    expect(monthly_forecast[1].value).toBe(100000)
  })

  it('returns products and services summaries', async () => {
    makeChainedDb({
      deal: { data: [], error: null },
      solution: { data: [], error: null },
      product: { data: PRODUCTS, error: null },
      service: { data: SERVICES, error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()

    expect(json.data.products).toHaveLength(2)
    expect(json.data.products[0].name).toBe('RegTech Platform')
    expect(json.data.products[0].unit_price).toBe(2500)
    expect(json.data.products[0].currency).toBe('AUD')

    expect(json.data.services).toHaveLength(2)
    expect(json.data.services[0].name).toBe('Compliance Advisory')
    expect(json.data.services[0].hourly_rate).toBe(350)
  })

  it('handles empty data gracefully', async () => {
    makeChainedDb({
      deal: { data: [], error: null },
      solution: { data: [], error: null },
      product: { data: [], error: null },
      service: { data: [], error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()

    expect(json.data.summary.total_pipeline).toBe(0)
    expect(json.data.summary.weighted_forecast).toBe(0)
    expect(json.data.summary.closed_won).toBe(0)
    expect(json.data.summary.deal_count).toBe(0)
    expect(json.data.stage_funnel).toHaveLength(0)
    expect(json.data.monthly_forecast).toHaveLength(0)
  })

  it('handles null data from Supabase', async () => {
    makeChainedDb({
      deal: { data: null, error: null },
      solution: { data: null, error: null },
      product: { data: null, error: null },
      service: { data: null, error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.summary.deal_count).toBe(0)
    expect(json.data.summary.total_pipeline).toBe(0)
  })

  it('excludes closed_lost from pipeline total', async () => {
    const onlyLost = [
      { id: 'd1', name: 'Lost Deal', data: { deal_value: 100000, stage: 'closed_lost' }, metadata: {} },
    ]

    makeChainedDb({
      deal: { data: onlyLost, error: null },
      solution: { data: [], error: null },
      product: { data: [], error: null },
      service: { data: [], error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()

    expect(json.data.summary.total_pipeline).toBe(0)
    expect(json.data.summary.weighted_forecast).toBe(0)
  })

  it('defaults currency to AUD when not set', async () => {
    const noCurrencyProducts = [
      { id: 'p1', name: 'No Currency Product', data: { unit_price: 100 } },
    ]
    const noCurrencyServices = [
      { id: 'sv1', name: 'No Currency Service', data: { hourly_rate: 200 } },
    ]

    makeChainedDb({
      deal: { data: [], error: null },
      solution: { data: [], error: null },
      product: { data: noCurrencyProducts, error: null },
      service: { data: noCurrencyServices, error: null },
    })

    const res = await GET(makeReq(), { params: Promise.resolve({}) })
    const json = await res.json()

    expect(json.data.products[0].currency).toBe('AUD')
    expect(json.data.services[0].currency).toBe('AUD')
  })
})
