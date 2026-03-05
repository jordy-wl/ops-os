/**
 * System block type definitions — seeded per-org on first provision.
 * These types are `is_system = true` and cannot be deleted by users.
 */
export const SYSTEM_BLOCK_TYPES = [
  {
    type_name: 'client',
    display_name: 'Client',
    description: 'A client entity — company or individual your firm services.',
    icon: 'building',
    color: 'blue',
    field_schema: {
      type: 'object',
      properties: {
        jurisdiction: {
          type: 'string',
          enum: ['AU', 'US', 'GB', 'SG', 'HK', 'NZ', 'JP', 'DE', 'FR', 'CA'],
          description: 'Primary jurisdiction (ISO 3166-1 alpha-2)',
        },
        entity_type: {
          type: 'string',
          enum: ['individual', 'company', 'trust', 'partnership', 'government'],
          description: 'Legal entity classification',
        },
        incorporation_date: {
          type: 'string',
          description: 'Date of incorporation (YYYY-MM-DD)',
        },
      },
    },
  },
  {
    type_name: 'deal',
    display_name: 'Deal',
    description: 'A business deal or opportunity being tracked.',
    icon: 'handshake',
    color: 'green',
    field_schema: {
      type: 'object',
      properties: {
        deal_value: {
          type: 'number',
          minimum: 0,
          description: 'Deal value in base currency',
        },
        stage: {
          type: 'string',
          enum: ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
          description: 'Current deal stage',
        },
        expected_close: {
          type: 'string',
          description: 'Expected close date (YYYY-MM-DD)',
        },
      },
    },
  },
  {
    type_name: 'project',
    display_name: 'Project',
    description: 'A project or engagement being delivered.',
    icon: 'folder',
    color: 'purple',
    field_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'],
          description: 'Project status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Priority level',
        },
        due_date: {
          type: 'string',
          description: 'Due date (YYYY-MM-DD)',
        },
      },
    },
  },
  {
    type_name: 'contact',
    display_name: 'Contact',
    description: 'A person associated with a client or deal.',
    icon: 'user',
    color: 'gray',
    field_schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Role or title',
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
      },
    },
  },
  {
    type_name: 'contract',
    display_name: 'Contract',
    description: 'A legal contract or agreement.',
    icon: 'file-text',
    color: 'amber',
    field_schema: {
      type: 'object',
      properties: {
        contract_type: {
          type: 'string',
          enum: ['service_agreement', 'nda', 'sow', 'msa', 'amendment', 'addendum'],
          description: 'Type of contract',
        },
        effective_date: {
          type: 'string',
          description: 'Effective date (YYYY-MM-DD)',
        },
        expiry_date: {
          type: 'string',
          description: 'Expiry date (YYYY-MM-DD)',
        },
        value: {
          type: 'number',
          minimum: 0,
          description: 'Contract value in base currency',
        },
      },
    },
  },
] as const
