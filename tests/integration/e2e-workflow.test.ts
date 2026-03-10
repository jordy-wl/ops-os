/**
 * tests/integration/e2e-workflow.test.ts — E2E Workflow Integration Test
 *
 * P2-S10-QA-01: Full pipeline test:
 *   1. Create workflow template with email + document generation steps
 *   2. Create source block
 *   3. Trigger workflow (advance instance through steps)
 *   4. Verify email step executes (mocked Gmail)
 *   5. Verify document generation step executes (mocked Claude)
 *   6. Verify all events recorded
 *   7. Verify workflow completes successfully
 *
 * All external services (Supabase, Gmail, Anthropic) are fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowTemplateSchema } from '@/lib/workflow/template-schema'

// ─── Mock data ────────────────────────────────────────────────────────────────

const ORG_ID = 'org_e2e_test_001'
const TEMPLATE_ID = '00000000-0000-0000-0000-template00001'
const INSTANCE_ID = '00000000-0000-0000-0000-instance00001'
const SOURCE_BLOCK_ID = '00000000-0000-0000-0000-srcblock00001'
const BRAND_KIT_ID = '00000000-0000-0000-0000-brandkit00001'
const DOC_TEMPLATE_ID = '00000000-0000-0000-0000-doctempl00001'
const CONNECTOR_ID = '00000000-0000-0000-0000-c00000000001'

const sourceBlock = {
  id: SOURCE_BLOCK_ID,
  name: 'Meridian Holdings Pty Ltd',
  type: 'client',
  state: 'active',
  metadata: {
    jurisdiction: 'AU-NSW',
    contact_email: 'ops@meridian.com.au',
    abn: '12 345 678 901',
  },
  org_id: ORG_ID,
  created_at: '2026-01-15T00:00:00.000Z',
  updated_at: '2026-03-10T00:00:00.000Z',
}

const brandKitBlock = {
  id: BRAND_KIT_ID,
  name: 'Thornfield Capital Brand Kit',
  type: 'brand_kit',
  metadata: {
    company_name: 'Thornfield Capital',
    primary_color: '#1a365d',
    secondary_color: '#2b6cb0',
    font_family: 'Inter',
    tagline: 'Strategic Capital Advisory',
    footer_content: 'Confidential — Thornfield Capital © 2026',
    header_style: { background_color: '#1a365d', text_color: '#ffffff', show_logo: false },
  },
}

const docTemplateBlock = {
  id: DOC_TEMPLATE_ID,
  name: 'Client Onboarding Agreement',
  type: 'document_template',
  metadata: {
    template_content: '# Onboarding Agreement\n\nClient: {{block.name}}\nJurisdiction: {{block.metadata.jurisdiction}}\n\nThis agreement is between {{brand.company_name}} and {{block.name}}.',
    variables: [
      { name: 'block.name', type: 'string', required: true },
      { name: 'block.metadata.jurisdiction', type: 'string', required: true },
    ],
    output_format: 'html',
    category: 'contract',
  },
}

// Workflow template with: emit_event → send_email → generate_document
const workflowTemplateMetadata = {
  applies_to_type: 'client',
  trigger: { type: 'manual' as const },
  steps: [
    { name: 'notify_start', type: 'emit_event' as const, event_type: 'onboarding.started' },
    {
      name: 'send_welcome_email',
      type: 'send_email' as const,
      connector_id: CONNECTOR_ID,
      to: 'ops@meridian.com.au',
      subject: 'Welcome to Thornfield Capital',
      body: '<p>Dear Meridian Holdings, welcome aboard.</p>',
    },
    {
      name: 'generate_agreement',
      type: 'generate_document' as const,
      template_id: DOC_TEMPLATE_ID,
      output_format: 'html',
    },
  ],
  description: 'Full client onboarding: notify → email → generate agreement',
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Track all Supabase operations for assertions
const insertedEvents: Record<string, unknown>[] = []
const insertedBlocks: Record<string, unknown>[] = []
const updatedBlocks: { id: string; metadata: Record<string, unknown> }[] = []

// Gmail mock
const gmailSendMock = vi.fn().mockResolvedValue({
  data: { id: 'gmail_msg_001', threadId: 'thread_001' },
})

// Mock Google client
vi.mock('@/lib/integrations/google-client', () => ({
  getGoogleServices: vi.fn().mockResolvedValue({
    gmail: { users: { messages: { send: gmailSendMock } } },
    calendar: {},
    drive: {},
  }),
}))

// Mock Anthropic (for AI doc generation — not used in this test but must not throw)
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '# AI Generated Document\n\nContent here.' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      },
    })),
  }
})

// Build a Supabase mock that tracks operations and returns the right data
function buildSupabaseMock() {
  insertedEvents.length = 0
  insertedBlocks.length = 0
  updatedBlocks.length = 0

  // Instance metadata evolves as steps advance
  let instanceMetadata = {
    template_id: TEMPLATE_ID,
    source_block_id: SOURCE_BLOCK_ID,
    applies_to_type: 'client',
    status: 'pending' as string,
    current_step_index: 0,
    step_results: [] as Record<string, unknown>[],
    started_at: null as string | null,
    completed_at: null as string | null,
  }

  const chainResult = (data: unknown, error: unknown = null) => ({
    data,
    error,
    select: vi.fn().mockReturnValue({ data, error, single: vi.fn().mockResolvedValue({ data, error }) }),
    single: vi.fn().mockResolvedValue({ data, error }),
  })

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, val: string) => {
          const eqChain = {
            eq: vi.fn().mockImplementation((_col2: string, val2: string) => {
              const eqChain2 = {
                eq: vi.fn().mockImplementation(() => ({
                  single: vi.fn().mockImplementation(async () => {
                    // Resolve by ID
                    if (val === INSTANCE_ID || val2 === INSTANCE_ID) {
                      return { data: { id: INSTANCE_ID, name: 'Workflow Run', metadata: { ...instanceMetadata } }, error: null }
                    }
                    if (val === TEMPLATE_ID || val2 === TEMPLATE_ID) {
                      return { data: { id: TEMPLATE_ID, metadata: workflowTemplateMetadata }, error: null }
                    }
                    if (val === SOURCE_BLOCK_ID || val2 === SOURCE_BLOCK_ID) {
                      return { data: sourceBlock, error: null }
                    }
                    if (val === DOC_TEMPLATE_ID || val2 === DOC_TEMPLATE_ID) {
                      return { data: docTemplateBlock, error: null }
                    }
                    return { data: null, error: { message: 'Not found', code: 'PGRST116' } }
                  }),
                })),
                single: vi.fn().mockImplementation(async () => {
                  if (val === INSTANCE_ID || val2 === INSTANCE_ID) {
                    return { data: { id: INSTANCE_ID, name: 'Workflow Run', metadata: { ...instanceMetadata } }, error: null }
                  }
                  if (val === TEMPLATE_ID || val2 === TEMPLATE_ID) {
                    return { data: { id: TEMPLATE_ID, metadata: workflowTemplateMetadata }, error: null }
                  }
                  if (val === SOURCE_BLOCK_ID || val2 === SOURCE_BLOCK_ID) {
                    return { data: sourceBlock, error: null }
                  }
                  if (val === DOC_TEMPLATE_ID || val2 === DOC_TEMPLATE_ID) {
                    return { data: docTemplateBlock, error: null }
                  }
                  return { data: null, error: { message: 'Not found', code: 'PGRST116' } }
                }),
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(async () => {
                    // brand_kit lookup
                    if (table === 'blocks' && val2 === 'brand_kit') {
                      return { data: brandKitBlock, error: null }
                    }
                    return { data: null, error: null }
                  }),
                }),
              }
              return eqChain2
            }),
            single: vi.fn().mockImplementation(async () => {
              if (val === INSTANCE_ID) {
                return { data: { id: INSTANCE_ID, name: 'Workflow Run', metadata: { ...instanceMetadata } }, error: null }
              }
              if (val === TEMPLATE_ID) {
                return { data: { id: TEMPLATE_ID, metadata: workflowTemplateMetadata }, error: null }
              }
              if (val === SOURCE_BLOCK_ID) {
                return { data: sourceBlock, error: null }
              }
              return { data: null, error: { message: 'Not found' } }
            }),
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                if (table === 'blocks') {
                  return { data: brandKitBlock, error: null }
                }
                return { data: null, error: null }
              }),
            }),
          }
          return eqChain
        }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
        if (table === 'events') {
          insertedEvents.push(row)
        } else if (table === 'blocks') {
          insertedBlocks.push(row)
        }
        return chainResult(row)
      }),
      update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        return {
          eq: vi.fn().mockImplementation((_col: string, val: string) => {
            if (val === INSTANCE_ID && patch.metadata) {
              instanceMetadata = patch.metadata as typeof instanceMetadata
              updatedBlocks.push({ id: val, metadata: patch.metadata as Record<string, unknown> })
            }
            return { data: null, error: null }
          }),
        }
      }),
    }
  })

  return { from: mockFrom } as unknown as ReturnType<typeof import('@/lib/supabase/server').createServerClient>
}

// Mock createServerClient to return our mock
const mockSupabase = buildSupabaseMock()

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => mockSupabase),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E Workflow: Template → Trigger → Email → Document', () => {
  it('validates the workflow template schema', () => {
    const result = WorkflowTemplateSchema.safeParse(workflowTemplateMetadata)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.steps).toHaveLength(3)
      expect(result.data.steps[0].type).toBe('emit_event')
      expect(result.data.steps[1].type).toBe('send_email')
      expect(result.data.steps[2].type).toBe('generate_document')
    }
  })

  it('template includes all required step types for E2E flow', () => {
    const stepTypes = workflowTemplateMetadata.steps.map((s) => s.type)
    expect(stepTypes).toContain('emit_event')
    expect(stepTypes).toContain('send_email')
    expect(stepTypes).toContain('generate_document')
  })

  it('full pipeline: emit_event → send_email → generate_document → complete', async () => {
    const { advanceWorkflowInstance } = await import('@/lib/workflow/step-engine')

    // Step 1: emit_event
    const step1 = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)
    expect(step1.status).toBe('advanced')
    expect(step1.step_result.step_type).toBe('emit_event')
    expect(step1.step_result.status).toBe('completed')
    expect(step1.step_result.output).toEqual({ event_type: 'onboarding.started' })

    // Verify onboarding.started event
    const onboardingEvent = insertedEvents.find((e) => e.type === 'onboarding.started')
    expect(onboardingEvent).toBeDefined()
    expect(onboardingEvent?.block_id).toBe(SOURCE_BLOCK_ID)
    expect(onboardingEvent?.org_id).toBe(ORG_ID)

    // Step 2: send_email
    const step2 = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)
    expect(step2.step_result.step_type).toBe('send_email')
    expect(step2.step_result.status).toBe('completed')

    // Verify Gmail was called
    expect(gmailSendMock).toHaveBeenCalledTimes(1)
    const callArg = gmailSendMock.mock.calls[0][0]
    expect(callArg.userId).toBe('me')
    const rawEmail = Buffer.from(callArg.requestBody.raw, 'base64url').toString()
    expect(rawEmail).toContain('To: ops@meridian.com.au')
    expect(rawEmail).toContain('Subject: Welcome to Thornfield Capital')
    expect(rawEmail).toContain('Dear Meridian Holdings')

    // Verify email.sent event
    const emailEvent = insertedEvents.find((e) => e.type === 'email.sent')
    expect(emailEvent).toBeDefined()
    expect(emailEvent?.payload).toEqual(
      expect.objectContaining({
        to: 'ops@meridian.com.au',
        subject: 'Welcome to Thornfield Capital',
      })
    )

    // Step 3: generate_document (final step)
    const step3 = await advanceWorkflowInstance(INSTANCE_ID, ORG_ID)
    expect(step3.step_result.step_type).toBe('generate_document')
    expect(step3.step_result.status).toBe('completed')
    expect(step3.status).toBe('completed')
    expect(step3.instance_status).toBe('done')

    // Verify document.generated event
    const docEvent = insertedEvents.find((e) => e.type === 'document.generated')
    expect(docEvent).toBeDefined()
    expect(docEvent?.payload).toEqual(
      expect.objectContaining({
        source_block_id: SOURCE_BLOCK_ID,
        template_id: DOC_TEMPLATE_ID,
      })
    )

    // Verify workflow.instance.completed event
    const completionEvent = insertedEvents.find((e) => e.type === 'workflow.instance.completed')
    expect(completionEvent).toBeDefined()
    expect(completionEvent?.block_id).toBe(INSTANCE_ID)
    expect(completionEvent?.payload).toEqual(
      expect.objectContaining({
        template_id: TEMPLATE_ID,
        source_block_id: SOURCE_BLOCK_ID,
        step_count: 3,
      })
    )

    // Verify all step events recorded
    const stepEvents = insertedEvents.filter(
      (e) => e.type === 'workflow.step.completed'
    )
    expect(stepEvents).toHaveLength(3)

    // Verify instance metadata was updated
    expect(updatedBlocks.length).toBeGreaterThan(0)
    const lastUpdate = updatedBlocks[updatedBlocks.length - 1]
    expect(lastUpdate.id).toBe(INSTANCE_ID)
    expect(lastUpdate.metadata).toHaveProperty('step_results')
  })
})

// ─── Template rendering integration ──────────────────────────────────────────

describe('Document rendering integration', () => {
  it('renderDocument resolves block variables and applies brand kit', async () => {
    const { renderDocument } = await import('@/lib/documents/renderer')
    const { buildVariableMap } = await import('@/lib/documents/renderer')

    const template = {
      id: DOC_TEMPLATE_ID,
      name: 'Client Onboarding Agreement',
      metadata: {
        template_content: docTemplateBlock.metadata.template_content,
      },
    }

    const source = {
      id: sourceBlock.id,
      name: sourceBlock.name,
      type: sourceBlock.type,
      state: sourceBlock.state,
      metadata: sourceBlock.metadata as Record<string, unknown>,
    }

    const brandKit = brandKitBlock.metadata

    const result = renderDocument(template, source, brandKit)

    // Verify variables were interpolated
    expect(result.html).toContain('Meridian Holdings Pty Ltd')
    expect(result.html).toContain('AU-NSW')
    expect(result.html).toContain('Thornfield Capital')

    // Verify brand styling applied
    expect(result.html).toContain('#1a365d') // primary color in CSS
    expect(result.html).toContain('Inter') // font family

    // Verify no missing variables for the ones we provided
    expect(result.missingVariables).toEqual([])
  })

  it('buildVariableMap flattens block data correctly', async () => {
    const { buildVariableMap } = await import('@/lib/documents/renderer')

    const source = {
      id: sourceBlock.id,
      name: sourceBlock.name,
      type: sourceBlock.type,
      state: sourceBlock.state,
      metadata: sourceBlock.metadata as Record<string, unknown>,
    }

    const vars = buildVariableMap(source)

    expect(vars['block.name']).toBe('Meridian Holdings Pty Ltd')
    expect(vars['block.type']).toBe('client')
    expect(vars['block.state']).toBe('active')
    expect(vars['block.metadata.jurisdiction']).toBe('AU-NSW')
    expect(vars['block.metadata.contact_email']).toBe('ops@meridian.com.au')
    expect(vars['block.metadata.abn']).toBe('12 345 678 901')
  })

  it('generates valid PDF from rendered HTML', async () => {
    const { renderDocument } = await import('@/lib/documents/renderer')
    const { generatePdf } = await import('@/lib/documents/pdf')

    const template = {
      id: DOC_TEMPLATE_ID,
      name: 'Test Template',
      metadata: { template_content: '# Test\n\nContent for {{block.name}}' },
    }

    const source = {
      id: sourceBlock.id,
      name: sourceBlock.name,
      type: sourceBlock.type,
      state: sourceBlock.state,
      metadata: sourceBlock.metadata as Record<string, unknown>,
    }

    const rendered = renderDocument(template, source, brandKitBlock.metadata)
    const pdf = generatePdf(rendered.html, { title: 'Test Document' })

    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdf.length).toBeGreaterThan(0)
    expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-')
  })
})

// ─── Email action integration ────────────────────────────────────────────────

describe('Email send action integration', () => {
  beforeEach(() => {
    insertedEvents.length = 0
    gmailSendMock.mockClear()
  })

  it('emailSendHandler sends via Gmail and records event', async () => {
    const { emailSendHandler } = await import('@/lib/actions/handlers/email-send')

    const payload = {
      connector_id: CONNECTOR_ID,
      to: 'test@example.com',
      subject: 'Integration Test',
      body: '<p>Hello from E2E test</p>',
      block_id: SOURCE_BLOCK_ID,
    }

    const ctx = {
      orgId: ORG_ID,
      userId: 'user_test',
      clerkOrgId: 'clerk_org_test',
      role: 'ops-admin' as const,
    }

    const result = await emailSendHandler.execute(payload, ctx, mockSupabase)

    expect(result.status).toBe('completed')
    expect(result.actionId).toBeDefined()

    // Gmail was called
    expect(gmailSendMock).toHaveBeenCalled()

    // Event was inserted
    const event = insertedEvents.find((e) => e.type === 'email.sent')
    expect(event).toBeDefined()
    expect(event?.payload?.to).toBe('test@example.com')
  })
})

// ─── Action registry integration ─────────────────────────────────────────────

describe('Action registry completeness', () => {
  it('all workflow step action types are registered', async () => {
    const { REGISTRY } = await import('@/lib/actions/registry')

    // These are the action types used by workflow step types
    expect(REGISTRY).toHaveProperty('email.send')
    expect(REGISTRY).toHaveProperty('meeting.book')
    expect(REGISTRY).toHaveProperty('document.generate')
    expect(REGISTRY).toHaveProperty('block.create')
  })

  it('each registered handler has schema and execute', async () => {
    const { REGISTRY } = await import('@/lib/actions/registry')

    for (const [type, handler] of Object.entries(REGISTRY)) {
      expect(handler.schema).toBeDefined()
      expect(typeof handler.execute).toBe('function')
    }
  })
})

// ─── Schema validation for new step types ────────────────────────────────────

describe('New step types schema validation', () => {
  it('accepts send_email step with all config', () => {
    const result = WorkflowTemplateSchema.safeParse({
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{
        name: 'send_email_step',
        type: 'send_email',
        connector_id: CONNECTOR_ID,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts book_meeting step', () => {
    const result = WorkflowTemplateSchema.safeParse({
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{
        name: 'book_meeting_step',
        type: 'book_meeting',
        connector_id: CONNECTOR_ID,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts generate_document step', () => {
    const result = WorkflowTemplateSchema.safeParse({
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{
        name: 'generate_doc_step',
        type: 'generate_document',
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown step type', () => {
    const result = WorkflowTemplateSchema.safeParse({
      applies_to_type: 'client',
      trigger: { type: 'manual' },
      steps: [{
        name: 'bad_step',
        type: 'send_fax',
      }],
    })
    expect(result.success).toBe(false)
  })
})
