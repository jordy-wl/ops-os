/**
 * Auto-Register Integration Actions — Phase 4, Sprint 11
 *
 * When a new integration connector is created, this module automatically creates
 * `custom_action` blocks for the provider's known actions. These appear in the
 * workflow builder node palette automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

interface ConnectorInfo {
  id: string
  provider: string
  name: string
  config: Record<string, unknown>
}

interface ActionTemplate {
  name: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body_template?: string
}

/**
 * Known actions per provider. When a connector of this provider type is created,
 * these actions are auto-registered as custom_action blocks for the org.
 */
const PROVIDER_ACTIONS: Record<string, ActionTemplate[]> = {
  xero: [
    { name: 'Create Invoice', description: 'Create a new invoice in Xero', method: 'POST', path: 'api.xro/2.0/Invoices', body_template: '{"Type":"ACCREC","Contact":{"Name":"{{block.name}}"},"LineItems":[]}' },
    { name: 'Get Contacts', description: 'List contacts from Xero', method: 'GET', path: 'api.xro/2.0/Contacts' },
    { name: 'Create Contact', description: 'Create a new contact in Xero', method: 'POST', path: 'api.xro/2.0/Contacts', body_template: '{"Name":"{{block.name}}","EmailAddress":"{{block.email}}"}' },
    { name: 'Get Invoices', description: 'List invoices from Xero', method: 'GET', path: 'api.xro/2.0/Invoices' },
  ],
  salesforce: [
    { name: 'Create Lead', description: 'Create a new lead in Salesforce', method: 'POST', path: 'services/data/v59.0/sobjects/Lead', body_template: '{"LastName":"{{block.name}}","Company":"{{block.company}}"}' },
    { name: 'Get Accounts', description: 'List accounts from Salesforce', method: 'GET', path: 'services/data/v59.0/query?q=SELECT+Id,Name+FROM+Account' },
    { name: 'Update Contact', description: 'Update a Salesforce contact', method: 'PATCH', path: 'services/data/v59.0/sobjects/Contact/{{block.salesforce_id}}' },
  ],
  custom_api: [
    { name: 'GET Request', description: 'Send a GET request to the API', method: 'GET', path: '' },
    { name: 'POST Request', description: 'Send a POST request to the API', method: 'POST', path: '' },
  ],
}

/**
 * Auto-register known actions for a newly created connector.
 * Creates custom_action blocks that appear in the workflow palette.
 */
export async function autoRegisterIntegrationActions(
  supabase: SupabaseClient,
  orgId: string,
  connector: ConnectorInfo,
  createdBy: string
): Promise<number> {
  const templates = PROVIDER_ACTIONS[connector.provider]
  if (!templates || templates.length === 0) {
    return 0
  }

  let created = 0

  for (const template of templates) {
    const actionName = `${connector.name}: ${template.name}`

    // Check if already registered (idempotent)
    const { data: existing } = await supabase
      .from('blocks')
      .select('id')
      .eq('org_id', orgId)
      .eq('type', 'custom_action')
      .eq('name', actionName)
      .limit(1)
      .single()

    if (existing) continue

    const metadata = {
      description: template.description,
      icon: 'Globe',
      connector_id: connector.id,
      method: template.method,
      path: template.path,
      body_template: template.body_template ?? '',
      timeout_ms: 5000,
      max_retries: 1,
      category: connector.name,
      auto_registered: true,
      provider: connector.provider,
    }

    const { error } = await supabase.rpc('create_block_with_event', {
      p_org_id: orgId,
      p_type: 'custom_action',
      p_name: actionName,
      p_metadata: metadata,
      p_actor_id: createdBy,
      p_actor_type: 'system',
    })

    if (error) {
      logger.warn('auto-register', 'action.create_failed', {
        connector_id: connector.id,
        action_name: actionName,
        error_code: error.code,
      })
      continue
    }

    created++
  }

  if (created > 0) {
    logger.info('auto-register', 'actions.registered', {
      connector_id: connector.id,
      provider: connector.provider,
      count: created,
    })
  }

  return created
}
