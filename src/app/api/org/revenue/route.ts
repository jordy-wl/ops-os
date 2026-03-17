import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok } from '@/lib/api/responses'

/**
 * GET /api/org/revenue
 *
 * Returns revenue forecasts derived from deal pipeline (weighted by stage probability),
 * solution pricing, product defaults, and service rates.
 * No billing/accounting data — all values are forecasts.
 */

const STAGE_PROBABILITY: Record<string, number> = {
  prospect: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  closed_won: 1.0,
  closed_lost: 0,
}

interface DealBlock {
  id: string
  name: string
  data: Record<string, unknown>
  metadata: Record<string, unknown>
}

interface SolutionBlock {
  id: string
  name: string
  data: Record<string, unknown>
}

export const GET = withAuth(async (_req, ctx) => {
  const supabase = createServerClient()
  const orgId = ctx.orgId
  // Fetch deals, solutions, products, services in parallel
  const [dealsRes, solutionsRes, productsRes, servicesRes] = await Promise.all([
    supabase
      .from('blocks')
      .select('id, name, data, metadata')
      .eq('org_id', orgId)
      .eq('type', 'deal')
      .eq('status', 'active'),
    supabase
      .from('blocks')
      .select('id, name, data')
      .eq('org_id', orgId)
      .eq('type', 'solution')
      .eq('status', 'active'),
    supabase
      .from('blocks')
      .select('id, name, data')
      .eq('org_id', orgId)
      .eq('type', 'product')
      .eq('status', 'active'),
    supabase
      .from('blocks')
      .select('id, name, data')
      .eq('org_id', orgId)
      .eq('type', 'service')
      .eq('status', 'active'),
  ])

  const deals = (dealsRes.data ?? []) as DealBlock[]
  const solutions = (solutionsRes.data ?? []) as SolutionBlock[]
  const products = (productsRes.data ?? []) as { id: string; name: string; data: Record<string, unknown> }[]
  const services = (servicesRes.data ?? []) as { id: string; name: string; data: Record<string, unknown> }[]

  // --- Pipeline metrics from deals ---
  let totalPipeline = 0
  let weightedForecast = 0
  let closedWonTotal = 0
  const byStage: Record<string, { count: number; value: number }> = {}
  const byMonth: Record<string, number> = {} // YYYY-MM -> weighted value

  for (const deal of deals) {
    const value = Number(deal.data?.deal_value) || 0
    const stage = (deal.data?.stage as string) || 'prospect'
    const expectedClose = deal.data?.expected_close as string | undefined
    const probability = STAGE_PROBABILITY[stage] ?? 0

    // Pipeline = all non-closed-lost deals
    if (stage !== 'closed_lost') {
      totalPipeline += value
    }

    // Weighted forecast
    const weighted = value * probability
    weightedForecast += weighted

    // Closed won total
    if (stage === 'closed_won') {
      closedWonTotal += value
    }

    // By stage
    if (!byStage[stage]) {
      byStage[stage] = { count: 0, value: 0 }
    }
    byStage[stage].count++
    byStage[stage].value += value

    // By expected close month (for forecast timeline)
    if (expectedClose && stage !== 'closed_lost' && stage !== 'closed_won') {
      const month = expectedClose.substring(0, 7) // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + weighted
    }
  }

  // --- Solution-based recurring revenue ---
  let solutionRecurring = 0
  const solutionBreakdown: { id: string; name: string; pricing_model: string; value: number }[] = []

  for (const sol of solutions) {
    const pricingModel = (sol.data?.pricing_model as string) || 'fixed'
    const value = Number(sol.data?.base_price) || Number(sol.data?.deal_value) || 0
    if (value > 0) {
      solutionRecurring += pricingModel === 'subscription' || pricingModel === 'retainer' ? value : 0
      solutionBreakdown.push({
        id: sol.id,
        name: sol.name,
        pricing_model: pricingModel,
        value,
      })
    }
  }

  // --- Products/services summary ---
  const productSummary = products.map((p) => ({
    id: p.id,
    name: p.name,
    unit_price: Number(p.data?.unit_price) || 0,
    currency: (p.data?.currency as string) || 'AUD',
  }))

  const serviceSummary = services.map((s) => ({
    id: s.id,
    name: s.name,
    hourly_rate: Number(s.data?.hourly_rate) || 0,
    currency: (s.data?.currency as string) || 'AUD',
  }))

  // --- Monthly forecast sorted ---
  const monthlyForecast = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value: Math.round(value) }))

  // --- Stage funnel sorted by probability ---
  const stageFunnel = Object.entries(byStage)
    .sort(([a], [b]) => (STAGE_PROBABILITY[b] ?? 0) - (STAGE_PROBABILITY[a] ?? 0))
    .map(([stage, stats]) => ({
      stage,
      count: stats.count,
      value: Math.round(stats.value),
      probability: STAGE_PROBABILITY[stage] ?? 0,
    }))

  return ok({
    summary: {
      total_pipeline: Math.round(totalPipeline),
      weighted_forecast: Math.round(weightedForecast),
      closed_won: Math.round(closedWonTotal),
      solution_recurring: Math.round(solutionRecurring),
      deal_count: deals.length,
      solution_count: solutions.length,
    },
    stage_funnel: stageFunnel,
    monthly_forecast: monthlyForecast,
    solutions: solutionBreakdown,
    products: productSummary,
    services: serviceSummary,
  })
})
