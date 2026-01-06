import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_instance_id, field_values = {} } = await req.json();

  if (!task_instance_id) {
    return Response.json({ error: 'Missing task_instance_id' }, { status: 400 });
  }

  // Get the task instance
  const taskInstances = await base44.entities.TaskInstance.filter({ id: task_instance_id });
  if (taskInstances.length === 0) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }
  const task = taskInstances[0];

  // Get task template to understand field mappings
  const taskFieldMappings = await base44.entities.TaskFieldMapping.filter({
    task_template_id: task.task_template_id
  });

  // Process field values and enrich client record
  const enrichmentResults = [];
  
  for (const mapping of taskFieldMappings) {
    const fieldDef = await base44.entities.FieldDefinition.filter({ id: mapping.field_definition_id });
    if (fieldDef.length === 0) continue;

    const fieldCode = fieldDef[0].code;
    const fieldValue = field_values[fieldCode];

    if (fieldValue !== undefined && mapping.mode === 'write') {
      // Create or update FieldValue for the client
      const existingValues = await base44.entities.FieldValue.filter({
        object_type: 'client',
        object_id: task.client_id,
        field_definition_id: mapping.field_definition_id
      });

      if (existingValues.length > 0) {
        await base44.asServiceRole.entities.FieldValue.update(existingValues[0].id, {
          value: { data: fieldValue },
          source_task_instance_id: task_instance_id,
          source_type: 'user_input'
        });
      } else {
        await base44.asServiceRole.entities.FieldValue.create({
          object_type: 'client',
          object_id: task.client_id,
          field_definition_id: mapping.field_definition_id,
          value: { data: fieldValue },
          source_task_instance_id: task_instance_id,
          source_type: 'user_input'
        });
      }

      enrichmentResults.push({
        field: fieldDef[0].name,
        value: fieldValue
      });

      // Publish FIELD_UPDATED event
      await base44.asServiceRole.entities.Event.create({
        event_type: 'field_updated',
        source_entity_type: 'field_value',
        source_entity_id: task.client_id,
        actor_type: 'user',
        actor_id: user.id,
        payload: {
          field_name: fieldDef[0].name,
          field_code: fieldCode,
          object_type: 'client',
          object_id: task.client_id
        },
        occurred_at: new Date().toISOString()
      });
    }
  }

  // Update task status
  await base44.asServiceRole.entities.TaskInstance.update(task_instance_id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    field_values
  });

  // Publish TASK_COMPLETED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'task_completed',
    source_entity_type: 'task_instance',
    source_entity_id: task_instance_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: {
      task_name: task.name,
      client_id: task.client_id,
      workflow_instance_id: task.workflow_instance_id,
      enriched_fields: enrichmentResults.length
    },
    occurred_at: new Date().toISOString()
  });

  // Publish CLIENT_RECORD_ENRICHED event
  if (enrichmentResults.length > 0) {
    await base44.asServiceRole.entities.Event.create({
      event_type: 'client_record_enriched',
      source_entity_type: 'client',
      source_entity_id: task.client_id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        enriched_by_task: task_instance_id,
        fields_updated: enrichmentResults
      },
      occurred_at: new Date().toISOString()
    });
  }

  // Check if all tasks in deliverable are completed
  const deliverableTasks = await base44.entities.TaskInstance.filter({
    deliverable_instance_id: task.deliverable_instance_id
  });
  
  const allCompleted = deliverableTasks.every(t => t.id === task_instance_id || t.status === 'completed');

  if (allCompleted) {
    // Mark deliverable as completed
    await base44.asServiceRole.entities.DeliverableInstance.update(task.deliverable_instance_id, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });

    // Publish DELIVERABLE_COMPLETED event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'deliverable_completed',
      source_entity_type: 'deliverable_instance',
      source_entity_id: task.deliverable_instance_id,
      actor_type: 'system',
      payload: {
        workflow_instance_id: task.workflow_instance_id,
        client_id: task.client_id
      },
      occurred_at: new Date().toISOString()
    });

    // Release next deliverable tasks
    const currentDeliverable = await base44.entities.DeliverableInstance.filter({ 
      id: task.deliverable_instance_id 
    });
    
    if (currentDeliverable.length > 0) {
      const nextDeliverables = await base44.entities.DeliverableInstance.filter({
        stage_instance_id: currentDeliverable[0].stage_instance_id,
        sequence_order: currentDeliverable[0].sequence_order + 1,
        status: 'not_started'
      }, 'sequence_order', 1);

      if (nextDeliverables.length > 0) {
        const nextDel = nextDeliverables[0];
        
        await base44.asServiceRole.entities.DeliverableInstance.update(nextDel.id, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });

        // Release tasks for next deliverable
        const nextTasks = await base44.entities.TaskInstance.filter({
          deliverable_instance_id: nextDel.id
        });

        for (const nextTask of nextTasks) {
          await base44.asServiceRole.entities.Event.create({
            event_type: 'task_released',
            source_entity_type: 'task_instance',
            source_entity_id: nextTask.id,
            actor_type: 'system',
            payload: {
              task_name: nextTask.name,
              assigned_user_id: nextTask.owner_id
            },
            occurred_at: new Date().toISOString()
          });
        }
      }
    }
  }

  // Calculate workflow progress
  const allWorkflowTasks = await base44.entities.TaskInstance.filter({
    workflow_instance_id: task.workflow_instance_id
  });
  
  const completedCount = allWorkflowTasks.filter(t => t.status === 'completed').length;
  const progressPercentage = Math.round((completedCount / allWorkflowTasks.length) * 100);

  await base44.asServiceRole.entities.WorkflowInstance.update(task.workflow_instance_id, {
    progress_percentage: progressPercentage
  });

  return Response.json({ 
    success: true, 
    enriched_fields: enrichmentResults,
    progress_percentage: progressPercentage
  });
});