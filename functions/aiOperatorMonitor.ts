import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // This function runs as a scheduled task, no user auth required
  // It operates with service role permissions

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));

  // LOOK PHASE: Scan for stalled workflows
  const stalledTasks = await base44.asServiceRole.entities.TaskInstance.filter({
    status: 'in_progress'
  });

  const riskyTasks = stalledTasks.filter(task => {
    if (!task.started_at) return false;
    const startedDate = new Date(task.started_at);
    const daysSinceStart = (now - startedDate) / (1000 * 60 * 60 * 24);
    return daysSinceStart > 3;
  });

  // Check for blocked tasks
  const blockedTasks = await base44.asServiceRole.entities.TaskInstance.filter({
    status: 'blocked'
  });

  // Check for overdue tasks
  const overdueTasks = await base44.asServiceRole.entities.TaskInstance.filter({
    status: 'in_progress'
  });

  const overdueFiltered = overdueTasks.filter(task => {
    if (!task.due_date) return false;
    return new Date(task.due_date) < now;
  });

  const issues = [];

  // Generate notifications/actions for risky situations
  if (riskyTasks.length > 0) {
    issues.push({
      type: 'stalled_tasks',
      count: riskyTasks.length,
      severity: 'warning',
      description: `${riskyTasks.length} tasks have been in progress for more than 3 days`
    });
  }

  if (blockedTasks.length > 0) {
    issues.push({
      type: 'blocked_tasks',
      count: blockedTasks.length,
      severity: 'high',
      description: `${blockedTasks.length} tasks are currently blocked`
    });
  }

  if (overdueFiltered.length > 0) {
    issues.push({
      type: 'overdue_tasks',
      count: overdueFiltered.length,
      severity: 'urgent',
      description: `${overdueFiltered.length} tasks are overdue`
    });
  }

  // If issues found, create AI analysis
  if (issues.length > 0) {
    const analysisPrompt = `You are the Operator - a background monitoring AI for Business OS.

Your role: Scan active workflows for stalls, risks, or missing data.
Your goal: Maintain Momentum.

DETECTED ISSUES:
${JSON.stringify(issues, null, 2)}

RISKY TASKS (in progress > 3 days):
${JSON.stringify(riskyTasks.slice(0, 5).map(t => ({ 
  name: t.name, 
  client_id: t.client_id,
  started_at: t.started_at 
})), null, 2)}

BLOCKED TASKS:
${JSON.stringify(blockedTasks.slice(0, 5).map(t => ({ 
  name: t.name, 
  blocker_reason: t.blocker_reason 
})), null, 2)}

Generate a brief operational alert that:
1. Summarizes the issues
2. Identifies root causes if possible
3. Suggests remediation actions

Keep it actionable and specific.`;

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      add_context_from_internet: false
    });

    // Log the monitoring result
    const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({
      role: 'strategy_orchestrator'
    });

    if (agentConfigs.length > 0) {
      await base44.asServiceRole.entities.AIAuditLog.create({
        ai_agent_config_id: agentConfigs[0].id,
        input_summary: `Operator scan: ${issues.length} issues detected`,
        output_summary: analysis.substring(0, 200),
        raw_output: { analysis, issues },
        status: 'success'
      });
    }

    return Response.json({ 
      success: true, 
      issues_detected: issues.length,
      analysis,
      issues
    });
  }

  return Response.json({ 
    success: true, 
    issues_detected: 0,
    message: 'All systems nominal'
  });
});