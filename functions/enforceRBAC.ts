import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { 
    action, 
    resource_type, 
    resource_id, 
    check_ownership = true 
  } = await req.json();

  if (!action || !resource_type) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Admin bypass
  if (user.role === 'admin') {
    return Response.json({ 
      allowed: true, 
      reason: 'Admin has full access' 
    });
  }

  // Action-based permissions
  const actionRules = {
    'create_workflow_template': ['admin'],
    'modify_workflow_template': ['admin'],
    'delete_workflow_template': ['admin'],
    'create_ai_agent': ['admin'],
    'modify_ai_agent': ['admin'],
    'execute_strategy_action': ['admin', 'user'],
    'create_client': ['admin', 'user'],
    'modify_client': ['admin', 'user'],
    'view_audit_logs': ['admin'],
    'manage_permissions': ['admin']
  };

  const allowedRoles = actionRules[action];
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return Response.json({ 
      allowed: false, 
      reason: `Role ${user.role} cannot perform ${action}` 
    });
  }

  // Resource ownership check
  if (check_ownership && resource_id) {
    let resource;
    
    try {
      switch (resource_type) {
        case 'workflow_instance':
          const workflows = await base44.entities.WorkflowInstance.filter({ id: resource_id });
          resource = workflows[0];
          break;
        case 'task_instance':
          const tasks = await base44.entities.TaskInstance.filter({ id: resource_id });
          resource = tasks[0];
          break;
        case 'client':
          const clients = await base44.entities.Client.filter({ id: resource_id });
          resource = clients[0];
          break;
        case 'strategy_space':
          const spaces = await base44.entities.StrategySpace.filter({ id: resource_id });
          resource = spaces[0];
          break;
      }

      if (resource) {
        // Check ownership
        const isOwner = (resource.owner_id === user.id && resource.owner_type === 'user') ||
                       resource.assigned_user_id === user.id ||
                       resource.created_by === user.id;

        // Check team membership
        let isTeamMember = false;
        if (resource.owner_type === 'team' && resource.owner_id) {
          const userTeams = await base44.entities.UserTeam.filter({ user_id: user.id });
          isTeamMember = userTeams.some(ut => ut.team_id === resource.owner_id);
        }

        // Check strategy space participation
        let isParticipant = false;
        if (resource_type === 'strategy_space') {
          isParticipant = resource.participants?.includes(user.id);
        }

        if (!isOwner && !isTeamMember && !isParticipant) {
          return Response.json({ 
            allowed: false, 
            reason: 'User does not have access to this resource' 
          });
        }
      }
    } catch (error) {
      return Response.json({ 
        allowed: false, 
        reason: `Error checking ownership: ${error.message}` 
      });
    }
  }

  // Log access grant
  await base44.asServiceRole.entities.Event.create({
    event_type: 'permission_granted',
    source_entity_type: resource_type,
    source_entity_id: resource_id || 'system',
    actor_type: 'user',
    actor_id: user.id,
    payload: { action },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    allowed: true 
  });
});