import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Check if an AI agent has permission to perform an action on an entity type
 * Called by AI functions before executing operations
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { agent_id, object_type, operation } = await req.json();

    if (!agent_id || !object_type || !operation) {
      return Response.json({ 
        error: 'Missing required fields: agent_id, object_type, operation' 
      }, { status: 400 });
    }

    // Fetch AI agent config
    const agents = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id, 
      is_enabled: true 
    });
    const agent = agents[0];

    if (!agent) {
      return Response.json({ 
        allowed: false,
        reason: 'AI agent not found or disabled'
      });
    }

    // Fetch permission scopes for this agent
    const permissions = await base44.asServiceRole.entities.AIPermissionScope.filter({ 
      agent_id,
      object_type
    });

    if (permissions.length === 0) {
      return Response.json({ 
        allowed: false,
        reason: `No permissions defined for ${agent_id} on ${object_type}`
      });
    }

    // Check if the operation is allowed
    const permission = permissions[0];
    const operationMap = {
      'read': permission.can_read,
      'create': permission.can_create,
      'update': permission.can_update,
      'delete': permission.can_delete,
      'execute_action': permission.can_execute_actions
    };

    const isAllowed = operationMap[operation.toLowerCase()] || false;

    return Response.json({
      allowed: isAllowed,
      reason: isAllowed ? 'Permission granted' : `Operation '${operation}' not permitted`,
      agent_name: agent.name,
      agent_role: agent.role
    });

  } catch (error) {
    console.error('Check AI Permission Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});