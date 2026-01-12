import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stage_instance_id } = await req.json();

    if (!stage_instance_id) {
      return Response.json({ error: 'Missing stage_instance_id' }, { status: 400 });
    }

    // Fetch the stage instance
    const stages = await base44.asServiceRole.entities.StageInstance.filter({ 
      id: stage_instance_id 
    });
    const stage = stages[0];

    if (!stage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 });
    }

    if (stage.status === 'completed') {
      return Response.json({ error: 'Stage already completed' }, { status: 400 });
    }

    // Update stage status
    await base44.asServiceRole.entities.StageInstance.update(stage_instance_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress_percentage: 100
    });

    // Generate rolling summary for this stage
    const summaryResponse = await base44.asServiceRole.functions.invoke('generateStageSummary', {
      stage_instance_id
    });

    // Publish stage_completed event
    const stageCompletedEvent = await base44.asServiceRole.entities.Event.create({
      event_type: 'stage_completed',
      source_entity_type: 'stage_instance',
      source_entity_id: stage_instance_id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        workflow_instance_id: stage.workflow_instance_id,
        stage_name: stage.name
      },
      occurred_at: new Date().toISOString()
    });

    // Trigger AI Operator monitoring
    base44.asServiceRole.functions.invoke('aiOperatorMonitor', { 
      event_id: stageCompletedEvent.id 
    }).catch(err => console.error('AI Operator trigger failed:', err));

    // Check if this was the last stage in the workflow
    const allStages = await base44.asServiceRole.entities.StageInstance.filter({
      workflow_instance_id: stage.workflow_instance_id
    });
    const allCompleted = allStages.every(s => s.status === 'completed');

    if (allCompleted) {
      // Complete the entire workflow
      await base44.asServiceRole.functions.invoke('completeWorkflow', {
        workflow_instance_id: stage.workflow_instance_id
      });
    }

    return Response.json({
      success: true,
      stage,
      summary: summaryResponse.data,
      workflow_completed: allCompleted
    });

  } catch (error) {
    console.error('Complete Stage Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});