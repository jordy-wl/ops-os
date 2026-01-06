import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workflow_instance_id } = await req.json();

  if (!workflow_instance_id) {
    return Response.json({ error: 'Missing workflow_instance_id' }, { status: 400 });
  }

  // Get workflow instance
  const workflows = await base44.entities.WorkflowInstance.filter({ id: workflow_instance_id });
  if (workflows.length === 0) {
    return Response.json({ error: 'Workflow not found' }, { status: 404 });
  }

  const workflow = workflows[0];

  // Get current stage
  const currentStages = await base44.entities.StageInstance.filter({
    id: workflow.current_stage_id
  });

  if (currentStages.length === 0) {
    return Response.json({ error: 'Current stage not found' }, { status: 404 });
  }

  const currentStage = currentStages[0];

  // Check if all deliverables in current stage are completed
  const stageDeliverables = await base44.entities.DeliverableInstance.filter({
    stage_instance_id: currentStage.id
  });

  const allDeliverablesComplete = stageDeliverables.every(d => d.status === 'completed');

  if (!allDeliverablesComplete) {
    return Response.json({ 
      success: false, 
      message: 'Cannot advance: not all deliverables are completed' 
    }, { status: 400 });
  }

  // Mark current stage as completed
  await base44.asServiceRole.entities.StageInstance.update(currentStage.id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    progress_percentage: 100
  });

  // Publish STAGE_COMPLETED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'stage_completed',
    source_entity_type: 'stage_instance',
    source_entity_id: currentStage.id,
    actor_type: 'system',
    payload: {
      stage_name: currentStage.name,
      workflow_instance_id,
      client_id: workflow.client_id
    },
    occurred_at: new Date().toISOString()
  });

  // Get next stage
  const nextStages = await base44.entities.StageInstance.filter({
    workflow_instance_id,
    sequence_order: currentStage.sequence_order + 1,
    status: 'not_started'
  }, 'sequence_order', 1);

  if (nextStages.length === 0) {
    // Workflow complete
    await base44.asServiceRole.entities.WorkflowInstance.update(workflow_instance_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress_percentage: 100
    });

    await base44.asServiceRole.entities.Event.create({
      event_type: 'workflow_instance_completed',
      source_entity_type: 'workflow_instance',
      source_entity_id: workflow_instance_id,
      actor_type: 'system',
      payload: {
        client_id: workflow.client_id
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({ 
      success: true, 
      workflow_completed: true 
    });
  }

  // Start next stage
  const nextStage = nextStages[0];
  
  await base44.asServiceRole.entities.StageInstance.update(nextStage.id, {
    status: 'in_progress',
    started_at: new Date().toISOString()
  });

  // Update workflow current stage
  await base44.asServiceRole.entities.WorkflowInstance.update(workflow_instance_id, {
    current_stage_id: nextStage.id
  });

  // Publish STAGE_ENTERED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'stage_entered',
    source_entity_type: 'stage_instance',
    source_entity_id: nextStage.id,
    actor_type: 'system',
    payload: {
      stage_name: nextStage.name,
      workflow_instance_id,
      client_id: workflow.client_id
    },
    occurred_at: new Date().toISOString()
  });

  // Get and activate first deliverable
  const nextDeliverables = await base44.entities.DeliverableInstance.filter({
    stage_instance_id: nextStage.id
  }, 'sequence_order', 1);

  if (nextDeliverables.length > 0) {
    const firstDel = nextDeliverables[0];
    
    await base44.asServiceRole.entities.DeliverableInstance.update(firstDel.id, {
      status: 'in_progress',
      started_at: new Date().toISOString()
    });

    // Release tasks for first deliverable
    const delTasks = await base44.entities.TaskInstance.filter({
      deliverable_instance_id: firstDel.id
    });

    for (const delTask of delTasks) {
      await base44.asServiceRole.entities.Event.create({
        event_type: 'task_released',
        source_entity_type: 'task_instance',
        source_entity_id: delTask.id,
        actor_type: 'system',
        payload: {
          task_name: delTask.name,
          assigned_user_id: delTask.owner_id
        },
        occurred_at: new Date().toISOString()
      });
    }
  }

  return Response.json({ 
    success: true, 
    next_stage: nextStage.name,
    stage_advanced: true
  });
});