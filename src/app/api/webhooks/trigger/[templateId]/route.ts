import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const SERVICE = 'webhook-trigger'

// CORS headers for external API consumers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

/**
 * OPTIONS /api/webhooks/trigger/[templateId]
 *
 * CORS preflight handler for external API consumers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/webhooks/trigger/[templateId]
 *
 * External API trigger endpoint. Spawns a workflow instance from a template.
 * Authentication: API key in Authorization: Bearer <key> header.
 * No Clerk auth -- this is a public endpoint authenticated via org API keys.
 *
 * Request body (optional):
 *   { source_block_id?: string, payload?: Record<string, unknown> }
 *
 * Response 201:
 *   { data: { instance_id, template_id, status: 'pending' } }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
): Promise<NextResponse> {
  const { templateId } = await context.params

  // --- 1. Extract and validate API key from Authorization header ---
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Missing or invalid Authorization header. Expected: Bearer <api_key>' } },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'API key is empty' } },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const supabase = createServerClient()

  // --- 2. Authenticate: hash key and look up in api_keys table ---
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: keyRow, error: keyError } = await supabase
    .from('api_keys')
    .select('id, org_id, revoked_at')
    .eq('key_hash', keyHash)
    .single()

  if (keyError || !keyRow) {
    logger.warn(SERVICE, 'auth.key_not_found', { key_prefix: apiKey.substring(0, 8) })
    return NextResponse.json(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Invalid API key' } },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  // Check key is active (not revoked)
  if (keyRow.revoked_at) {
    logger.warn(SERVICE, 'auth.key_revoked', { key_id: keyRow.id })
    return NextResponse.json(
      { error: { code: 'AUTHENTICATION_REQUIRED', message: 'API key has been revoked' } },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const orgId = keyRow.org_id

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {
      // intentionally empty -- fire and forget
    })

  // --- 3. Parse and validate request body ---
  let body: { source_block_id?: string; payload?: Record<string, unknown> } = {}
  try {
    const text = await request.text()
    if (text.trim()) {
      body = JSON.parse(text)
    }
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON in request body' } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Validate body shape
  if (body.source_block_id !== undefined && typeof body.source_block_id !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'source_block_id must be a string' } },
      { status: 400, headers: CORS_HEADERS }
    )
  }
  if (body.payload !== undefined && (typeof body.payload !== 'object' || body.payload === null || Array.isArray(body.payload))) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'payload must be a JSON object' } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // --- 4. Validate template exists and belongs to the same org ---
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, type, org_id, metadata')
    .eq('id', templateId)
    .single()

  if (templateError || !template) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Workflow template not found' } },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  if (template.type !== 'workflow_template') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Block is not a workflow_template' } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (template.org_id !== orgId) {
    // Template belongs to a different org -- return 404 to avoid leaking existence
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Workflow template not found' } },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  // --- 5. Validate source_block_id if provided ---
  if (body.source_block_id) {
    const { data: sourceBlock, error: sourceError } = await supabase
      .from('blocks')
      .select('id, org_id')
      .eq('id', body.source_block_id)
      .single()

    if (sourceError || !sourceBlock) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Source block not found' } },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    if (sourceBlock.org_id !== orgId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Source block not found' } },
        { status: 404, headers: CORS_HEADERS }
      )
    }
  }

  // --- 6. Spawn workflow instance ---
  const now = new Date().toISOString()
  const templateMeta = template.metadata as Record<string, unknown> | null
  const appliesToType = (templateMeta?.applies_to_type as string) ?? null

  const instanceName = `API Trigger: ${templateMeta?.description || 'Workflow'} — ${templateId.slice(0, 8)}`

  const { data: instance, error: instanceError } = await supabase
    .from('blocks')
    .insert({
      org_id: orgId,
      type: 'workflow_instance',
      name: instanceName.slice(0, 255),
      metadata: {
        template_id: templateId,
        source_block_id: body.source_block_id ?? null,
        applies_to_type: appliesToType,
        status: 'pending',
        current_step_index: 0,
        step_results: [],
        trigger_context: {
          type: 'api',
          payload: body.payload ?? null,
          triggered_at: now,
        },
      },
    })
    .select('id')
    .single()

  if (instanceError || !instance) {
    logger.error(SERVICE, 'instance.create_failed', {
      template_id: templateId,
      org_id: orgId,
      error_code: instanceError?.code,
    })
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create workflow instance' } },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  // --- 7. Create block edges ---
  const edges: Array<{
    org_id: string
    from_block_id: string
    to_block_id: string
    edge_type: string
  }> = [
    {
      org_id: orgId,
      from_block_id: instance.id,
      to_block_id: templateId,
      edge_type: 'instance_of',
    },
  ]

  if (body.source_block_id) {
    edges.push({
      org_id: orgId,
      from_block_id: instance.id,
      to_block_id: body.source_block_id,
      edge_type: 'processing',
    })
  }

  const { error: edgeError } = await supabase.from('block_edges').insert(edges)
  if (edgeError) {
    logger.warn(SERVICE, 'edges.create_failed', {
      instance_id: instance.id,
      error_code: edgeError.code,
    })
    // Non-fatal: instance is created, edges are supplementary
  }

  // --- 8. Emit workflow.instance.spawned event ---
  const { error: eventError } = await supabase.from('events').insert({
    org_id: orgId,
    block_id: instance.id,
    type: 'workflow.instance.spawned',
    actor_id: `api_key:${keyRow.id}`,
    actor_type: 'api',
    payload: {
      template_id: templateId,
      source_block_id: body.source_block_id ?? null,
      trigger_type: 'api',
      api_key_id: keyRow.id,
      spawned_at: now,
    },
  })

  if (eventError) {
    logger.warn(SERVICE, 'event.create_failed', {
      instance_id: instance.id,
      error_code: eventError.code,
    })
    // Non-fatal: instance is created, event logging is supplementary
  }

  logger.info(SERVICE, 'instance.spawned', {
    template_id: templateId,
    instance_id: instance.id,
    org_id: orgId,
    source_block_id: body.source_block_id ?? null,
    trigger: 'api',
  })

  return NextResponse.json(
    {
      data: {
        instance_id: instance.id,
        template_id: templateId,
        status: 'pending',
      },
    },
    { status: 201, headers: CORS_HEADERS }
  )
}
