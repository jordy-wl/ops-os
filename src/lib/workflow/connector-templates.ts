export interface ConnectorTemplate {
  provider: string
  action: string
  label: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body_template?: string
}

export const CONNECTOR_TEMPLATES: Record<string, ConnectorTemplate[]> = {
  xero: [
    {
      provider: 'xero',
      action: 'create_invoice',
      label: 'Create Invoice',
      method: 'POST',
      path: '/api/2.0/Invoices',
      body_template:
        '{"Type":"ACCREC","Contact":{"ContactID":"{{block.xero_contact_id}}"},"LineItems":[]}',
    },
    {
      provider: 'xero',
      action: 'update_contact',
      label: 'Update Contact',
      method: 'POST',
      path: '/api/2.0/Contacts',
      body_template:
        '{"Name":"{{block.name}}","EmailAddress":"{{block.email}}"}',
    },
    {
      provider: 'xero',
      action: 'sync_payment',
      label: 'Sync Payment',
      method: 'PUT',
      path: '/api/2.0/Payments',
      body_template: '',
    },
  ],
  hubspot: [
    {
      provider: 'hubspot',
      action: 'create_deal',
      label: 'Create Deal',
      method: 'POST',
      path: '/crm/v3/objects/deals',
      body_template:
        '{"properties":{"dealname":"{{block.name}}","amount":"{{block.value}}"}}',
    },
    {
      provider: 'hubspot',
      action: 'update_contact',
      label: 'Update Contact',
      method: 'PATCH',
      path: '/crm/v3/objects/contacts/{{block.hubspot_id}}',
      body_template: '',
    },
    {
      provider: 'hubspot',
      action: 'log_activity',
      label: 'Log Activity',
      method: 'POST',
      path: '/crm/v3/objects/notes',
      body_template: '',
    },
  ],
  generic: [
    {
      provider: 'generic',
      action: 'custom',
      label: 'Custom Request',
      method: 'POST',
      path: '',
      body_template: '',
    },
  ],
}

export function getTemplatesForProvider(provider: string): ConnectorTemplate[] {
  return CONNECTOR_TEMPLATES[provider] ?? CONNECTOR_TEMPLATES.generic
}
