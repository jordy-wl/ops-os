import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { strategy_action_id } = await req.json();

  if (!strategy_action_id) {
    return Response.json({ error: 'Missing strategy_action_id' }, { status: 400 });
  }

  // Get the action
  const actions = await base44.entities.StrategyAction.filter({ id: strategy_action_id });
  if (actions.length === 0) {
    return Response.json({ error: 'Action not found' }, { status: 404 });
  }

  const action = actions[0];

  // Verify user has permission to execute
  if (action.status !== 'pending' && action.status !== 'approved') {
    return Response.json({ error: 'Action already executed or rejected' }, { status: 400 });
  }

  let result = {};

  // Execute based on action type
  switch (action.action_type) {
    case 'create_workflow':
      if (action.payload?.client_id && action.payload?.workflow_template_id) {
        const workflowRes = await base44.functions.invoke('startWorkflow', {
          client_id: action.payload.client_id,
          workflow_template_id: action.payload.workflow_template_id
        });
        result = workflowRes.data;
      }
      break;

    case 'update_client_field':
      if (action.payload?.client_id && action.payload?.field_code && action.payload?.value !== undefined) {
        const fieldRes = await base44.functions.invoke('updateFieldValue', {
          object_type: 'client',
          object_id: action.payload.client_id,
          field_code: action.payload.field_code,
          value: action.payload.value,
          source_type: 'ai_enriched'
        });
        result = fieldRes.data;
      }
      break;

    case 'create_task':
      if (action.payload?.workflow_instance_id && action.payload?.title) {
        const task = await base44.asServiceRole.entities.TaskInstance.create({
          workflow_instance_id: action.payload.workflow_instance_id,
          client_id: action.payload.client_id,
          name: action.payload.title,
          description: action.payload.description,
          status: 'not_started',
          priority: action.payload.priority || 'normal',
          is_ad_hoc: true,
          assigned_user_id: action.payload.assigned_user_id || user.id
        });
        result = { task };
      }
      break;

    case 'generate_document':
      if (action.payload?.document_template_id && action.payload?.client_id) {
        const docRes = await base44.functions.invoke('aiDrafterDocument', action.payload);
        result = docRes.data;
      }
      break;

    default:
      return Response.json({ 
        error: `Action type ${action.action_type} not yet implemented` 
      }, { status: 400 });
  }

  // Update action status
  await base44.asServiceRole.entities.StrategyAction.update(strategy_action_id, {
    status: 'executed',
    executed_by: 'user',
    executed_at: new Date().toISOString(),
    result
  });

  // Publish event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'strategy_action_executed',
    source_entity_type: 'strategy_action',
    source_entity_id: strategy_action_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: {
      action_type: action.action_type,
      result
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    success: true, 
    action,
    result 
  });
});