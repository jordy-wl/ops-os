import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { strategy_action_id, reason } = await req.json();

  if (!strategy_action_id) {
    return Response.json({ error: 'Missing strategy_action_id' }, { status: 400 });
  }

  // Get the action
  const actions = await base44.asServiceRole.entities.StrategyAction.filter({ 
    id: strategy_action_id 
  });

  if (actions.length === 0) {
    return Response.json({ error: 'Action not found' }, { status: 404 });
  }

  const action = actions[0];

  if (action.status !== 'executed') {
    return Response.json({ 
      error: 'Can only rollback executed actions' 
    }, { status: 400 });
  }

  let rollbackResult = {};

  // Attempt rollback based on action type
  try {
    switch (action.action_type) {
      case 'create_workflow':
        if (action.result?.workflow_instance?.id) {
          // Cancel the workflow
          await base44.asServiceRole.entities.WorkflowInstance.update(
            action.result.workflow_instance.id, 
            { status: 'cancelled' }
          );
          rollbackResult.message = 'Workflow cancelled';
        }
        break;

      case 'update_client_field':
        // Would need to store previous value to rollback
        rollbackResult.message = 'Field updates cannot be auto-rolled back - manual intervention required';
        break;

      case 'create_task':
        if (action.result?.task?.id) {
          await base44.asServiceRole.entities.TaskInstance.delete(action.result.task.id);
          rollbackResult.message = 'Task deleted';
        }
        break;

      default:
        rollbackResult.message = 'No rollback handler for this action type';
    }
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }

  // Update action status
  await base44.asServiceRole.entities.StrategyAction.update(strategy_action_id, {
    status: 'rolled_back',
    result: {
      ...action.result,
      rollback_reason: reason,
      rollback_at: new Date().toISOString(),
      rollback_by: user.id,
      rollback_result: rollbackResult
    }
  });

  // Log rollback event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'strategy_action_executed',
    source_entity_type: 'strategy_action',
    source_entity_id: strategy_action_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: {
      action_type: 'rollback',
      original_action: action.action_type,
      reason
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    success: true, 
    rollback_result: rollbackResult 
  });
});