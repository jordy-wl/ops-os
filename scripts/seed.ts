/**
 * scripts/seed.ts — Ops OS Demo Seed Script
 *
 * Populates the "Thornfield Capital Partners" FCA onboarding demo scenario.
 * Designed to run after: npm run db:reset (tables are empty, trigger recreated).
 *
 * Usage:
 *   npm run db:seed
 *
 * To re-seed from scratch: npm run db:reset && npm run db:seed
 *   (Cannot delete seeded data while immutability trigger is active — db:reset
 *    drops and recreates all tables, bypassing the trigger.)
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local or env.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Load .env.local ───────────────────────────────────────────────────────
// Convenience for local dev — no dotenv package needed.
const envFile = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('    Set them in .env.local or as environment variables.')
  console.error('    For local dev: run `supabase start` and use the printed values.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ─── Timestamp helpers ────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Assertion helper ─────────────────────────────────────────────────────

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌  ${message}`)
    process.exit(1)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Ops OS Seed — Thornfield Capital Partners demo scenario')
  console.log(`   Target: ${SUPABASE_URL}`)

  // ── Idempotency check ─────────────────────────────────────────────────
  const { data: existingOrg } = await supabase
    .from('orgs')
    .select('id')
    .eq('clerk_org_id', 'demo_org_001')
    .maybeSingle()

  if (existingOrg) {
    console.log('\n✅ Demo org already seeded — nothing to do.')
    console.log('   To re-seed: npm run db:reset && npm run db:seed')
    process.exit(0)
  }

  // ── Org ───────────────────────────────────────────────────────────────
  console.log('\n  Inserting org...')
  const { data: org, error: orgErr } = await supabase
    .from('orgs')
    .insert({ clerk_org_id: 'demo_org_001', name: 'Acme Capital Operations', slug: 'acme-capital' })
    .select()
    .single()
  assert(!orgErr, `Org insert failed: ${orgErr?.message}`)
  const ORG_ID: string = org.id
  console.log(`  ✓ Org: ${org.name} (${ORG_ID})`)

  const DEMO_USER = 'user_demo_001'
  const SYSTEM    = 'system'
  const AI_SYS    = 'ai_system'
  const WORKFLOW  = 'workflow_engine'

  // ── Blocks ────────────────────────────────────────────────────────────
  console.log('\n  Inserting blocks...')

  const { data: bClient, error: bClientErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'client',
      name: 'Thornfield Capital Partners',
      state: 'active',
      metadata: {
        aum: '£450M',
        regulatory_status: 'FCA Authorised',
        relationship_manager: 'Emma Hartley',
        jurisdiction: 'GB',
        entity_type: 'fund_manager',
        registered_address: '5 King William Street, London EC4N 7AR',
        lei_code: '2138004JN1Y2EXAMPLE01',
      },
      created_at: daysAgo(28),
      updated_at: daysAgo(3),
    })
    .select()
    .single()
  assert(!bClientErr, `Client block: ${bClientErr?.message}`)
  console.log(`  ✓ Client:  ${bClient.name}`)

  const { data: bDeal, error: bDealErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'deal',
      name: 'Thornfield Q1 2026 Onboarding',
      state: 'active',
      metadata: {
        status: 'in_progress',
        estimated_close: '2026-04-30',
        deal_type: 'new_client_onboarding',
        priority: 'high',
        assigned_rm: 'Emma Hartley',
      },
      created_at: daysAgo(28),
      updated_at: daysAgo(5),
    })
    .select()
    .single()
  assert(!bDealErr, `Deal block: ${bDealErr?.message}`)
  console.log(`  ✓ Deal:    ${bDeal.name}`)

  const { data: bProject, error: bProjectErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'project',
      name: 'KYC/AML Review — Thornfield',
      state: 'active',
      metadata: {
        stage: 'document_review',
        assigned_team: 'compliance',
        regulatory_framework: 'FCA SYSC',
        risk_rating: 'medium',
        target_completion: '2026-03-31',
      },
      created_at: daysAgo(27),
      updated_at: daysAgo(2),
    })
    .select()
    .single()
  assert(!bProjectErr, `Project block: ${bProjectErr?.message}`)
  console.log(`  ✓ Project: ${bProject.name}`)

  const { data: bSarah, error: bSarahErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'contact',
      name: 'Sarah Okonkwo',
      state: 'active',
      metadata: {
        title: 'Chief Executive Officer',
        email: 's.okonkwo@thornfield.com',
        phone: '+44 20 7946 0101',
        is_pep: false,
        kyc_status: 'pending',
      },
      created_at: daysAgo(27),
      updated_at: daysAgo(27),
    })
    .select()
    .single()
  assert(!bSarahErr, `Contact Sarah: ${bSarahErr?.message}`)
  console.log(`  ✓ Contact: ${bSarah.name}`)

  const { data: bMarcus, error: bMarcusErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'contact',
      name: 'Marcus Webb',
      state: 'active',
      metadata: {
        title: 'Chief Financial Officer',
        email: 'm.webb@thornfield.com',
        phone: '+44 20 7946 0202',
        is_pep: false,
        kyc_status: 'pending',
      },
      created_at: daysAgo(27),
      updated_at: daysAgo(27),
    })
    .select()
    .single()
  assert(!bMarcusErr, `Contact Marcus: ${bMarcusErr?.message}`)
  console.log(`  ✓ Contact: ${bMarcus.name}`)

  // ── Edges (6) ─────────────────────────────────────────────────────────
  console.log('\n  Inserting edges...')
  const edges = [
    { from_block_id: bClient.id,  to_block_id: bDeal.id,    edge_type: 'owns',              metadata: {} },
    { from_block_id: bClient.id,  to_block_id: bProject.id, edge_type: 'owns',              metadata: {} },
    { from_block_id: bDeal.id,    to_block_id: bProject.id, edge_type: 'related_to',        metadata: {} },
    { from_block_id: bClient.id,  to_block_id: bSarah.id,   edge_type: 'has_contact',       metadata: { role: 'primary_contact' } },
    { from_block_id: bClient.id,  to_block_id: bMarcus.id,  edge_type: 'has_contact',       metadata: { role: 'financial_contact' } },
    { from_block_id: bProject.id, to_block_id: bSarah.id,   edge_type: 'involves_contact',  metadata: { reason: 'pep_screening' } },
  ]
  for (const edge of edges) {
    const { error: edgeErr } = await supabase
      .from('block_edges')
      .insert({ org_id: ORG_ID, ...edge })
    assert(!edgeErr, `Edge insert failed: ${edgeErr?.message}`)
  }
  console.log(`  ✓ ${edges.length} edges`)

  // ── Events (15) ───────────────────────────────────────────────────────
  console.log('\n  Inserting events...')
  const eventRows = [
    // 1 — Onboarding kick-off
    {
      org_id: ORG_ID, block_id: bClient.id,
      type: 'onboarding.initiated', actor_id: DEMO_USER, actor_type: 'human',
      payload: { initiated_by: 'Emma Hartley', note: 'Referred by existing client Meridian Advisors' },
      occurred_at: daysAgo(28),
    },
    // 2 — Block auto-created
    {
      org_id: ORG_ID, block_id: bClient.id,
      type: 'client.created', actor_id: SYSTEM, actor_type: 'system',
      payload: { source: 'manual_entry', created_by: DEMO_USER },
      occurred_at: daysAgo(28),
    },
    // 3 — Document request: CoI
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'document.requested', actor_id: WORKFLOW, actor_type: 'system',
      payload: { document_type: 'Certificate of Incorporation', required_by: daysAgo(21) },
      occurred_at: daysAgo(27),
    },
    // 4 — Document request: FCA cert
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'document.requested', actor_id: WORKFLOW, actor_type: 'system',
      payload: { document_type: 'FCA Registration Certificate', required_by: daysAgo(21) },
      occurred_at: daysAgo(27),
    },
    // 5 — CoI received
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'document.received', actor_id: DEMO_USER, actor_type: 'human',
      payload: { document_type: 'Certificate of Incorporation', received_from: 's.okonkwo@thornfield.com', pages: 4 },
      occurred_at: daysAgo(24),
    },
    // 6 — KYC check starts
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'kyc.check.initiated', actor_id: WORKFLOW, actor_type: 'system',
      payload: { check_types: ['identity', 'sanctions', 'pep'], provider: 'internal' },
      occurred_at: daysAgo(23),
    },
    // 7 — AML screening running
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'aml.screening.running', actor_id: AI_SYS, actor_type: 'ai',
      payload: { provider: 'ComplyAdvantage', entity_name: 'Thornfield Capital Partners', jurisdiction: 'GB' },
      occurred_at: daysAgo(22),
    },
    // 8 — AML clear
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'aml.screening.clear', actor_id: AI_SYS, actor_type: 'ai',
      payload: { risk_score: 'low', matches: 0, provider: 'ComplyAdvantage' },
      occurred_at: daysAgo(22),
    },
    // 9 — FCA cert received
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'document.received', actor_id: DEMO_USER, actor_type: 'human',
      payload: { document_type: 'FCA Registration Certificate', received_from: 'm.webb@thornfield.com', fca_ref: '987654' },
      occurred_at: daysAgo(20),
    },
    // 10 — Compliance review triggered
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'compliance.review.required', actor_id: WORKFLOW, actor_type: 'system',
      payload: { reason: 'PEP check required for senior management', triggered_by: 'kyc_ruleset_v2' },
      occurred_at: daysAgo(18),
    },
    // 11 — Review assigned
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'compliance.review.assigned', actor_id: DEMO_USER, actor_type: 'human',
      payload: { assignee: 'James Osei', team: 'compliance', priority: 'medium' },
      occurred_at: daysAgo(17),
    },
    // 12 — Compliance call scheduled
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'meeting.scheduled', actor_id: DEMO_USER, actor_type: 'human',
      payload: { meeting_type: 'compliance_call', scheduled_date: '2026-03-15', attendees: ['James Osei', 'Sarah Okonkwo'] },
      occurred_at: daysAgo(14),
    },
    // 13 — Review in progress
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'compliance.review.in_progress', actor_id: DEMO_USER, actor_type: 'human',
      payload: { reviewer: 'James Osei', notes: 'Initial review of director backgrounds underway' },
      occurred_at: daysAgo(7),
    },
    // 14 — Source of Funds declaration requested
    {
      org_id: ORG_ID, block_id: bProject.id,
      type: 'document.requested', actor_id: WORKFLOW, actor_type: 'system',
      payload: { document_type: 'Source of Funds Declaration', required_by: daysAgo(0) },
      occurred_at: daysAgo(5),
    },
    // 15 — Onboarding step pending
    {
      org_id: ORG_ID, block_id: bClient.id,
      type: 'onboarding.step.pending', actor_id: SYSTEM, actor_type: 'system',
      payload: { next_step: 'Awaiting Source of Funds Declaration', current_step: 'source_of_funds_review', progress_pct: 65 },
      occurred_at: daysAgo(3),
    },
  ]
  const { error: eventsErr } = await supabase.from('events').insert(eventRows)
  assert(!eventsErr, `Events insert failed: ${eventsErr?.message}`)
  console.log(`  ✓ ${eventRows.length} events`)

  // ── Workflow job ───────────────────────────────────────────────────────
  console.log('\n  Inserting workflow job...')
  const { data: job, error: jobErr } = await supabase
    .from('workflow_jobs')
    .insert({
      org_id: ORG_ID,
      block_id: bClient.id,
      type: 'onboarding',
      status: 'pending',
      payload: {
        client_block_id: bClient.id,
        deal_block_id: bDeal.id,
        project_block_id: bProject.id,
        current_step: 'source_of_funds_review',
        steps_completed: ['initial_intake', 'document_collection_partial', 'aml_screening', 'kyc_initiated'],
        steps_remaining: ['source_of_funds_review', 'compliance_sign_off', 'account_setup', 'welcome_pack'],
      },
      scheduled_at: daysAgo(28),
      created_at: daysAgo(28),
    })
    .select()
    .single()
  assert(!jobErr, `Workflow job: ${jobErr?.message}`)
  console.log(`  ✓ Job: ${job.type} (${job.status})`)

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`
✅ Seed complete!

   Org:     ${org.name}  (clerk_org_id: demo_org_001)
   Blocks:  5  (1 client · 1 deal · 1 project · 2 contacts)
   Edges:   ${edges.length}
   Events:  ${eventRows.length}  (spanning last 28 days)
   Jobs:    1  (onboarding · pending)

   View data: npm run db:studio
`)
}

seed().catch((err: Error) => {
  console.error('❌  Seed failed:', err.message)
  process.exit(1)
})
