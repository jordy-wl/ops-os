/**
 * scripts/seed-demo.ts — Ops OS Comprehensive Demo Seed Script
 *
 * Creates a realistic Thornfield Capital demo scenario with document templates,
 * brand kit, workflow templates, blocks, events, and edges.
 *
 * Usage:
 *   ORG_ID=<uuid> npx tsx scripts/seed-demo.ts
 *
 * Or set ORG_ID in .env.local alongside SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Requires:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local or env
 *   - ORG_ID — the UUID of an existing org (from the orgs table)
 *
 * Idempotent: checks for existing demo data before inserting. Safe to run twice.
 *
 * @see scripts/seed.ts — original seed script (same patterns used here)
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { SYSTEM_BLOCK_TYPES } from '../src/lib/block-types/system-types'

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
const ORG_ID = process.env.ORG_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('    Set them in .env.local or as environment variables.')
  process.exit(1)
}

if (!ORG_ID) {
  console.error('❌  Missing ORG_ID environment variable')
  console.error('    Set ORG_ID to the UUID of an existing org from the orgs table.')
  console.error('    Example: ORG_ID=abc123 npx tsx scripts/seed-demo.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ─── Helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌  ${message}`)
    process.exit(1)
  }
}

// ─── Ensure block type definitions exist ──────────────────────────────────

async function ensureBlockTypeDefinitions(): Promise<void> {
  console.log('\n  Checking block type definitions...')

  const { data: existing, error: checkErr } = await supabase
    .from('block_type_definitions')
    .select('type_name')
    .eq('org_id', ORG_ID)

  assert(!checkErr, `Failed to check block type definitions: ${checkErr?.message}`)

  const existingTypes = new Set((existing ?? []).map((r: { type_name: string }) => r.type_name))

  const missing = SYSTEM_BLOCK_TYPES.filter((t) => !existingTypes.has(t.type_name))

  if (missing.length === 0) {
    console.log('  ✓ All system block types already seeded')
    return
  }

  const rows = missing.map((t) => ({
    org_id: ORG_ID,
    type_name: t.type_name,
    display_name: t.display_name,
    description: t.description,
    field_schema: t.field_schema,
    icon: t.icon,
    color: t.color,
    is_system: true,
  }))

  const { error: insertErr } = await supabase
    .from('block_type_definitions')
    .upsert(rows, { onConflict: 'org_id,type_name', ignoreDuplicates: true })

  assert(!insertErr, `Failed to seed block type definitions: ${insertErr?.message}`)
  console.log(`  ✓ Seeded ${missing.length} missing block type definitions`)
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Ops OS Demo Seed — Thornfield Capital comprehensive scenario')
  console.log(`   Target: ${SUPABASE_URL}`)
  console.log(`   Org ID: ${ORG_ID}`)

  // ── Validate org exists ─────────────────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from('orgs')
    .select('id, name')
    .eq('id', ORG_ID)
    .maybeSingle()

  assert(!orgErr, `Org lookup failed: ${orgErr?.message}`)
  assert(org, `Org not found with ID: ${ORG_ID}. Seed the org first or check the ID.`)
  console.log(`   Org name: ${org.name}`)

  // ── Idempotency check — look for a known demo block name ────────────
  const DEMO_MARKER_NAME = 'Client Onboarding Agreement'
  const { data: existingDemo } = await supabase
    .from('blocks')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('type', 'document_template')
    .eq('name', DEMO_MARKER_NAME)
    .maybeSingle()

  if (existingDemo) {
    console.log('\n✅ Demo data already seeded — nothing to do.')
    console.log('   To re-seed: delete the demo blocks first, then run again.')
    process.exit(0)
  }

  // ── Ensure block type definitions ───────────────────────────────────
  await ensureBlockTypeDefinitions()

  const DEMO_USER = 'user_demo_001'
  const SYSTEM = 'system'
  const AI_SYS = 'ai_system'
  const WORKFLOW = 'workflow_engine'

  // ═══════════════════════════════════════════════════════════════════
  // 1. DOCUMENT TEMPLATES (3)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting document templates...')

  const { data: tplOnboarding, error: tplOnboardingErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'document_template',
      name: 'Client Onboarding Agreement',
      state: 'active',
      metadata: {
        template_content: [
          '# Client Onboarding Agreement',
          '',
          '**Prepared for:** {{block.name}}',
          '',
          '**Jurisdiction:** {{block.metadata.jurisdiction}}',
          '',
          '**Contact:** {{block.metadata.contact_email}}',
          '',
          '---',
          '',
          '## 1. Scope of Services',
          '',
          'Thornfield Capital ("the Firm") agrees to provide investment management',
          'and advisory services to {{block.name}} ("the Client") in accordance',
          'with the terms outlined in this agreement.',
          '',
          '## 2. Regulatory Framework',
          '',
          'This engagement is governed by the regulatory requirements of',
          '{{block.metadata.jurisdiction}}, including all applicable ASIC regulations',
          'and reporting obligations.',
          '',
          '## 3. Fee Structure',
          '',
          '- Management fee: 1.25% per annum on AUM',
          '- Performance fee: 15% above benchmark (high-water mark applies)',
          '- Administration fee: 0.10% per annum',
          '',
          '## 4. Signatures',
          '',
          '| Party | Name | Date |',
          '|-------|------|------|',
          '| Thornfield Capital | _________________ | ____/____/____ |',
          '| {{block.name}} | _________________ | ____/____/____ |',
        ].join('\n'),
        variables: [
          { name: 'block.name', type: 'string', required: true },
          { name: 'block.metadata.jurisdiction', type: 'string', required: true },
          { name: 'block.metadata.contact_email', type: 'string', required: true },
        ],
        output_format: 'pdf',
        category: 'contract',
      },
      created_at: daysAgo(30),
      updated_at: daysAgo(5),
    })
    .select()
    .single()
  assert(!tplOnboardingErr, `Template (onboarding): ${tplOnboardingErr?.message}`)
  console.log(`  ✓ Template: ${tplOnboarding.name}`)

  const { data: tplProposal, error: tplProposalErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'document_template',
      name: 'Investment Proposal',
      state: 'active',
      metadata: {
        template_content: [
          '# Investment Proposal',
          '',
          '**Client:** {{client_name}}',
          '',
          '**Prepared by:** Thornfield Capital',
          '',
          '**Date:** {{date}}',
          '',
          '---',
          '',
          '## Executive Summary',
          '',
          'We propose an investment allocation of {{investment_amount}} for',
          '{{client_name}}, structured to align with a **{{risk_profile}}** risk',
          'tolerance profile.',
          '',
          '## Proposed Allocation',
          '',
          '| Asset Class | Allocation | Expected Return |',
          '|-------------|-----------|-----------------|',
          '| Equities (AU) | 35% | 8.5% p.a. |',
          '| Fixed Income | 25% | 4.2% p.a. |',
          '| Alternatives | 20% | 12.0% p.a. |',
          '| Cash & Equivalents | 10% | 3.8% p.a. |',
          '| International Equities | 10% | 9.1% p.a. |',
          '',
          '## Risk Assessment',
          '',
          'Risk profile: **{{risk_profile}}**',
          '',
          'Maximum drawdown tolerance: based on client risk assessment.',
          '',
          '## Next Steps',
          '',
          '1. Client review and feedback',
          '2. Compliance approval',
          '3. Account setup and funding',
          '4. Initial portfolio deployment',
        ].join('\n'),
        variables: [
          { name: 'client_name', type: 'string', required: true },
          { name: 'investment_amount', type: 'currency', required: true },
          { name: 'risk_profile', type: 'string', required: true },
          { name: 'date', type: 'date', required: false },
        ],
        output_format: 'pdf',
        category: 'proposal',
      },
      created_at: daysAgo(25),
      updated_at: daysAgo(10),
    })
    .select()
    .single()
  assert(!tplProposalErr, `Template (proposal): ${tplProposalErr?.message}`)
  console.log(`  ✓ Template: ${tplProposal.name}`)

  const { data: tplCompliance, error: tplComplianceErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'document_template',
      name: 'Monthly Compliance Report',
      state: 'active',
      metadata: {
        template_content: [
          '# Monthly Compliance Report',
          '',
          '**Reporting Period:** {{period}}',
          '',
          '**Prepared by:** Compliance Team, Thornfield Capital',
          '',
          '---',
          '',
          '## Summary',
          '',
          '- **Total entities under management:** {{entity_count}}',
          '- **Overall compliance status:** {{compliance_status}}',
          '- **Incidents reported:** 0',
          '- **Regulatory changes noted:** See Section 3',
          '',
          '## 1. Client Compliance Overview',
          '',
          'All active client engagements have been reviewed for the period',
          '{{period}}. No material compliance breaches were identified.',
          '',
          '## 2. KYC/AML Status',
          '',
          '| Metric | Count |',
          '|--------|-------|',
          '| KYC reviews completed | {{entity_count}} |',
          '| Pending reviews | 0 |',
          '| Escalated cases | 0 |',
          '',
          '## 3. Regulatory Updates',
          '',
          'No new ASIC regulatory changes affecting current operations.',
          '',
          '## 4. Recommendations',
          '',
          '- Continue quarterly KYC refresh cycle',
          '- Schedule annual compliance training (due Q2)',
          '',
          '---',
          '',
          '*This report is confidential and intended for internal use only.*',
        ].join('\n'),
        variables: [
          { name: 'period', type: 'string', required: true },
          { name: 'entity_count', type: 'number', required: true },
          { name: 'compliance_status', type: 'string', required: true },
        ],
        output_format: 'pdf',
        category: 'report',
      },
      created_at: daysAgo(20),
      updated_at: daysAgo(3),
    })
    .select()
    .single()
  assert(!tplComplianceErr, `Template (compliance): ${tplComplianceErr?.message}`)
  console.log(`  ✓ Template: ${tplCompliance.name}`)

  // ═══════════════════════════════════════════════════════════════════
  // 2. BRAND KIT (1)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting brand kit...')

  const { data: brandKit, error: brandKitErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'brand_kit',
      name: 'Thornfield Capital Brand Kit',
      state: 'active',
      metadata: {
        company_name: 'Thornfield Capital',
        primary_color: '#1a365d',
        secondary_color: '#2b6cb0',
        font_family: 'Inter',
        header_style: {
          background_color: '#1a365d',
          text_color: '#ffffff',
          show_logo: true,
        },
        footer_content: '<p style="text-align:center;color:#666;font-size:10px;">Confidential &mdash; Thornfield Capital &copy; 2026</p>',
        tagline: 'Strategic capital, disciplined operations.',
      },
      created_at: daysAgo(30),
      updated_at: daysAgo(2),
    })
    .select()
    .single()
  assert(!brandKitErr, `Brand kit: ${brandKitErr?.message}`)
  console.log(`  ✓ Brand Kit: ${brandKit.name}`)

  // ═══════════════════════════════════════════════════════════════════
  // 3. WORKFLOW TEMPLATES (2)
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting workflow templates...')

  const { data: wfOnboarding, error: wfOnboardingErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'workflow_template',
      name: 'Client Onboarding Flow',
      state: 'active',
      metadata: {
        applies_to_type: 'client',
        trigger: {
          type: 'event',
          event_pattern: 'onboarding.initiated',
        },
        steps: [
          {
            name: 'create_client_block',
            type: 'run_action',
            action_type: 'block.create',
          },
          {
            name: 'send_welcome_email',
            type: 'send_email',
          },
          {
            name: 'generate_onboarding_agreement',
            type: 'generate_document',
          },
          {
            name: 'wait_for_review',
            type: 'wait',
            wait_seconds: 86400,
          },
          {
            name: 'notify_compliance_team',
            type: 'emit_event',
            event_type: 'compliance.review.required',
          },
        ],
        description: 'End-to-end client onboarding: create block, send welcome email, generate agreement, notify compliance.',
      },
      created_at: daysAgo(28),
      updated_at: daysAgo(7),
    })
    .select()
    .single()
  assert(!wfOnboardingErr, `Workflow (onboarding): ${wfOnboardingErr?.message}`)
  console.log(`  ✓ Workflow: ${wfOnboarding.name}`)

  const { data: wfReporting, error: wfReportingErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'workflow_template',
      name: 'Monthly Reporting',
      state: 'active',
      metadata: {
        applies_to_type: 'client',
        trigger: {
          type: 'manual',
        },
        steps: [
          {
            name: 'generate_compliance_report',
            type: 'generate_document',
          },
          {
            name: 'send_to_management',
            type: 'send_email',
          },
          {
            name: 'archive_to_drive',
            type: 'call_api',
          },
          {
            name: 'log_completion',
            type: 'emit_event',
            event_type: 'report.cycle.completed',
          },
        ],
        description: 'Monthly reporting cycle: generate compliance report, distribute to management, archive to Drive.',
      },
      created_at: daysAgo(20),
      updated_at: daysAgo(4),
    })
    .select()
    .single()
  assert(!wfReportingErr, `Workflow (reporting): ${wfReportingErr?.message}`)
  console.log(`  ✓ Workflow: ${wfReporting.name}`)

  // ═══════════════════════════════════════════════════════════════════
  // 4. BLOCKS (5) — Clients, Compliance Entity, Employee, Process
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting blocks...')

  const { data: bMeridian, error: bMeridianErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'client',
      name: 'Meridian Holdings Pty Ltd',
      state: 'active',
      metadata: {
        jurisdiction: 'AU',
        entity_type: 'company',
        incorporation_date: '2018-03-15',
        aum: 'A$220M',
        regulatory_status: 'ASIC Registered',
        relationship_manager: 'Emma Hartley',
        registered_address: 'Level 12, 100 Collins Street, Melbourne VIC 3000',
        abn: '12 345 678 901',
        contact_email: 'operations@meridianholdings.com.au',
      },
      created_at: daysAgo(45),
      updated_at: daysAgo(2),
    })
    .select()
    .single()
  assert(!bMeridianErr, `Block (Meridian): ${bMeridianErr?.message}`)
  console.log(`  ✓ Client:  ${bMeridian.name}`)

  const { data: bPacific, error: bPacificErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'client',
      name: 'Pacific Ventures Group',
      state: 'active',
      metadata: {
        jurisdiction: 'AU',
        entity_type: 'company',
        incorporation_date: '2021-09-01',
        aum: 'A$85M',
        regulatory_status: 'ASIC Registered',
        relationship_manager: 'David Tan',
        registered_address: 'Suite 8, 45 Macquarie Street, Sydney NSW 2000',
        abn: '98 765 432 109',
        contact_email: 'admin@pacificventures.com.au',
      },
      created_at: daysAgo(30),
      updated_at: daysAgo(5),
    })
    .select()
    .single()
  assert(!bPacificErr, `Block (Pacific): ${bPacificErr?.message}`)
  console.log(`  ✓ Client:  ${bPacific.name}`)

  const { data: bCompliance, error: bComplianceErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'project',
      name: 'ASIC Compliance Framework',
      state: 'active',
      metadata: {
        status: 'in_progress',
        priority: 'high',
        regulatory_framework: 'ASIC Corporations Act 2001',
        compliance_domains: ['AML/CTF', 'KYC', 'Client Money', 'Record Keeping'],
        review_cycle: 'quarterly',
        last_review: daysAgo(30),
        next_review: '2026-06-30',
      },
      created_at: daysAgo(90),
      updated_at: daysAgo(1),
    })
    .select()
    .single()
  assert(!bComplianceErr, `Block (compliance): ${bComplianceErr?.message}`)
  console.log(`  ✓ Project: ${bCompliance.name}`)

  const { data: bSarah, error: bSarahErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'contact',
      name: 'Sarah Chen',
      state: 'active',
      metadata: {
        role: 'Head of Compliance',
        email: 's.chen@thornfieldcapital.com.au',
        phone: '+61 2 9876 5432',
        department: 'Compliance & Risk',
        start_date: '2023-01-15',
        certifications: ['AFSL Responsible Manager', 'AML/CTF Compliance Officer'],
      },
      created_at: daysAgo(90),
      updated_at: daysAgo(10),
    })
    .select()
    .single()
  assert(!bSarahErr, `Block (Sarah): ${bSarahErr?.message}`)
  console.log(`  ✓ Contact: ${bSarah.name}`)

  const { data: bProcess, error: bProcessErr } = await supabase
    .from('blocks')
    .insert({
      org_id: ORG_ID,
      type: 'project',
      name: 'Client Onboarding SOP v2.1',
      state: 'active',
      metadata: {
        status: 'completed',
        priority: 'medium',
        sop_version: '2.1',
        effective_date: '2026-01-01',
        owner: 'Sarah Chen',
        steps_count: 12,
        estimated_duration_days: 14,
        applies_to: ['client'],
        last_updated_by: 'Sarah Chen',
      },
      created_at: daysAgo(60),
      updated_at: daysAgo(15),
    })
    .select()
    .single()
  assert(!bProcessErr, `Block (process): ${bProcessErr?.message}`)
  console.log(`  ✓ Project: ${bProcess.name}`)

  // ═══════════════════════════════════════════════════════════════════
  // 5. EDGES — Relationships between blocks
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting edges...')

  const edges = [
    // Client → Employee assignment
    {
      from_block_id: bMeridian.id,
      to_block_id: bSarah.id,
      edge_type: 'has_contact',
      metadata: { role: 'compliance_officer' },
    },
    {
      from_block_id: bPacific.id,
      to_block_id: bSarah.id,
      edge_type: 'has_contact',
      metadata: { role: 'compliance_officer' },
    },
    // Client → Compliance entity
    {
      from_block_id: bMeridian.id,
      to_block_id: bCompliance.id,
      edge_type: 'related_to',
      metadata: { reason: 'ASIC regulated client' },
    },
    {
      from_block_id: bPacific.id,
      to_block_id: bCompliance.id,
      edge_type: 'related_to',
      metadata: { reason: 'ASIC regulated client' },
    },
    // Process → Client (onboarding SOP applies to clients)
    {
      from_block_id: bProcess.id,
      to_block_id: bMeridian.id,
      edge_type: 'related_to',
      metadata: { relationship: 'onboarding_process_applied' },
    },
    {
      from_block_id: bProcess.id,
      to_block_id: bPacific.id,
      edge_type: 'related_to',
      metadata: { relationship: 'onboarding_process_applied' },
    },
    // Compliance entity → Employee (Sarah owns the framework)
    {
      from_block_id: bCompliance.id,
      to_block_id: bSarah.id,
      edge_type: 'involves_contact',
      metadata: { role: 'framework_owner' },
    },
    // Workflow template → Process (onboarding flow implements the SOP)
    {
      from_block_id: wfOnboarding.id,
      to_block_id: bProcess.id,
      edge_type: 'related_to',
      metadata: { relationship: 'implements_sop' },
    },
  ]

  for (const edge of edges) {
    const { error: edgeErr } = await supabase
      .from('block_edges')
      .insert({ org_id: ORG_ID, ...edge })
    assert(!edgeErr, `Edge insert failed (${edge.from_block_id} → ${edge.to_block_id}): ${edgeErr?.message}`)
  }
  console.log(`  ✓ ${edges.length} edges`)

  // ═══════════════════════════════════════════════════════════════════
  // 6. EVENTS — Realistic audit trail
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n  Inserting events...')

  const eventRows = [
    // Meridian Holdings onboarding
    {
      org_id: ORG_ID,
      block_id: bMeridian.id,
      type: 'block.created',
      actor_id: DEMO_USER,
      actor_type: 'human',
      payload: { block_type: 'client', name: 'Meridian Holdings Pty Ltd' },
      occurred_at: daysAgo(45),
    },
    {
      org_id: ORG_ID,
      block_id: bMeridian.id,
      type: 'onboarding.initiated',
      actor_id: DEMO_USER,
      actor_type: 'human',
      payload: { initiated_by: 'Emma Hartley', channel: 'direct_referral' },
      occurred_at: daysAgo(44),
    },
    {
      org_id: ORG_ID,
      block_id: bMeridian.id,
      type: 'document.generated',
      actor_id: AI_SYS,
      actor_type: 'ai',
      payload: { template: 'Client Onboarding Agreement', format: 'pdf', pages: 4 },
      occurred_at: daysAgo(42),
    },
    {
      org_id: ORG_ID,
      block_id: bMeridian.id,
      type: 'email.sent',
      actor_id: WORKFLOW,
      actor_type: 'system',
      payload: { to: 'operations@meridianholdings.com.au', subject: 'Welcome to Thornfield Capital', template: 'welcome_email' },
      occurred_at: daysAgo(42),
    },
    // Pacific Ventures onboarding
    {
      org_id: ORG_ID,
      block_id: bPacific.id,
      type: 'block.created',
      actor_id: DEMO_USER,
      actor_type: 'human',
      payload: { block_type: 'client', name: 'Pacific Ventures Group' },
      occurred_at: daysAgo(30),
    },
    {
      org_id: ORG_ID,
      block_id: bPacific.id,
      type: 'onboarding.initiated',
      actor_id: DEMO_USER,
      actor_type: 'human',
      payload: { initiated_by: 'David Tan', channel: 'conference_meeting' },
      occurred_at: daysAgo(29),
    },
    {
      org_id: ORG_ID,
      block_id: bPacific.id,
      type: 'document.generated',
      actor_id: AI_SYS,
      actor_type: 'ai',
      payload: { template: 'Investment Proposal', format: 'pdf', pages: 6 },
      occurred_at: daysAgo(25),
    },
    // Compliance framework events
    {
      org_id: ORG_ID,
      block_id: bCompliance.id,
      type: 'block.created',
      actor_id: SYSTEM,
      actor_type: 'system',
      payload: { block_type: 'project', name: 'ASIC Compliance Framework' },
      occurred_at: daysAgo(90),
    },
    {
      org_id: ORG_ID,
      block_id: bCompliance.id,
      type: 'compliance.review.completed',
      actor_id: DEMO_USER,
      actor_type: 'human',
      payload: { reviewer: 'Sarah Chen', outcome: 'pass', period: 'Q4 2025', findings: 0 },
      occurred_at: daysAgo(30),
    },
    // Sarah Chen contact creation
    {
      org_id: ORG_ID,
      block_id: bSarah.id,
      type: 'block.created',
      actor_id: SYSTEM,
      actor_type: 'system',
      payload: { block_type: 'contact', name: 'Sarah Chen' },
      occurred_at: daysAgo(90),
    },
  ]

  const { error: eventsErr } = await supabase.from('events').insert(eventRows)
  assert(!eventsErr, `Events insert failed: ${eventsErr?.message}`)
  console.log(`  ✓ ${eventRows.length} events`)

  // ═══════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════
  console.log(`
✅ Demo seed complete!

   Org:                ${org.name} (${ORG_ID})
   Document templates: 3  (onboarding agreement, investment proposal, compliance report)
   Brand kit:          1  (Thornfield Capital)
   Workflow templates: 2  (client onboarding flow, monthly reporting)
   Blocks:             5  (2 clients, 1 compliance framework, 1 contact, 1 SOP)
   Edges:              ${edges.length}
   Events:             ${eventRows.length} (spanning last 90 days)

   Total blocks created: 11  (3 templates + 1 brand kit + 2 workflows + 5 domain blocks)

   View data: npm run db:studio
`)
}

main().catch((err: Error) => {
  console.error('❌  Demo seed failed:', err.message)
  process.exit(1)
})
