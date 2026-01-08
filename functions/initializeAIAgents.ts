import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Initialize default AI agent configurations and permissions
 * Run this once to set up the AI agent system
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can initialize AI agents
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const createdAgents = [];
    const createdPermissions = [];

    // 1. The Strategist Agent
    const strategistExists = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id: 'strategist' 
    });

    if (strategistExists.length === 0) {
      const strategist = await base44.asServiceRole.entities.AIAgentConfig.create({
        agent_id: 'strategist',
        name: 'The Strategist',
        role: 'strategic_command_center',
        description: 'Monitors system state, identifies bottlenecks, proposes strategic actions',
        is_enabled: true,
        config_jsonb: {
          context_sources: ['workflows', 'clients', 'templates', 'tasks'],
          allowed_action_types: [
            'CREATE_WORKFLOW',
            'UPDATE_CLIENT_FIELD',
            'GENERATE_REPORT',
            'CREATE_TASK',
            'PROPOSE_TEMPLATE_CHANGE'
          ],
          safety_guardrails: {
            require_approval_for: ['PROPOSE_TEMPLATE_CHANGE', 'UPDATE_CLIENT_FIELD'],
            max_actions_per_response: 5,
            forbidden_operations: ['DELETE']
          },
          retrieval_config: {
            max_workflows: 50,
            max_clients: 50,
            include_summary_history: true
          }
        }
      });
      createdAgents.push(strategist);

      // Permissions for Strategist
      const strategistPerms = [
        { object_type: 'client', can_read: true, can_update: true },
        { object_type: 'workflow_instance', can_read: true },
        { object_type: 'strategy_action', can_read: true, can_create: true, can_execute_actions: true },
        { object_type: 'report_instance', can_read: true, can_create: true },
        { object_type: 'task_instance', can_read: true, can_create: true }
      ];

      for (const perm of strategistPerms) {
        const p = await base44.asServiceRole.entities.AIPermissionScope.create({
          agent_id: 'strategist',
          ...perm
        });
        createdPermissions.push(p);
      }
    }

    // 2. The Architect Agent
    const architectExists = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id: 'architect' 
    });

    if (architectExists.length === 0) {
      const architect = await base44.asServiceRole.entities.AIAgentConfig.create({
        agent_id: 'architect',
        name: 'The Architect',
        role: 'workflow_template_builder',
        description: 'Generates and refines workflow templates from natural language',
        is_enabled: true,
        config_jsonb: {
          context_sources: ['templates', 'best_practices'],
          allowed_action_types: ['CREATE_TEMPLATE', 'UPDATE_TEMPLATE'],
          safety_guardrails: {
            require_approval_for: ['CREATE_TEMPLATE'],
            max_stages_per_workflow: 20,
            max_tasks_per_deliverable: 15
          }
        }
      });
      createdAgents.push(architect);

      const architectPerms = [
        { object_type: 'workflow_template', can_read: true, can_create: true, can_update: true },
        { object_type: 'stage_template', can_read: true, can_create: true },
        { object_type: 'deliverable_template', can_read: true, can_create: true },
        { object_type: 'task_template', can_read: true, can_create: true }
      ];

      for (const perm of architectPerms) {
        const p = await base44.asServiceRole.entities.AIPermissionScope.create({
          agent_id: 'architect',
          ...perm
        });
        createdPermissions.push(p);
      }
    }

    // 3. The Drafter Agent
    const drafterExists = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id: 'drafter' 
    });

    if (drafterExists.length === 0) {
      const drafter = await base44.asServiceRole.entities.AIAgentConfig.create({
        agent_id: 'drafter',
        name: 'The Drafter',
        role: 'document_content_generator',
        description: 'Generates professional document content from templates and client data',
        is_enabled: true,
        config_jsonb: {
          context_sources: ['clients', 'workflows', 'tasks', 'deliverables'],
          allowed_action_types: ['GENERATE_DOCUMENT'],
          safety_guardrails: {
            require_human_approval: true,
            max_document_length_words: 5000
          }
        }
      });
      createdAgents.push(drafter);

      const drafterPerms = [
        { object_type: 'document_instance', can_read: true, can_create: true },
        { object_type: 'document_template', can_read: true },
        { object_type: 'client', can_read: true },
        { object_type: 'workflow_instance', can_read: true },
        { object_type: 'deliverable_instance', can_read: true }
      ];

      for (const perm of drafterPerms) {
        const p = await base44.asServiceRole.entities.AIPermissionScope.create({
          agent_id: 'drafter',
          ...perm
        });
        createdPermissions.push(p);
      }
    }

    // 4. The Operator Agent
    const operatorExists = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id: 'operator' 
    });

    if (operatorExists.length === 0) {
      const operator = await base44.asServiceRole.entities.AIAgentConfig.create({
        agent_id: 'operator',
        name: 'The Operator',
        role: 'event_monitor',
        description: 'Monitors events and proactively identifies issues and opportunities',
        is_enabled: true,
        config_jsonb: {
          context_sources: ['events', 'workflows', 'clients', 'tasks'],
          allowed_action_types: [
            'CREATE_TASK',
            'UPDATE_CLIENT_FIELD',
            'GENERATE_REPORT'
          ],
          safety_guardrails: {
            require_approval_for: ['UPDATE_CLIENT_FIELD'],
            max_actions_per_event: 3
          },
          monitored_events: [
            'workflow_instance_started',
            'stage_completed',
            'task_blocked',
            'document_generated',
            'report_generated'
          ]
        }
      });
      createdAgents.push(operator);

      const operatorPerms = [
        { object_type: 'event', can_read: true },
        { object_type: 'client', can_read: true, can_update: true },
        { object_type: 'workflow_instance', can_read: true },
        { object_type: 'task_instance', can_read: true, can_create: true },
        { object_type: 'strategy_action', can_read: true, can_create: true }
      ];

      for (const perm of operatorPerms) {
        const p = await base44.asServiceRole.entities.AIPermissionScope.create({
          agent_id: 'operator',
          ...perm
        });
        createdPermissions.push(p);
      }
    }

    return Response.json({
      success: true,
      message: 'AI agents initialized',
      agents_created: createdAgents.length,
      permissions_created: createdPermissions.length,
      agents: createdAgents.map(a => ({ id: a.agent_id, name: a.name, role: a.role }))
    });

  } catch (error) {
    console.error('Initialize AI Agents Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});