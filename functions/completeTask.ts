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

  // Get task template to understand data field definitions
  let taskTemplate = null;
  if (task.task_template_id) {
    const templates = await base44.entities.TaskTemplate.filter({ id: task.task_template_id });
    if (templates.length > 0) {
      taskTemplate = templates[0];
    }
  }

  // Process field values using data_field_definitions from TaskTemplate
  const enrichmentResults = [];
  
  if (taskTemplate && taskTemplate.data_field_definitions) {
    for (const fieldDef of taskTemplate.data_field_definitions) {
      const fieldCode = fieldDef.field_code;
      const fieldValue = field_values[fieldCode];

      if (fieldValue !== undefined && fieldDef.save_to_client_field) {
        // Update client metadata directly with the field
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

          // Publish FIELD_UPDATED event
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

    // Release next tasks/deliverables based on outcome routing
    const currentDeliverable = await base44.entities.DeliverableInstance.filter({ 
      id: task.deliverable_instance_id 
    });

    if (currentDeliverable.length > 0) {
      const currentDel = currentDeliverable[0];
      let nextDel = null;
      let nextTask = null;
      let nextStage = null;
      let shouldEndWorkflow = false;

      // Check if task has outcome-based routing
      if (outcome && taskTemplate?.conditions?.outcomes) {
        const outcomeConfig = taskTemplate.conditions.outcomes.find(o => o.outcome_name === outcome);

        if (outcomeConfig) {
          switch (outcomeConfig.action) {
            case 'skip_to_deliverable':
              // Find deliverable by target_deliverable_key (which contains stage/deliverable indices)
              if (outcomeConfig.target_deliverable_key) {
                const allDels = await base44.entities.DeliverableInstance.filter({
                  workflow_instance_id: task.workflow_instance_id
                }, 'sequence_order');

                // Filter to get the right deliverable - this is complex without direct ID mapping
                // For now, use the deliverable name to find it
                if (outcomeConfig.target_deliverable_name) {
                  nextDel = allDels.find(d => d.name === outcomeConfig.target_deliverable_name);
                }
              }
              break;

            case 'skip_to_task':
              // Find task by target_task_name
              if (outcomeConfig.target_task_name) {
                const allTasks = await base44.entities.TaskInstance.filter({
                  workflow_instance_id: task.workflow_instance_id
                });
                nextTask = allTasks.find(t => t.name === outcomeConfig.target_task_name);
              }
              break;

            case 'skip_to_stage':
              // Find stage by target_stage_name
              if (outcomeConfig.target_stage_name) {
                const allStages = await base44.entities.StageInstance.filter({
                  workflow_instance_id: task.workflow_instance_id
                }, 'sequence_order');
                nextStage = allStages.find(s => s.name === outcomeConfig.target_stage_name);
              }
              break;

            case 'end_workflow':
              shouldEndWorkflow = true;
              break;

            case 'continue':
            default:
              // Continue to next deliverable sequentially
              break;
          }
        }
      }

      // If no outcome-based routing, use sequential order
      if (!nextDel && !nextTask && !nextStage && !shouldEndWorkflow) {
        const nextDeliverables = await base44.entities.DeliverableInstance.filter({
          stage_instance_id: currentDel.stage_instance_id,
          sequence_order: currentDel.sequence_order + 1
        }, 'sequence_order', 1);

        if (nextDeliverables.length > 0 && nextDeliverables[0].status === 'not_started') {
          nextDel = nextDeliverables[0];
        }
      }

      // Handle end workflow action
      if (shouldEndWorkflow) {
        await base44.asServiceRole.entities.WorkflowInstance.update(task.workflow_instance_id, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      }
      // Handle skip to task
      else if (nextTask) {
        await base44.asServiceRole.entities.TaskInstance.update(nextTask.id, {
          status: 'in_progress'
        });
      }
      // Handle skip to stage
      else if (nextStage) {
        await base44.asServiceRole.entities.StageInstance.update(nextStage.id, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });

        // Release first deliverable of that stage
        const firstDels = await base44.entities.DeliverableInstance.filter({
          stage_instance_id: nextStage.id,
          sequence_order: 1
        });

        if (firstDels.length > 0) {
          nextDel = firstDels[0];
        }
      }
      // Handle skip to deliverable or continue
      else if (nextDel && nextDel.status === 'not_started') {
        await base44.asServiceRole.entities.DeliverableInstance.update(nextDel.id, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });

        // Release tasks for next deliverable
        const nextTasks = await base44.entities.TaskInstance.filter({
          deliverable_instance_id: nextDel.id
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
      } else {
        // No more deliverables in this stage, check if stage is complete
        const allDeliverablesInStage = await base44.entities.DeliverableInstance.filter({
          stage_instance_id: currentDel.stage_instance_id
        });
        
        const stageComplete = allDeliverablesInStage.every(d => d.status === 'completed');
        
        if (stageComplete) {
          // Mark stage as completed
          await base44.asServiceRole.entities.StageInstance.update(currentDel.stage_instance_id, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });

          // Get current stage to find next stage
          const currentStages = await base44.entities.StageInstance.filter({
            id: currentDel.stage_instance_id
          });

          if (currentStages.length > 0) {
            const currentStage = currentStages[0];
            
            // Find next stage in workflow
            const nextStages = await base44.entities.StageInstance.filter({
              workflow_instance_id: task.workflow_instance_id,
              sequence_order: currentStage.sequence_order + 1
            }, 'sequence_order', 1);

            if (nextStages.length > 0 && nextStages[0].status === 'not_started') {
              const nextStage = nextStages[0];
              
              await base44.asServiceRole.entities.StageInstance.update(nextStage.id, {
                status: 'in_progress',
                started_at: new Date().toISOString()
              });

              // Find first deliverable in next stage
              const firstDeliverables = await base44.entities.DeliverableInstance.filter({
                stage_instance_id: nextStage.id,
                sequence_order: 1
              }, 'sequence_order', 1);

              if (firstDeliverables.length > 0) {
                const firstDel = firstDeliverables[0];
                
                await base44.asServiceRole.entities.DeliverableInstance.update(firstDel.id, {
                  status: 'in_progress',
                  started_at: new Date().toISOString()
                });

                // Release tasks for first deliverable of next stage
                const firstStageTasks = await base44.entities.TaskInstance.filter({
                  deliverable_instance_id: firstDel.id
                }, 'sequence_order');

                for (const stageTask of firstStageTasks) {
                  await base44.asServiceRole.entities.TaskInstance.update(stageTask.id, {
                    status: 'not_started'
                  });
                  
                  await base44.asServiceRole.entities.Event.create({
                    event_type: 'task_released',
                    source_entity_type: 'task_instance',
                    source_entity_id: stageTask.id,
                    actor_type: 'system',
                    payload: {
                      task_name: stageTask.name,
                      assigned_user_id: stageTask.assigned_user_id
                    },
                    occurred_at: new Date().toISOString()
                  });
                }
              }
            }
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