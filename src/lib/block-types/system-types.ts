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
  {
    type_name: 'workflow_template',
    display_name: 'Workflow Template',
    description: 'A reusable workflow definition with triggers, steps, and conditions.',
    icon: 'git-branch',
    color: 'indigo',
    field_schema: {
      type: 'object',
      properties: {
        applies_to_type: { type: 'string', description: 'Block type this workflow applies to' },
        trigger: { type: 'object', description: 'Trigger configuration' },
        steps: { type: 'array', description: 'Ordered list of workflow steps' },
        description: { type: 'string', description: 'Workflow description' },
      },
      required: ['applies_to_type', 'trigger', 'steps'],
    },
  },
  {
    type_name: 'workflow_instance',
    display_name: 'Workflow Instance',
    description: 'A running instance of a workflow template.',
    icon: 'play',
    color: 'cyan',
    field_schema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'ID of the workflow template block' },
        source_block_id: { type: 'string', description: 'ID of the block that triggered this workflow' },
        applies_to_type: { type: 'string', description: 'Block type this workflow processes' },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'done', 'failed'],
          description: 'Current execution status',
        },
        current_step_index: { type: 'number', description: 'Index of the current step being executed' },
        step_results: { type: 'array', description: 'Results from completed steps' },
        started_at: { type: 'string', description: 'When execution started' },
        completed_at: { type: 'string', description: 'When execution completed' },
      },
      required: ['template_id', 'source_block_id', 'status'],
    },
  },
  {
    type_name: 'task_queue_item',
    display_name: 'Task',
    description: 'A pending task created by a workflow step, assigned to a human or agent.',
    icon: 'check-square',
    color: 'orange',
    field_schema: {
      type: 'object',
      properties: {
        workflow_instance_id: { type: 'string', description: 'ID of the parent workflow instance' },
        step_name: { type: 'string', description: 'Name of the workflow step that created this task' },
        assigned_to: { type: 'string', description: 'User ID of the assignee' },
        claimed_at: { type: 'string', description: 'When the task was claimed' },
        completed_at: { type: 'string', description: 'When the task was completed' },
        status: {
          type: 'string',
          enum: ['open', 'claimed', 'completed'],
          description: 'Task status',
        },
        instructions: { type: 'string', description: 'Instructions for the task assignee' },
      },
      required: ['workflow_instance_id', 'step_name', 'status'],
    },
  },
  {
    type_name: 'document_template',
    display_name: 'Document Template',
    description: 'A reusable document template for generating contracts, proposals, or reports.',
    icon: 'file-text',
    color: 'amber',
    field_schema: {
      type: 'object',
      properties: {
        template_content: {
          type: 'string',
          description: 'Template body in HTML or Markdown with {{variable}} placeholders',
        },
        variables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name (e.g., block.name)' },
              type: { type: 'string', enum: ['string', 'number', 'date', 'currency'], description: 'Data type' },
              required: { type: 'boolean', description: 'Whether this variable must be provided' },
            },
            required: ['name', 'type'],
          },
          description: 'Variables used in this template',
        },
        output_format: {
          type: 'string',
          enum: ['pdf', 'html', 'markdown'],
          description: 'Default output format',
        },
        category: {
          type: 'string',
          enum: ['contract', 'proposal', 'nda', 'report', 'letter', 'invoice', 'other'],
          description: 'Template category',
        },
      },
      required: ['template_content'],
    },
  },
  {
    type_name: 'brand_kit',
    display_name: 'Brand Kit',
    description: 'Organisation brand identity — logo, colours, fonts, and styling for documents.',
    icon: 'palette',
    color: 'rose',
    field_schema: {
      type: 'object',
      properties: {
        logo_url: { type: 'string', description: 'URL to organisation logo' },
        primary_color: { type: 'string', description: 'Primary brand colour (hex, e.g., #1a2b3c)' },
        secondary_color: { type: 'string', description: 'Secondary brand colour (hex)' },
        font_family: { type: 'string', description: 'Font family for documents (e.g., Inter, sans-serif)' },
        header_style: {
          type: 'object',
          properties: {
            background_color: { type: 'string', description: 'Header background colour' },
            text_color: { type: 'string', description: 'Header text colour' },
            show_logo: { type: 'boolean', description: 'Whether to show logo in header' },
          },
          description: 'Document header styling',
        },
        footer_content: { type: 'string', description: 'Footer text for documents (HTML allowed)' },
        company_name: { type: 'string', description: 'Company display name' },
        tagline: { type: 'string', description: 'Company tagline or motto' },
      },
      required: ['company_name', 'primary_color'],
    },
  },
] as const
