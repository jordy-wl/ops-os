import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { createServerClient } from '@/lib/supabase/server'
import { evaluateEventTriggers, evaluateWebhookTriggers } from '@/lib/workflow/trigger-evaluation'

// ─── Mock DB helper ──────────────────────────────────────────────────────────
function makeDb(...responses: { data: unknown; error: unknown }[]) {
  const queue = [...responses]
  let i = 0

  const singleFn = vi.fn().mockImplementation(() =>
    Promise.resolve(queue[i++] ?? { data: null, error: null })
  )

  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: singleFn,
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(queue[i++] ?? { data: [], error: null }).then(resolve, reject),
  }

  vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)
  return { chain, singleFn }
}

const ORG_ID = 'uuid-org-1'
const BLOCK_ID = 'uuid-block-1'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('evaluateEventTriggers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('skips evaluation when actor_type is "workflow"', async () => {
    const { chain } = makeDb()

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.updated', 'workflow')

    // Should not even query templates
    expect(chain.from).not.toHaveBeenCalled()
  })

  it('skips evaluation when actor_type is "system"', async () => {
    const { chain } = makeDb()

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.updated', 'system')

    expect(chain.from).not.toHaveBeenCalled()
  })

  it('does nothing when no templates exist', async () => {
    makeDb(
      { data: [], error: null } // templates query returns empty
    )

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')
    // No error, just returns silently
  })

  it('does nothing when templates have no matching event trigger', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'manual' },  // Not an event trigger
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
      {
        id: 'tmpl-2',
        metadata: {
          applies_to_type: 'deal',  // Wrong block type
          trigger: { type: 'event', event_pattern: 'block.created' },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb(
      { data: templates, error: null } // templates query
    )

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')
    // No instance spawned — only the template query was made
  })

  it('spawns instance when event trigger matches', async () => {
    const templates = [
      {
        id: 'tmpl-match',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'event', event_pattern: 'block.created' },
          steps: [{ name: 'notify', type: 'emit_event', event_type: 'onboarding.started' }],
          description: 'Onboarding',
        },
      },
    ]
    const { chain } = makeDb(
      { data: templates, error: null },              // templates query
      { data: { id: 'inst-1' }, error: null },       // instance insert
      { data: null, error: null },                    // block_edges insert
      { data: null, error: null },                    // event insert
    )

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')

    // Verify instance was inserted
    expect(chain.insert).toHaveBeenCalled()
  })

  it('skips templates with mismatched event_pattern', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'event', event_pattern: 'block.updated' },  // Not block.created
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb(
      { data: templates, error: null }
    )

    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')
    // No instance spawned — event pattern doesn't match
  })

  it('handles template query failure gracefully', async () => {
    makeDb(
      { data: null, error: { code: 'DB_ERR' } }
    )

    // Should not throw
    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')
  })

  it('continues with other templates when one spawn fails', async () => {
    const templates = [
      {
        id: 'tmpl-fail',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'event', event_pattern: 'block.created' },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
      {
        id: 'tmpl-ok',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'event', event_pattern: 'block.created' },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb(
      { data: templates, error: null },              // templates query
      { data: null, error: { code: 'DB_ERR' } },    // first spawn fails
      { data: { id: 'inst-2' }, error: null },       // second spawn succeeds
      { data: null, error: null },                    // block_edges
      { data: null, error: null },                    // event
    )

    // Should not throw even though first spawn failed
    await evaluateEventTriggers(ORG_ID, BLOCK_ID, 'client', 'block.created', 'human')
  })
})

// ─── Webhook Trigger Tests ──────────────────────────────────────────────────

const CONNECTOR_ID = 'conn-uuid-1'

describe('evaluateWebhookTriggers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns instance when template has matching webhook trigger', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: {
            type: 'webhook',
            config: { connector_id: CONNECTOR_ID },
          },
          steps: [{ name: 'notify', type: 'emit_event', event_type: 'notification.sent' }],
        },
      },
    ]
    makeDb(
      { data: templates, error: null },          // templates query
      { data: { id: 'inst-1' }, error: null },   // instance insert
      { data: null, error: null },               // block_edges insert
      { data: null, error: null },               // event insert
    )

    const result = await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { block_id: BLOCK_ID, type: 'lead.created' },
      ORG_ID
    )

    expect(result).toBe(1)
  })

  it('returns 0 when no templates match connector_id', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: {
            type: 'webhook',
            config: { connector_id: 'other-connector' },
          },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb({ data: templates, error: null })

    const result = await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { block_id: BLOCK_ID, type: 'lead.created' },
      ORG_ID
    )

    expect(result).toBe(0)
  })

  it('skips templates with non-webhook trigger type', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: { type: 'event', event_pattern: 'block.created' },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb({ data: templates, error: null })

    const result = await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { block_id: BLOCK_ID },
      ORG_ID
    )

    expect(result).toBe(0)
  })

  it('skips when payload has no block_id', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: {
            type: 'webhook',
            config: { connector_id: CONNECTOR_ID },
          },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    makeDb({ data: templates, error: null })

    const result = await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { action: 'test', no_block_id: true },
      ORG_ID
    )

    expect(result).toBe(0)
  })

  it('applies event_type_mapping from trigger config', async () => {
    const templates = [
      {
        id: 'tmpl-1',
        metadata: {
          applies_to_type: 'client',
          trigger: {
            type: 'webhook',
            config: {
              connector_id: CONNECTOR_ID,
              event_type_mapping: { 'crm.lead.created': 'block.created' },
            },
          },
          steps: [{ name: 'step1', type: 'emit_event', event_type: 'test' }],
        },
      },
    ]
    const { chain } = makeDb(
      { data: templates, error: null },
      { data: { id: 'inst-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    )

    await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { block_id: BLOCK_ID, type: 'crm.lead.created' },
      ORG_ID
    )

    // Verify instance metadata includes mapped event type
    const insertCalls = vi.mocked(chain.insert as ReturnType<typeof vi.fn>).mock.calls
    const instanceInsert = insertCalls[0]?.[0]
    expect(instanceInsert?.metadata?.trigger_context?.mapped_event).toBe('block.created')
  })

  it('returns 0 when template query fails', async () => {
    makeDb({ data: null, error: { code: 'DB_ERR' } })

    const result = await evaluateWebhookTriggers(
      CONNECTOR_ID,
      { block_id: BLOCK_ID },
      ORG_ID
    )

    expect(result).toBe(0)
  })
})
