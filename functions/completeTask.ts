import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_instance_id, field_values = {}, outcome: selectedOutcomeName } = await req.json();

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

  // Evaluate conditional outcomes if a task outcome was selected
  let outcomeAction = null;
  if (selectedOutcomeName && taskTemplate?.conditions?.outcomes) {
    const selectedOutcome = taskTemplate.conditions.outcomes.find(
      o => o.outcome_name === selectedOutcomeName
    );
    if (selectedOutcome) {
      outcomeAction = selectedOutcome.action;
    }
  }

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

      // Handle conditional outcome routing
      const currentDeliverable = await base44.entities.DeliverableInstance.filter({ 
        id: task.deliverable_instance_id 
      });

      if (currentDeliverable.length > 0) {
        const currentDel = currentDeliverable[0];

        // OUTCOME-BASED ROUTING
        if (outcomeAction === 'continue') {
          // Continue to next deliverable in sequence (default behavior)
          const nextDeliverables = await base44.entities.DeliverableInstance.filter({
            stage_instance_id: currentDel.stage_instance_id,
            sequence_order: currentDel.sequence_order + 1
          }, 'sequence_order', 1);

          if (nextDeliverables.length > 0 && nextDeliverables[0].status === 'not_started') {
            const nextDel = nextDeliverables[0];
            await base44.asServiceRole.entities.DeliverableInstance.update(nextDel.id, {
              status: 'in_progress',
              started_at: new Date().toISOString()
            });

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
          }
        } else if (outcomeAction === 'skip_to_deliverable') {
          // Jump to a specific deliverable
          const selectedOutcome = taskTemplate.conditions.outcomes.find(
            o => o.outcome_name === selectedOutcomeName
          );
          if (selectedOutcome?.target_deliverable_id) {
            const targetDeliverables = await base44.entities.DeliverableInstance.filter({
              id: selectedOutcome.target_deliverable_id
            });
            if (targetDeliverables.length > 0) {
              const targetDel = targetDeliverables[0];
              await base44.asServiceRole.entities.DeliverableInstance.update(targetDel.id, {
                status: 'in_progress',
                started_at: new Date().toISOString()
              });

              const targetTasks = await base44.entities.TaskInstance.filter({
                deliverable_instance_id: targetDel.id
              }, 'sequence_order');

              for (const targetTask of targetTasks) {
                await base44.asServiceRole.entities.TaskInstance.update(targetTask.id, {
                  status: 'not_started'
                });

                await base44.asServiceRole.entities.Event.create({
                  event_type: 'task_released',
                  source_entity_type: 'task_instance',
                  source_entity_id: targetTask.id,
                  actor_type: 'system',
                  payload: {
                    task_name: targetTask.name,
                    assigned_user_id: targetTask.assigned_user_id
                  },
                  occurred_at: new Date().toISOString()
                });
              }
            }
          }
        } else if (outcomeAction === 'skip_to_stage') {
          // Jump to a specific stage
          const selectedOutcome = taskTemplate.conditions.outcomes.find(
            o => o.outcome_name === selectedOutcomeName
          );
          if (selectedOutcome?.target_stage_id) {
            const targetStages = await base44.entities.StageInstance.filter({
              id: selectedOutcome.target_stage_id
            });
            if (targetStages.length > 0) {
              const targetStage = targetStages[0];
              await base44.asServiceRole.entities.StageInstance.update(targetStage.id, {
                status: 'in_progress',
                started_at: new Date().toISOString()
              });

              const firstDeliverables = await base44.entities.DeliverableInstance.filter({
                stage_instance_id: targetStage.id,
                sequence_order: 1
              }, 'sequence_order', 1);

              if (firstDeliverables.length > 0) {
                const firstDel = firstDeliverables[0];
                await base44.asServiceRole.entities.DeliverableInstance.update(firstDel.id, {
                  status: 'in_progress',
                  started_at: new Date().toISOString()
                });

                const firstTasks = await base44.entities.TaskInstance.filter({
                  deliverable_instance_id: firstDel.id
                }, 'sequence_order');

                for (const targetTask of firstTasks) {
                  await base44.asServiceRole.entities.TaskInstance.update(targetTask.id, {
                    status: 'not_started'
                  });

                  await base44.asServiceRole.entities.Event.create({
                    event_type: 'task_released',
                    source_entity_type: 'task_instance',
                    source_entity_id: targetTask.id,
                    actor_type: 'system',
                    payload: {
                      task_name: targetTask.name,
                      assigned_user_id: targetTask.assigned_user_id
                    },
                    occurred_at: new Date().toISOString()
                  });
                }
              }
            }
          }
        } else if (outcomeAction === 'end_workflow') {
          // Mark workflow as completed
          await base44.asServiceRole.entities.WorkflowInstance.update(task.workflow_instance_id, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
        } else if (outcomeAction === 'block_workflow') {
          // Block the workflow
          await base44.asServiceRole.entities.WorkflowInstance.update(task.workflow_instance_id, {
            status: 'blocked'
          });
        } else {
          // DEFAULT: Continue to next (if no outcome was selected)
          const nextDeliverables = await base44.entities.DeliverableInstance.filter({
            stage_instance_id: currentDel.stage_instance_id,
            sequence_order: currentDel.sequence_order + 1
          }, 'sequence_order', 1);

          if (nextDeliverables.length > 0 && nextDeliverables[0].status === 'not_started') {
            const nextDel = nextDeliverables[0];
            await base44.asServiceRole.entities.DeliverableInstance.update(nextDel.id, {
              status: 'in_progress',
              started_at: new Date().toISOString()
            });

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