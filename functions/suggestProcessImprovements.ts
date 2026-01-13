import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      workflow_template_id,
      lookback_days = 90,
      report_title
    } = await req.json();

    console.log('Generating process improvement suggestions...', { workflow_template_id, lookback_days });

    // Calculate date range
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - lookback_days);

    // Fetch workflow instances
    const workflowFilter = workflow_template_id 
      ? { workflow_template_id, created_date: { $gte: dateFrom.toISOString() } }
      : { created_date: { $gte: dateFrom.toISOString() } };

    console.log('Fetching workflow instances...');
    const workflowInstances = await base44.asServiceRole.entities.WorkflowInstance.filter(
      workflowFilter,
      '-created_date',
      200
    );

    // Fetch task instances from these workflows
    const workflowIds = workflowInstances.map(w => w.id);
    console.log('Fetching task instances...');
    const taskInstances = await base44.asServiceRole.entities.TaskInstance.filter(
      { workflow_instance_id: { $in: workflowIds } },
      '-created_date',
      500
    );

    // Fetch events related to these workflows
    console.log('Fetching events...');
    const events = await base44.asServiceRole.entities.Event.filter(
      { 
        source_entity_type: { $in: ['workflow_instance', 'task_instance', 'stage_instance'] },
        occurred_at: { $gte: dateFrom.toISOString() }
      },
      '-occurred_at',
      500
    );

    // Analyze patterns
    const blockedTasks = taskInstances.filter(t => t.status === 'blocked');
    const failedTasks = events.filter(e => e.event_type === 'task_failed');
    const reassignedTasks = events.filter(e => e.event_type === 'task_reassigned');
    const completedTasks = taskInstances.filter(t => t.status === 'completed' && t.started_at && t.completed_at);

    // Calculate task completion times
    const taskCompletionTimes = completedTasks.map(t => {
      const start = new Date(t.started_at);
      const end = new Date(t.completed_at);
      const hours = (end - start) / (1000 * 60 * 60);
      return {
        task_template_id: t.task_template_id,
        hours,
        task_name: t.name
      };
    });

    // Find slow tasks (tasks taking longer than average)
    const avgCompletionTime = taskCompletionTimes.reduce((sum, t) => sum + t.hours, 0) / (taskCompletionTimes.length || 1);
    const slowTasks = taskCompletionTimes.filter(t => t.hours > avgCompletionTime * 1.5);

    // Identify frequent blockers
    const blockerReasons = {};
    blockedTasks.forEach(task => {
      const reason = task.blocked_reason || 'Unknown';
      blockerReasons[reason] = (blockerReasons[reason] || 0) + 1;
    });

    // Search for relevant best practices from knowledge base
    console.log('Searching knowledge base for process improvement guidance...');
    let bestPractices = '';
    try {
      const searchResult = await base44.functions.invoke('semanticSearchKnowledge', {
        query: 'process improvement workflow optimization efficiency bottleneck resolution',
        top_k: 3,
        filter: { type: { $in: ['best_practice', 'sop', 'ai_strategy'] } }
      });

      if (searchResult.data?.results?.length > 0) {
        bestPractices = searchResult.data.results
          .map(r => `[${r.knowledge_asset.title}]\n${r.knowledge_asset.description || ''}`)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Error searching knowledge base:', error);
    }

    console.log('Invoking LLM for improvement suggestions...');

    // Generate AI recommendations
    const prompt = `You are a business process improvement consultant analyzing workflow execution patterns. Generate actionable process improvement recommendations.

Analysis Period: Last ${lookback_days} days

Data Summary:
- Workflows Analyzed: ${workflowInstances.length}
- Total Tasks: ${taskInstances.length}
- Blocked Tasks: ${blockedTasks.length}
- Failed Tasks: ${failedTasks.length}
- Reassignments: ${reassignedTasks.length}
- Average Task Completion Time: ${Math.round(avgCompletionTime * 10) / 10} hours

Identified Issues:
1. Slow Tasks (taking >50% longer than average):
${slowTasks.slice(0, 10).map(t => `   - ${t.task_name}: ${Math.round(t.hours)} hours`).join('\n') || '   None identified'}

2. Top Blocker Reasons:
${Object.entries(blockerReasons).slice(0, 5).map(([reason, count]) => `   - ${reason}: ${count} occurrences`).join('\n') || '   None identified'}

3. Recent Problem Events:
${[...failedTasks, ...events.filter(e => e.event_type === 'workflow_instance_blocked')].slice(0, 10).map(e => `   - ${e.event_type} at ${e.occurred_at}`).join('\n') || '   None identified'}

Organizational Best Practices:
${bestPractices || 'No specific best practices found in knowledge base'}

Generate:
1. A comprehensive process improvement report
2. Prioritized recommendations with:
   - Specific actions to take
   - Expected impact (efficiency gain, error reduction, etc.)
   - Implementation effort (low/medium/high)
3. Key insights about process bottlenecks
4. Opportunities for automation or optimization

Be specific and actionable. Reference data patterns observed.`;

    const improvementResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          content: { type: 'string' },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                action: { type: 'string' },
                expected_impact: { type: 'string' },
                implementation_effort: { type: 'string', enum: ['low', 'medium', 'high'] }
              }
            }
          },
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                severity: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                recommendation: { type: 'string' }
              }
            }
          }
        }
      }
    });

    console.log('Creating report instance...');

    // Create ReportInstance
    const report = await base44.asServiceRole.entities.ReportInstance.create({
      title: report_title || `Process Improvement Report - ${new Date().toLocaleDateString()}`,
      report_type: 'process_improvement',
      scope: {
        workflow_template_id,
        date_from: dateFrom.toISOString(),
        date_to: new Date().toISOString()
      },
      content: improvementResponse.content,
      recommendations: improvementResponse.recommendations || [],
      insights: improvementResponse.insights || [],
      metrics: {
        total_workflows: workflowInstances.length,
        blocked_tasks_count: blockedTasks.length,
        failed_tasks_count: failedTasks.length,
        avg_task_completion_hours: Math.round(avgCompletionTime * 10) / 10
      },
      data_sources: {
        workflows_analyzed: workflowInstances.length,
        tasks_analyzed: taskInstances.length,
        events_analyzed: events.length,
        lookback_days
      },
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      ai_model: 'gpt-4o-mini',
      status: 'final'
    });

    console.log('Report created successfully:', report.id);

    return Response.json({
      success: true,
      report,
      summary: improvementResponse.summary
    });

  } catch (error) {
    console.error('Error generating process improvements:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});