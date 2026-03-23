import { logger } from '@/lib/logger'
import { generateShareToken } from '@/lib/shared-links'
import { interpolateTemplate, buildStepVariables } from '../step-engine'
import type { StepHandler } from './types'

/**
 * provision_portal handler — creates (or reactivates) a client portal from a template.
 *
 * Step config:
 * - portal_config_id: UUID of the template portal configuration to clone settings from
 * - link_block_id: target client block ID (defaults to source block)
 * - portal_name: name for the new portal (supports {{block.*}} interpolation)
 * - portal_expires_hours: hours until link expiry (default 8760 = 1 year)
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const templateConfigId = (stepAny.portal_config_id as string) ?? null
  const clientBlockId = (stepAny.link_block_id as string) ?? meta.source_block_id
  const rawPortalName = (stepAny.portal_name as string) ?? ''
  const expiresHours = (stepAny.portal_expires_hours as number) ?? 8760

  // Fetch source block for variable interpolation
  const { data: sourceBlock } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', meta.source_block_id)
    .single()

  const blockVars: Record<string, unknown> = sourceBlock
    ? { id: sourceBlock.id, name: sourceBlock.name, type: sourceBlock.type, ...(sourceBlock.metadata as Record<string, unknown> ?? {}) }
    : { id: meta.source_block_id }

  const contextVars: Record<string, unknown> = {
    template_id: meta.template_id,
    source_block_id: meta.source_block_id,
    applies_to_type: meta.applies_to_type,
  }

  const stepVars = buildStepVariables(meta.step_results)
  const variables = { block: blockVars, context: contextVars, steps: stepVars }

  // Interpolate portal name
  const portalName = rawPortalName
    ? interpolateTemplate(rawPortalName, variables)
    : (sourceBlock?.name ? `${sourceBlock.name} Portal` : 'Client Portal')

  // Load template settings if provided
  let templateSettings: Record<string, unknown> = {}
  if (templateConfigId) {
    const { data: templateConfig } = await supabase
      .from('portal_configurations')
      .select('dashboard_enabled, documents_enabled, requests_enabled, forms_enabled, exposed_block_types, exposed_block_ids, branding_overrides')
      .eq('id', templateConfigId)
      .eq('org_id', orgId)
      .single()

    if (templateConfig) {
      templateSettings = {
        dashboard_enabled: templateConfig.dashboard_enabled,
        documents_enabled: templateConfig.documents_enabled,
        requests_enabled: templateConfig.requests_enabled,
        forms_enabled: templateConfig.forms_enabled,
        exposed_block_types: templateConfig.exposed_block_types,
        exposed_block_ids: templateConfig.exposed_block_ids,
        branding_overrides: templateConfig.branding_overrides,
      }
    } else {
      logger.warn('step-engine', 'step.provision_portal_template_not_found', {
        portal_config_id: templateConfigId,
        org_id: orgId,
      })
    }
  }

  // Check if portal already exists for this client
  const { data: existingPortal } = await supabase
    .from('portal_configurations')
    .select('id, shared_link_id')
    .eq('org_id', orgId)
    .eq('client_block_id', clientBlockId)
    .single()

  const expiresAt = new Date(Date.now() + expiresHours * 3600000).toISOString()

  if (existingPortal) {
    // Reactivate: update settings from template, refresh link expiry
    const updateData: Record<string, unknown> = {
      name: portalName,
      is_active: true,
      ...templateSettings,
    }

    await supabase
      .from('portal_configurations')
      .update(updateData)
      .eq('id', existingPortal.id)

    // Refresh shared link expiry
    let portalToken = ''
    if (existingPortal.shared_link_id) {
      const { data: existingLink } = await supabase
        .from('shared_links')
        .select('token')
        .eq('id', existingPortal.shared_link_id)
        .single()

      if (existingLink) {
        portalToken = existingLink.token
        await supabase
          .from('shared_links')
          .update({ expires_at: expiresAt, is_active: true })
          .eq('id', existingPortal.shared_link_id)
      }
    }

    await supabase.from('events').insert({
      org_id: orgId,
      block_id: clientBlockId,
      type: 'portal_config.reactivated',
      actor_type: 'workflow',
      payload: {
        portal_config_id: existingPortal.id,
        template_config_id: templateConfigId,
        step_name: step.name,
      },
    })

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/${portalToken}`

    logger.info('step-engine', 'step.provision_portal_reactivated', {
      portal_config_id: existingPortal.id,
      client_block_id: clientBlockId,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        portal_config_id: existingPortal.id,
        portal_token: portalToken,
        portal_url: portalUrl,
        client_block_id: clientBlockId,
        is_new: false,
      },
      executed_at: now,
    }
  }

  // New portal: create shared link + portal configuration
  const token = generateShareToken()

  const { data: sharedLink, error: linkError } = await supabase
    .from('shared_links')
    .insert({
      org_id: orgId,
      block_id: clientBlockId,
      token,
      share_type: 'portal',
      permissions: {},
      form_schema: null,
      expires_at: expiresAt,
      is_active: true,
      created_by: 'workflow',
    })
    .select('id, token')
    .single()

  if (linkError || !sharedLink) {
    logger.error('step-engine', 'step.provision_portal_link_failed', { error_code: linkError?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: linkError?.message ?? 'Failed to create portal link', executed_at: now }
  }

  const { data: portalConfig, error: configError } = await supabase
    .from('portal_configurations')
    .insert({
      org_id: orgId,
      client_block_id: clientBlockId,
      name: portalName,
      shared_link_id: sharedLink.id,
      created_by: 'workflow',
      dashboard_enabled: (templateSettings.dashboard_enabled as boolean) ?? true,
      documents_enabled: (templateSettings.documents_enabled as boolean) ?? true,
      requests_enabled: (templateSettings.requests_enabled as boolean) ?? true,
      forms_enabled: (templateSettings.forms_enabled as boolean) ?? true,
      exposed_block_types: (templateSettings.exposed_block_types as string[]) ?? [],
      exposed_block_ids: (templateSettings.exposed_block_ids as string[]) ?? null,
      branding_overrides: (templateSettings.branding_overrides as Record<string, unknown>) ?? null,
    })
    .select('id')
    .single()

  if (configError || !portalConfig) {
    logger.error('step-engine', 'step.provision_portal_config_failed', { error_code: configError?.code })
    // Clean up the shared link
    await supabase.from('shared_links').update({ is_active: false }).eq('id', sharedLink.id)
    return { step_name: step.name, step_type: step.type, status: 'failed', error: configError?.message ?? 'Failed to create portal configuration', executed_at: now }
  }

  // Bidirectional link
  await supabase
    .from('shared_links')
    .update({ portal_config_id: portalConfig.id })
    .eq('id', sharedLink.id)

  // Emit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: clientBlockId,
    type: 'portal_config.created',
    actor_type: 'workflow',
    payload: {
      portal_config_id: portalConfig.id,
      template_config_id: templateConfigId,
      shared_link_id: sharedLink.id,
      step_name: step.name,
    },
  })

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/portal/${sharedLink.token}`

  logger.info('step-engine', 'step.provision_portal_created', {
    portal_config_id: portalConfig.id,
    client_block_id: clientBlockId,
  })

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: {
      portal_config_id: portalConfig.id,
      portal_token: sharedLink.token,
      portal_url: portalUrl,
      client_block_id: clientBlockId,
      is_new: true,
    },
    executed_at: now,
  }
}

export default handler
