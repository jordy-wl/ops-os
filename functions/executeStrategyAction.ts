import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await req.json();

    if (!actionId) {
      return Response.json({ error: 'Missing actionId' }, { status: 400 });
    }

    // Fetch the action
    const actions = await base44.asServiceRole.entities.StrategyAction.filter({ id: actionId });
    const action = actions[0];

    if (!action) {
      return Response.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.status !== 'pending') {
      return Response.json({ error: 'Action already processed' }, { status: 400 });
    }

    // RBAC Check - Only admins and managers can execute certain actions
    const restrictedActions = ['CREATE_WORKFLOW', 'PROPOSE_TEMPLATE_CHANGE', 'UPDATE_CLIENT_FIELD'];
    if (restrictedActions.includes(action.action_type)) {
      if (user.app_role !== 'admin' && user.app_role !== 'manager' && user.role !== 'admin') {
        return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // AI Permission Check - Verify AI agent is allowed to propose this action type
    if (action.requested_by_user_id === 'ai_strategist' || action.requested_by_user_id?.startsWith('ai_')) {
      const permCheck = await base44.asServiceRole.functions.invoke('checkAIPermission', {
        agent_id: 'strategist',
        object_type: action.target_object_type || 'strategy_action',
        operation: 'execute_action'
      });

      if (!permCheck.data.allowed) {
        await base44.asServiceRole.entities.StrategyAction.update(action.id, {
          status: 'rejected',
          result_data: { error: 'AI permission denied: ' + permCheck.data.reason }
        });
        return Response.json({ error: 'AI permission denied' }, { status: 403 });
      }
    }

    let result;

    // Execute the action based on type
    switch (action.action_type) {
      case 'CREATE_TASK':
        result = await base44.asServiceRole.entities.TaskInstance.create({
          ...action.payload,
          created_by: user.id,
        });
        break;

      case 'UPDATE_CLIENT_FIELD':
        result = await base44.asServiceRole.entities.Client.update(
          action.payload.client_id,
          action.payload.updates
        );
        break;

      case 'GENERATE_REPORT':
        // Call report generation function
        const reportResponse = await base44.asServiceRole.functions.invoke('generateReport', action.payload);
        result = reportResponse.data;
        break;

      case 'CREATE_WORKFLOW':
        // Call workflow creation function
        const workflowResponse = await base44.asServiceRole.functions.invoke('startWorkflow', action.payload);
        result = workflowResponse.data;
        break;

      default:
        return Response.json({ error: 'Unknown action type' }, { status: 400 });
    }

    // Update action status
    await base44.asServiceRole.entities.StrategyAction.update(action.id, {
      status: 'executed',
      executed_at: new Date().toISOString(),
      executed_by: user.id,
      result_data: result,
    });

    // Create audit log
    await base44.asServiceRole.entities.AIAuditLog.create({
      ai_agent_config_id: null, // Can be linked to agent config later
      strategy_action_id: action.id,
      action_type: action.action_type,
      actor_type: 'user',
      actor_id: user.id,
      input_summary: `Executed ${action.action_type}`,
      output_summary: 'Success',
      status: 'success',
    });

    return Response.json({
      success: true,
      action,
      result,
    });

  } catch (error) {
    console.error('Execute Strategy Action Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});