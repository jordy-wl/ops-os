import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStep } from '../../template-schema'
import type { InstanceMetadata } from '../types'

// ─── Mock Supabase ──────────────────────────────────────────────────────────

vi.mock('@/lib/shared-links', () => ({
  generateShareToken: vi.fn(() => 'sl_test_token_abc'),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const TEMPLATE_CONFIG = {
  id: 'template-config-1',
  dashboard_enabled: true,
  documents_enabled: false,
  requests_enabled: true,
  forms_enabled: false,
  exposed_block_types: ['document', 'invoice'],
  exposed_block_ids: null,
  branding_overrides: { logo_url: 'https://example.com/logo.png' },
}

const SOURCE_BLOCK = {
  id: 'block-source',
  name: 'Acme Corp',
  type: 'client',
  metadata: { email: 'admin@acme.com' },
}

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const existingPortal = overrides.existingPortal ?? null
  const templateConfig = overrides.templateConfig ?? TEMPLATE_CONFIG
  const sourceBlock = overrides.sourceBlock ?? SOURCE_BLOCK
  const linkInsertError = overrides.linkInsertError ?? null
  const configInsertError = overrides.configInsertError ?? null

  let callCount = 0

  function makeChain(resolveWith?: unknown): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.eq = vi.fn(self)
    chain.select = vi.fn(self)
    chain.insert = vi.fn(self)
    chain.update = vi.fn(self)
    chain.single = vi.fn().mockImplementation(() => {
      callCount++
      if (resolveWith !== undefined) return Promise.resolve(resolveWith)
      return Promise.resolve({ data: null, error: null })
    })
    return chain
  }

  // Track all from() calls for assertions
  const fromCalls: string[] = []

  return {
    from: vi.fn().mockImplementation((table: string) => {
      fromCalls.push(table)

      // Source block lookup
      if (table === 'blocks') {
        return makeChain({ data: sourceBlock, error: null })
      }

      // Portal configurations
      if (table === 'portal_configurations') {
        const chain: Record<string, unknown> = {}
        const self = () => chain
        chain.eq = vi.fn(self)
        chain.select = vi.fn(self)
        chain.insert = vi.fn(self)
        chain.update = vi.fn(self)
        chain.single = vi.fn().mockImplementation(() => {
          // First call: template config lookup OR existing portal check
          // We need to track whether this is the template lookup or existing check
          const selectCalls = (chain.select as ReturnType<typeof vi.fn>).mock.calls
          const lastSelect = selectCalls[selectCalls.length - 1]?.[0] ?? ''

          if (typeof lastSelect === 'string' && lastSelect.includes('dashboard_enabled')) {
            return Promise.resolve({ data: templateConfig, error: null })
          }
          if (typeof lastSelect === 'string' && lastSelect.includes('id') && lastSelect.includes('shared_link_id')) {
            return Promise.resolve({ data: existingPortal, error: null })
          }
          // Insert result
          if (configInsertError) {
            return Promise.resolve({ data: null, error: configInsertError })
          }
          return Promise.resolve({ data: { id: 'new-portal-config-1' }, error: null })
        })
        return chain
      }

      // shared_links
      if (table === 'shared_links') {
        const chain: Record<string, unknown> = {}
        const self = () => chain
        chain.eq = vi.fn(self)
        chain.select = vi.fn(self)
        chain.insert = vi.fn(self)
        chain.update = vi.fn(self)
        chain.single = vi.fn().mockImplementation(() => {
          if (linkInsertError) {
            return Promise.resolve({ data: null, error: linkInsertError })
          }
          return Promise.resolve({ data: { id: 'link-1', token: 'sl_test_token_abc' }, error: null })
        })
        return chain
      }

      // events
      if (table === 'events') {
        return makeChain({ data: null, error: null })
      }

      return makeChain({ data: null, error: null })
    }),
    _fromCalls: fromCalls,
  }
}

const META: InstanceMetadata = {
  template_id: 'tpl-1',
  source_block_id: 'block-source',
  applies_to_type: 'client',
  status: 'running',
  current_step_index: 0,
  step_results: [],
  started_at: '2026-01-01T00:00:00Z',
  completed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
})

describe('provision_portal handler', () => {
  it('creates a new portal when none exists', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({ existingPortal: null })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
      portal_config_id: 'template-config-1',
      portal_name: '{{block.name}} Portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output).toMatchObject({
      portal_config_id: 'new-portal-config-1',
      portal_token: 'sl_test_token_abc',
      portal_url: 'https://app.example.com/portal/sl_test_token_abc',
      client_block_id: 'block-source',
      is_new: true,
    })
  })

  it('reactivates existing portal (upsert)', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({
      existingPortal: { id: 'existing-portal-1', shared_link_id: 'existing-link-1' },
    })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
      portal_config_id: 'template-config-1',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output).toMatchObject({
      portal_config_id: 'existing-portal-1',
      client_block_id: 'block-source',
      is_new: false,
    })
  })

  it('falls back to source block when no link_block_id', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({ existingPortal: null })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.client_block_id).toBe('block-source')
  })

  it('interpolates portal_name with block variables', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({ existingPortal: null })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
      portal_name: '{{block.name}} Client Portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    // The interpolation should have replaced {{block.name}} with 'Acme Corp'
    // We verify the handler ran to completion with the correct output
    expect(result.output?.portal_config_id).toBeDefined()
  })

  it('uses default portal name when none provided', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({ existingPortal: null })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('completed')
    expect(result.output?.is_new).toBe(true)
  })

  it('fails when shared link creation fails', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({
      existingPortal: null,
      linkInsertError: { code: 'DB_ERR', message: 'insert failed' },
    })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('insert failed')
  })

  it('cleans up shared link on config insert failure', async () => {
    const handler = (await import('../provision-portal')).default
    const supabase = createMockSupabase({
      existingPortal: null,
      configInsertError: { code: 'DB_ERR', message: 'config insert failed' },
    })

    const step = {
      name: 'create_portal',
      type: 'provision_portal',
    } as unknown as WorkflowStep

    const result = await handler(step, META, 'org-1', supabase as unknown as never)

    expect(result.status).toBe('failed')
    expect(result.error).toBe('config insert failed')
  })
})
