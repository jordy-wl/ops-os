/**
 * Portal Validation — validates portal tokens and resolves portal configuration,
 * client block, and org branding for the client portal experience.
 *
 * Builds on top of the shared_links token validation system.
 */

import { createServerClient } from '@/lib/supabase/server'
import { validateShareToken } from '@/lib/shared-links'

export interface PortalConfig {
  id: string
  org_id: string
  client_block_id: string
  shared_link_id: string
  name: string
  dashboard_enabled: boolean
  documents_enabled: boolean
  requests_enabled: boolean
  forms_enabled: boolean
  exposed_block_types: string[]
  exposed_block_ids: string[] | null
  branding_overrides: Record<string, unknown> | null
  is_active: boolean
}

export interface PortalBranding {
  org_name: string
  logo_url?: string
  primary_color?: string
}

export type PortalValidationResult =
  | {
      valid: true
      portalConfig: PortalConfig
      clientBlock: Record<string, unknown>
      branding: PortalBranding | null
    }
  | {
      valid: false
      reason: string
    }

/**
 * Validate a portal token and return the portal config, client block, and branding.
 *
 * Flow:
 * 1. Validate the underlying shared_link token (existence, expiry, active)
 * 2. Confirm share_type is 'portal'
 * 3. Load the portal_configuration linked to this shared_link
 * 4. Load the client block
 * 5. Resolve org branding from brand_kit block (with overrides)
 */
export async function validatePortalToken(token: string): Promise<PortalValidationResult> {
  // Step 1: Validate the underlying shared_link token
  const linkResult = await validateShareToken(token)
  if (!linkResult.valid) {
    return { valid: false, reason: linkResult.reason }
  }

  const link = linkResult.link

  // Step 2: Confirm this is a portal link
  if (link.share_type !== 'portal') {
    return { valid: false, reason: 'Not a portal link' }
  }

  const supabase = createServerClient()

  // Step 3: Fetch portal config linked to this shared_link
  const { data: config, error: configError } = await supabase
    .from('portal_configurations')
    .select('*')
    .eq('shared_link_id', link.id)
    .eq('is_active', true)
    .single()

  if (configError || !config) {
    return { valid: false, reason: 'Portal configuration not found or inactive' }
  }

  // Step 4: Fetch client block
  const { data: clientBlock } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', config.client_block_id)
    .single()

  if (!clientBlock) {
    return { valid: false, reason: 'Client record not found' }
  }

  // Step 5: Fetch org branding from brand_kit block
  let branding: PortalBranding | null = null
  const { data: brandKit } = await supabase
    .from('blocks')
    .select('metadata')
    .eq('org_id', config.org_id)
    .eq('type', 'brand_kit')
    .limit(1)
    .single()

  if (brandKit?.metadata) {
    const meta = brandKit.metadata as Record<string, unknown>
    branding = {
      org_name: (meta.company_name as string) ?? '',
      logo_url: meta.logo_url as string | undefined,
      primary_color: meta.primary_color as string | undefined,
    }
  }

  // Apply branding overrides from portal config if set
  if (config.branding_overrides && branding) {
    const overrides = config.branding_overrides as Record<string, unknown>
    if (overrides.org_name) branding.org_name = overrides.org_name as string
    if (overrides.logo_url) branding.logo_url = overrides.logo_url as string
    if (overrides.primary_color) branding.primary_color = overrides.primary_color as string
  }

  return {
    valid: true,
    portalConfig: {
      id: config.id,
      org_id: config.org_id,
      client_block_id: config.client_block_id,
      shared_link_id: config.shared_link_id,
      name: config.name,
      dashboard_enabled: config.dashboard_enabled,
      documents_enabled: config.documents_enabled,
      requests_enabled: config.requests_enabled,
      forms_enabled: config.forms_enabled,
      exposed_block_types: config.exposed_block_types ?? [],
      exposed_block_ids: config.exposed_block_ids ?? null,
      branding_overrides: config.branding_overrides ?? null,
      is_active: config.is_active,
    },
    clientBlock: clientBlock as Record<string, unknown>,
    branding,
  }
}
