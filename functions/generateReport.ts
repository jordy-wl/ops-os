import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, report_definition_id, report_type, parameters } = await req.json();

    if (!report_type) {
      return Response.json({ 
        error: 'Missing required field: report_type' 
      }, { status: 400 });
    }

    // If report_definition_id is provided, use it; otherwise work with ad-hoc report
    let reportDefinition = null;
    if (report_definition_id) {
      const definitions = await base44.asServiceRole.entities.ReportDefinition.filter({ 
        id: report_definition_id 
      });
      reportDefinition = definitions[0];

      if (!reportDefinition) {
        return Response.json({ error: 'Report definition not found' }, { status: 404 });
      }
    }

    // Gather data based on report type
    let reportData = {};
    let reportTitle = '';
    let reportContent = '';

    switch (report_type) {
      case 'client_summary':
        if (!client_id) {
          return Response.json({ error: 'client_id required for client summary' }, { status: 400 });
        }

        const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
        if (!client[0]) {
          return Response.json({ error: 'Client not found' }, { status: 404 });
        }

        const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
          client_id 
        }, '-created_date', 50);

        const contacts = await base44.asServiceRole.entities.ClientContact.filter({ 
          client_id 
        });

        reportTitle = `Client Summary: ${client[0].name}`;
        reportData = {
          client: client[0],
          active_workflows: workflows.filter(w => w.status === 'in_progress').length,
          completed_workflows: workflows.filter(w => w.status === 'completed').length,
          total_contacts: contacts.length,
          workflows: workflows
        };

        // Use AI to generate narrative summary
        const clientSummaryPrompt = `Generate a professional client summary report based on this data:

Client: ${client[0].name}
Industry: ${client[0].industry}
Lifecycle Stage: ${client[0].lifecycle_stage}
Active Workflows: ${reportData.active_workflows}
Completed Workflows: ${reportData.completed_workflows}
Total Contacts: ${reportData.total_contacts}

Provide a concise executive summary (2-3 paragraphs) covering the client's current status, engagement level, and key observations.`;

        reportContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: clientSummaryPrompt
        });
        break;

      case 'workflow_performance':
        const allWorkflows = await base44.asServiceRole.entities.WorkflowInstance.list('-updated_date', 100);
        const templates = await base44.asServiceRole.entities.WorkflowTemplate.list();

        const performanceByTemplate = {};
        for (const workflow of allWorkflows) {
          const templateId = workflow.workflow_template_id;
          if (!performanceByTemplate[templateId]) {
            performanceByTemplate[templateId] = {
              total: 0,
              completed: 0,
              in_progress: 0,
              blocked: 0,
              avg_progress: 0
            };
          }
          performanceByTemplate[templateId].total++;
          performanceByTemplate[templateId][workflow.status]++;
          performanceByTemplate[templateId].avg_progress += workflow.progress_percentage || 0;
        }

        // Calculate averages
        Object.keys(performanceByTemplate).forEach(templateId => {
          const stats = performanceByTemplate[templateId];
          stats.avg_progress = stats.total > 0 ? (stats.avg_progress / stats.total).toFixed(1) : 0;
        });

        reportTitle = 'Workflow Performance Report';
        reportData = {
          total_workflows: allWorkflows.length,
          by_template: performanceByTemplate,
          templates: templates
        };

        // Use AI to generate analysis
        const performancePrompt = `Analyze the following workflow performance data and identify bottlenecks, efficiency patterns, and recommendations:

Total Workflows: ${allWorkflows.length}
Performance by Template: ${JSON.stringify(performanceByTemplate, null, 2)}

Provide:
1. Key Performance Insights (2-3 bullet points)
2. Identified Bottlenecks (if any)
3. Recommendations for Improvement`;

        reportContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: performancePrompt
        });
        break;

      case 'bottleneck_analysis':
        const blockedWorkflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
          status: 'blocked' 
        });

        const blockedTasks = await base44.asServiceRole.entities.TaskInstance.filter({ 
          is_blocked: true 
        }, '-created_date', 50);

        reportTitle = 'Operational Bottleneck Analysis';
        reportData = {
          blocked_workflows: blockedWorkflows.length,
          blocked_tasks: blockedTasks.length,
          workflows: blockedWorkflows,
          tasks: blockedTasks
        };

        const bottleneckPrompt = `Analyze operational bottlenecks:

Blocked Workflows: ${blockedWorkflows.length}
Blocked Tasks: ${blockedTasks.length}

Task Details:
${blockedTasks.map(t => `- ${t.name}: ${t.blocker_reason || 'No reason specified'}`).join('\n')}

Provide:
1. Root Cause Analysis
2. Impact Assessment
3. Recommended Actions`;

        reportContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: bottleneckPrompt
        });
        break;

      default:
        return Response.json({ error: 'Unknown report type' }, { status: 400 });
    }

    // Create ReportInstance
    const reportInstance = await base44.asServiceRole.entities.ReportInstance.create({
      report_definition_id: report_definition_id || null,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      title: reportTitle,
      content: reportContent,
      data: reportData,
      format: 'text',
      status: 'completed'
    });

    // Publish REPORT_GENERATED event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'report_generated',
      source_entity_type: 'report_instance',
      source_entity_id: reportInstance.id,
      actor_type: 'ai',
      actor_id: user.id,
      payload: { 
        report_type,
        client_id: client_id || null
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({ 
      success: true, 
      report: reportInstance
    });

  } catch (error) {
    console.error('Generate Report Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});