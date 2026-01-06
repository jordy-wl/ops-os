import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { ai_agent_config_id, action_type, target_object_type, target_object_id, user_id } = await req.json();

  if (!ai_agent_config_id || !action_type || !target_object_type) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get AI agent configuration
  const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
    id: ai_agent_config_id 
  });

  if (agentConfigs.length === 0) {
    return Response.json({ 
      allowed: false, 
      reason: 'AI agent not found' 
    }, { status: 404 });
  }

  const agentConfig = agentConfigs[0];

  // Check if agent is enabled
  if (!agentConfig.is_enabled) {
    return Response.json({ 
      allowed: false, 
      reason: 'AI agent is disabled' 
    });
  }

  // Get permission scopes for this agent
  const permissionScopes = await base44.asServiceRole.entities.AIPermissionScope.filter({
    ai_agent_config_id,
    object_type: target_object_type
  });

  if (permissionScopes.length === 0) {
    return Response.json({ 
      allowed: false, 
      reason: 'No permissions defined for this object type' 
    });
  }

  const scope = permissionScopes[0];

  // Map action types to permission levels
  const actionPermissionMap = {
    'read': ['read', 'write', 'execute_actions'],
    'write': ['write', 'execute_actions'],
    'create': ['write', 'execute_actions'],
    'update': ['write', 'execute_actions'],
    'delete': ['execute_actions'],
    'execute': ['execute_actions']
  };

  const requiredPermissions = actionPermissionMap[action_type] || ['execute_actions'];
  const hasPermission = requiredPermissions.includes(scope.permissions);

  if (!hasPermission) {
    // Log permission denial
    await base44.asServiceRole.entities.Event.create({
      event_type: 'permission_revoked',
      source_entity_type: 'ai_agent_config',
      source_entity_id: ai_agent_config_id,
      actor_type: 'system',
      payload: {
        action_type,
        target_object_type,
        target_object_id,
        denied_reason: 'Insufficient permissions'
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({ 
      allowed: false, 
      reason: `Agent does not have ${action_type} permission for ${target_object_type}` 
    });
  }

  // Check if user approval is required for this action
  const requiresApproval = agentConfig.requires_human_approval_for_actions;
  
  if (requiresApproval && action_type !== 'read') {
    return Response.json({ 
      allowed: true,
      requires_approval: true,
      message: 'Action requires human approval before execution'
    });
  }

  // Log permission grant
  await base44.asServiceRole.entities.Event.create({
    event_type: 'permission_granted',
    source_entity_type: 'ai_agent_config',
    source_entity_id: ai_agent_config_id,
    actor_type: 'system',
    payload: {
      action_type,
      target_object_type,
      target_object_id
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    allowed: true,
    requires_approval: false
  });
});