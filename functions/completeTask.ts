import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_instance_id, field_values = {}, outcome } = await req.json();

  if (!task_instance_id) {
    return Response.json({ error: 'Missing task_instance_id' }, { status: 400 });
  }

  // Get the task instance
  const taskInstances = await base44.entities.TaskInstance.filter({ id: task_instance_id });
  if (taskInstances.length === 0) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }
  const task = taskInstances[0];

  // Get task template to understand conditions and outcomes
  let taskTemplate = null;
  if (task.task_template_id) {
    const templates = await base44.entities.TaskTemplate.filter({ id: task.task_template_id });
    if (templates.length > 0) {
      taskTemplate = templates[0];
    }
  }

  // Get workflow instance to access instance_map
  const workflows = await base44.entities.WorkflowInstance.filter({ id: task.workflow_instance_id });
  if (workflows.length === 0) {
    return Response.json({ error: 'Workflow instance not found' }, { status: 404 });
  }
  const workflowInstance = workflows[0];
  const instance_map = workflowInstance.metadata?.instance_map || { stages: {}, deliverables: {}, tasks: {} };

  // Process field values and save to client record
  const enrichmentResults = [];
  
  if (taskTemplate && taskTemplate.data_field_definitions) {
    for (const fieldDef of taskTemplate.data_field_definitions) {
      const fieldCode = fieldDef.field_code;
      const fieldValue = field_values[fieldCode];

      if (fieldValue !== undefined && fieldDef.save_to_client_field) {
        const clients = await base44.entities.Client.filter({ id: task.client_id });
        if (clients.length > 0) {
          const client = clients[0];
          const updatedMetadata = {
            ...(client.metadata || {}),
            [fieldDef.save_to_client_field]: fieldValue
          };

          await base44.asServiceRole.entities.Client.update(task.client_id, {
            metadata: updatedMetadata
          });

          enrichmentResults.push({
            field: fieldDef.field_name,
            value: fieldValue
          });

          await base44.asServiceRole.entities.Event.create({
            event_type: 'field_updated',
            source_entity_type: 'client',
            source_entity_id: task.client_id,
            actor_type: 'user',
            actor_id: user.id,
            payload: {
              field_name: fieldDef.field_name,
              field_code: fieldCode,
              object_type: 'client',
              object_id: task.client_id
            },
            occurred_at: new Date().toISOString()
          });
        }
      }
    }
  }

  // Update task status to completed
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
      outcome: outcome,
      enriched_fields: enrichmentResults.length
    },
    occurred_at: new Date().toISOString()
  });

  // Publish CLIENT_RECORD_ENRICHED event if fields were updated
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
  
  const allTasksCompleted = deliverableTasks.every(t => t.id === task_instance_id || t.status === 'completed');

  if (allTasksCompleted) {
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

    // Get current deliverable to determine next action
    const currentDeliverables = await base44.entities.DeliverableInstance.filter({
      id: task.deliverable_instance_id
    });

    if (currentDeliverables.length > 0) {
      const currentDel = currentDeliverables[0];
      let nextDelId = null;
      let nextTaskId = null;
      let nextStageId = null;
      let shouldEndWorkflow = false;

      // Check outcome-based routing
      if (outcome && taskTemplate?.conditions?.outcomes) {
        const outcomeConfig = taskTemplate.conditions.outcomes.find(o => o.outcome_name === outcome);

        if (outcomeConfig) {
          switch (outcomeConfig.action) {
            case 'skip_to_deliverable':
              if (outcomeConfig.target_deliverable_key) {
                nextDelId = instance_map.deliverables[outcomeConfig.target_deliverable_key];
              }
              break;

            case 'skip_to_task':
              if (outcomeConfig.target_task_key) {
                nextTaskId = instance_map.tasks[outcomeConfig.target_task_key];
              }
              break;

            case 'skip_to_stage':
              if (outcomeConfig.target_stage_index !== undefined) {
                const stageKey = `stage_${outcomeConfig.target_stage_index}`;
                nextStageId = instance_map.stages[stageKey];
              }
              break;

            case 'end_workflow':
              shouldEndWorkflow = true;
              break;

            case 'continue':
            default:
              break;
          }
        }
      }

      // Default behavior: sequential progression
      if (!nextDelId && !nextTaskId && !nextStageId && !shouldEndWorkflow) {
        // Find next deliverable in same stage
        const currentStageId = currentDel.stage_instance_id;
        const nextDelInStage = await base44.entities.DeliverableInstance.filter({
          stage_instance_id: currentStageId,
          sequence_order: currentDel.sequence_order + 1
        }, 'sequence_order', 1);

        if (nextDelInStage.length > 0) {
          nextDelId = nextDelInStage[0].id;
        } else {
          // No more deliverables in this stage, move to next stage
          const currentStages = await base44.entities.StageInstance.filter({
            id: currentStageId
          });

          if (currentStages.length > 0) {
            const currentStage = currentStages[0];
            const nextStageInWorkflow = await base44.entities.StageInstance.filter({
              workflow_instance_id: task.workflow_instance_id,
              sequence_order: currentStage.sequence_order + 1
            }, 'sequence_order', 1);

            if (nextStageInWorkflow.length > 0) {
              nextStageId = nextStageInWorkflow[0].id;
            }
          }
        }
      }

      // Handle different routing outcomes
      if (shouldEndWorkflow) {
        await base44.asServiceRole.entities.WorkflowInstance.update(task.workflow_instance_id, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      } else if (nextTaskId) {
        // Release specific task
        const nextTask = await base44.entities.TaskInstance.filter({ id: nextTaskId });
        if (nextTask.length > 0) {
          await base44.asServiceRole.entities.TaskInstance.update(nextTaskId, {
            status: 'in_progress'
          });

          await base44.asServiceRole.entities.Event.create({
            event_type: 'task_released',
            source_entity_type: 'task_instance',
            source_entity_id: nextTaskId,
            actor_type: 'system',
            payload: {
              task_name: nextTask[0].name,
              assigned_user_id: nextTask[0].assigned_user_id
            },
            occurred_at: new Date().toISOString()
          });
        }
      } else if (nextStageId) {
        // Release stage and its first deliverable
        await base44.asServiceRole.entities.StageInstance.update(nextStageId, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });

        const firstDelInStage = await base44.entities.DeliverableInstance.filter({
          stage_instance_id: nextStageId,
          sequence_order: 1
        });

        if (firstDelInStage.length > 0) {
          nextDelId = firstDelInStage[0].id;
        }
      }

      // Release next deliverable and its tasks
      if (nextDelId) {
        const nextDel = await base44.entities.DeliverableInstance.filter({ id: nextDelId });
        if (nextDel.length > 0 && nextDel[0].status === 'not_started') {
          await base44.asServiceRole.entities.DeliverableInstance.update(nextDelId, {
            status: 'in_progress',
            started_at: new Date().toISOString()
          });

          // Release all blocked tasks in this deliverable
              const nextTasks = await base44.entities.TaskInstance.filter({
                deliverable_instance_id: nextDelId,
                status: 'blocked'
              }, 'sequence_order');

              for (const nextTask of nextTasks) {
                await base44.asServiceRole.entities.TaskInstance.update(nextTask.id, {
                  status: 'not_started'
                });

            await base44.asServiceRole.entities.Event.create({
              event_type: 'task_released',
              source_entity_type: 'task_instance',
              source_entity_id: nextTask.id,
              actor_type: 'system',
              payload: {
                task_name: nextTask.name,
                assigned_user_id: nextTask.assigned_user_id
              },
              occurred_at: new Date().toISOString()
            });
          }
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