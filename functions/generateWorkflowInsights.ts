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
      client_id, 
      date_from, 
      date_to,
      report_title 
    } = await req.json();

    console.log('Generating workflow insights...', { workflow_template_id, client_id, date_from, date_to });

    // Build query filters
    const workflowFilter = {};
    if (workflow_template_id) workflowFilter.workflow_template_id = workflow_template_id;
    if (client_id) workflowFilter.client_id = client_id;

    const eventFilter = {};
    if (date_from) eventFilter.occurred_at = { $gte: date_from };
    if (date_to) {
      eventFilter.occurred_at = { 
        ...(eventFilter.occurred_at || {}), 
        $lte: date_to 
      };
    }

    // Fetch comprehensive data
    console.log('Fetching workflow instances...');
    const workflowInstances = await base44.asServiceRole.entities.WorkflowInstance.filter(
      workflowFilter,
      '-created_date',
      100
    );

    console.log('Fetching events...');
    const events = await base44.asServiceRole.entities.Event.filter(
      eventFilter,
      '-occurred_at',
      500
    );

    console.log('Fetching communications...');
    const communications = client_id 
      ? await base44.asServiceRole.entities.CommunicationLog.filter({ client_id }, '-occurred_at', 100)
      : [];

    console.log('Fetching documents...');
    const documents = client_id
      ? await base44.asServiceRole.entities.DocumentInstance.filter({ client_id }, '-generated_at', 100)
      : [];

    // Calculate metrics
    const metrics = {
      total_workflows: workflowInstances.length,
      completed_workflows: workflowInstances.filter(w => w.status === 'completed').length,
      active_workflows: workflowInstances.filter(w => w.status === 'active').length,
      blocked_workflows: workflowInstances.filter(w => w.status === 'blocked').length,
      total_events: events.length,
      total_communications: communications.length,
      total_documents: documents.length,
    };

    // Calculate average completion time
    const completedWorkflows = workflowInstances.filter(w => w.status === 'completed' && w.started_at && w.completed_at);
    if (completedWorkflows.length > 0) {
      const totalDays = completedWorkflows.reduce((sum, w) => {
        const start = new Date(w.started_at);
        const end = new Date(w.completed_at);
        const days = (end - start) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      metrics.avg_completion_time_days = Math.round(totalDays / completedWorkflows.length * 10) / 10;
    }

    // Calculate success rate
    if (metrics.total_workflows > 0) {
      metrics.success_rate = Math.round((metrics.completed_workflows / metrics.total_workflows) * 100);
    }

    // Count blocked tasks from events
    metrics.blocked_tasks_count = events.filter(e => e.event_type === 'task_blocked').length;

    console.log('Invoking LLM for insights generation...');

    // Generate AI insights
    const prompt = `You are a business process analyst reviewing workflow execution data. Generate a comprehensive insights report.

Data Summary:
- Total Workflows: ${metrics.total_workflows}
- Completed: ${metrics.completed_workflows}
- Active: ${metrics.active_workflows}
- Blocked: ${metrics.blocked_workflows}
- Average Completion Time: ${metrics.avg_completion_time_days || 'N/A'} days
- Success Rate: ${metrics.success_rate || 'N/A'}%
- Blocked Tasks: ${metrics.blocked_tasks_count}
- Events Analyzed: ${metrics.total_events}
- Communications: ${metrics.total_communications}
- Documents Generated: ${metrics.total_documents}

Recent Events (sample):
${events.slice(0, 50).map(e => `- ${e.event_type} at ${e.occurred_at}`).join('\n')}

Workflow Instances (sample):
${workflowInstances.slice(0, 10).map(w => `- ID: ${w.id}, Status: ${w.status}, Started: ${w.started_at || 'N/A'}`).join('\n')}

Generate a detailed analysis including:
1. Overall performance assessment
2. Identified bottlenecks and issues
3. Efficiency trends
4. Quality indicators
5. Key insights with severity ratings

Provide structured output.`;

    const insightsResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          content: { type: 'string' },
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { 
                  type: 'string',
                  enum: ['bottleneck', 'efficiency', 'quality', 'timeline', 'resource', 'risk', 'opportunity']
                },
                severity: { 
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical']
                },
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
      title: report_title || `Workflow Insights Report - ${new Date().toLocaleDateString()}`,
      report_type: 'workflow_insights',
      scope: {
        workflow_template_id,
        client_id,
        date_from,
        date_to
      },
      content: insightsResponse.content,
      insights: insightsResponse.insights || [],
      metrics,
      data_sources: {
        workflows_analyzed: metrics.total_workflows,
        events_analyzed: metrics.total_events,
        communications_analyzed: metrics.total_communications,
        documents_analyzed: metrics.total_documents,
        date_range: { from: date_from, to: date_to }
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
      summary: insightsResponse.summary
    });

  } catch (error) {
    console.error('Error generating workflow insights:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});