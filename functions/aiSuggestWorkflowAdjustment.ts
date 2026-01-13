import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflow_instance_id } = await req.json();

    if (!workflow_instance_id) {
      return Response.json({ error: 'workflow_instance_id required' }, { status: 400 });
    }

    console.log('Analyzing workflow for dynamic adjustments:', workflow_instance_id);

    // Fetch workflow instance
    const [workflow] = await base44.asServiceRole.entities.WorkflowInstance.filter({ id: workflow_instance_id });
    
    if (!workflow) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Fetch all tasks in this workflow
    const tasks = await base44.asServiceRole.entities.TaskInstance.filter(
      { workflow_instance_id },
      'sequence_order',
      100
    );

    // Fetch recent events
    const events = await base44.asServiceRole.entities.Event.filter(
      { 
        source_entity_type: { $in: ['workflow_instance', 'task_instance'] },
        source_entity_id: { $in: [workflow_instance_id, ...tasks.map(t => t.id)] }
      },
      '-occurred_at',
      100
    );

    // Analyze patterns
    const blockedTasks = tasks.filter(t => t.status === 'blocked');
    const overdueTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
    );
    const failedTasks = events.filter(e => e.event_type === 'task_failed');
    const reassignments = events.filter(e => e.event_type === 'task_reassigned');

    // Calculate completion rate
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    // Calculate average task duration vs estimated
    const taskDurations = tasks
      .filter(t => t.status === 'completed' && t.started_at && t.completed_at)
      .map(t => {
        const actual = (new Date(t.completed_at) - new Date(t.started_at)) / (1000 * 60 * 60);
        return {
          task_id: t.id,
          actual_hours: actual,
          estimated_hours: t.estimated_duration_minutes / 60
        };
      });

    const avgOverrun = taskDurations.length > 0
      ? taskDurations.reduce((sum, t) => sum + (t.actual_hours - (t.estimated_hours || t.actual_hours)), 0) / taskDurations.length
      : 0;

    console.log('Invoking LLM for workflow adjustment suggestions...');

    const prompt = `You are an AI workflow optimization specialist analyzing a workflow in progress and suggesting dynamic adjustments.

Workflow Status:
- ID: ${workflow.id}
- Status: ${workflow.status}
- Progress: ${workflow.progress_percentage}%
- Started: ${workflow.started_at}
- Expected Completion: ${workflow.expected_completion_date || 'Not set'}

Task Analysis:
- Total Tasks: ${tasks.length}
- Completed: ${completedTasks} (${Math.round(completionRate)}%)
- Blocked: ${blockedTasks.length}
- Overdue: ${overdueTasks.length}
- Average Time Overrun: ${Math.round(avgOverrun * 10) / 10} hours

Recent Issues:
- Task Failures: ${failedTasks.length}
- Reassignments: ${reassignments.length}

Blocked Tasks Details:
${blockedTasks.slice(0, 5).map(t => `- ${t.name}: ${t.blocked_reason || 'Unknown reason'}`).join('\n') || 'None'}

Based on this analysis, suggest dynamic workflow adjustments that could:
1. Unblock stuck tasks
2. Parallelize sequential work to save time
3. Add buffer tasks or checkpoints for quality
4. Skip non-critical tasks if timeline is at risk
5. Escalate or add resources where needed

Each suggestion should:
- Be specific and actionable
- Include clear reasoning based on data
- Estimate impact on timeline/quality
- Indicate required approvals (user, team lead, admin)

Only suggest adjustments if there are clear issues. If workflow is progressing well, state that no changes are needed.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          requires_adjustment: { type: 'boolean' },
          overall_assessment: { type: 'string' },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                adjustment_type: {
                  type: 'string',
                  enum: ['add_task', 'remove_task', 'parallelize', 'reassign', 'add_checkpoint', 'escalate', 'adjust_deadline']
                },
                title: { type: 'string' },
                description: { type: 'string' },
                reasoning: { type: 'string' },
                impact_on_timeline: { type: 'string' },
                impact_on_quality: { type: 'string' },
                requires_approval_level: { 
                  type: 'string',
                  enum: ['user', 'team_lead', 'department_head', 'admin']
                },
                affected_entities: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    });

    // Log AI action
    await base44.asServiceRole.entities.AIAuditLog.create({
      agent_id: 'workflow_adjustment_ai',
      action_type: 'suggest_adjustment',
      object_type: 'workflow_instance',
      object_id: workflow_instance_id,
      input_data: { 
        workflow_instance_id,
        completion_rate: completionRate,
        blocked_count: blockedTasks.length 
      },
      output_data: aiResponse,
      user_id: user.id,
      timestamp: new Date().toISOString(),
      was_approved: null,
    });

    console.log('Workflow adjustment suggestions generated');

    return Response.json({
      success: true,
      requires_adjustment: aiResponse.requires_adjustment,
      overall_assessment: aiResponse.overall_assessment,
      suggestions: aiResponse.suggestions || [],
    });

  } catch (error) {
    console.error('Error suggesting workflow adjustments:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});