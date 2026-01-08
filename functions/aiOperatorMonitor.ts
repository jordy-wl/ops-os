import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id } = await req.json();

    if (!event_id) {
      return Response.json({ error: 'Missing event_id' }, { status: 400 });
    }

    // Fetch the event
    const events = await base44.asServiceRole.entities.Event.filter({ id: event_id });
    const event = events[0];

    if (!event) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    console.log(`Processing event: ${event.event_type}`);

    // Define which events trigger AI monitoring
    const monitoredEvents = [
      'workflow_instance_started',
      'stage_completed',
      'task_blocked',
      'task_released',
      'document_generated',
      'report_generated',
      'client_lifecycle_change'
    ];

    if (!monitoredEvents.includes(event.event_type)) {
      return Response.json({ 
        success: true, 
        message: 'Event not monitored by AI Operator',
        monitored: false 
      });
    }

    // Fetch context based on event type
    let context = {};
    let reasoning_prompt = '';
    let client_id = null;

    switch (event.event_type) {
      case 'workflow_instance_started': {
        const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
          id: event.source_entity_id 
        });
        const workflow = workflows[0];
        
        if (!workflow) break;
        
        client_id = workflow.client_id;
        const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
        const client = clients[0];

        context = { workflow, client };
        reasoning_prompt = `A new workflow "${workflow.name}" has been started for client "${client?.name}".
        
Analyze:
1. Are there any immediate risks or blockers?
2. Should any proactive actions be taken?
3. Are resources properly allocated?
4. Any next best actions to recommend?`;
        break;
      }

      case 'stage_completed': {
        const stages = await base44.asServiceRole.entities.StageInstance.filter({ 
          id: event.source_entity_id 
        });
        const stage = stages[0];
        
        if (!stage) break;

        const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
          id: stage.workflow_instance_id 
        });
        const workflow = workflows[0];
        
        client_id = workflow?.client_id;
        const clients = client_id ? await base44.asServiceRole.entities.Client.filter({ id: client_id }) : [];
        const client = clients[0];

        context = { stage, workflow, client };
        reasoning_prompt = `Stage "${stage.name}" has been completed in workflow "${workflow?.name}" for client "${client?.name}".
        
Analyze:
1. Should a rolling summary be generated for this stage?
2. Are there insights to capture for the client record?
3. Should the next stage be automatically advanced?
4. Any next best actions?`;
        break;
      }

      case 'task_blocked': {
        const tasks = await base44.asServiceRole.entities.TaskInstance.filter({ 
          id: event.source_entity_id 
        });
        const task = tasks[0];
        
        if (!task) break;

        client_id = task.client_id;
        const clients = client_id ? await base44.asServiceRole.entities.Client.filter({ id: client_id }) : [];
        const client = clients[0];

        const workflows = task.workflow_instance_id 
          ? await base44.asServiceRole.entities.WorkflowInstance.filter({ id: task.workflow_instance_id }) 
          : [];
        const workflow = workflows[0];

        context = { task, workflow, client, blocker_reason: task.blocker_reason };
        reasoning_prompt = `Task "${task.name}" is blocked. Reason: ${task.blocker_reason || 'Not specified'}.
        
Client: ${client?.name}
Workflow: ${workflow?.name}

Analyze:
1. What actions can resolve this blocker?
2. Should tasks be reassigned?
3. Is escalation needed?
4. Impact on workflow timeline?`;
        break;
      }

      case 'task_released': {
        const payload = event.payload || {};
        client_id = payload.client_id;
        
        context = { task_count: payload.task_count || 1 };
        reasoning_prompt = `New tasks have been released (${payload.task_count || 1} tasks).
        
Should these tasks be:
1. Assigned to specific users automatically?
2. Prioritized based on urgency?
3. Does the team have capacity?`;
        break;
      }

      case 'document_generated': {
        const docs = await base44.asServiceRole.entities.DocumentInstance.filter({ 
          id: event.source_entity_id 
        });
        const document = docs[0];
        
        if (!document) break;

        client_id = document.client_id;
        const clients = client_id ? await base44.asServiceRole.entities.Client.filter({ id: client_id }) : [];
        const client = clients[0];

        context = { document, client };
        reasoning_prompt = `Document "${document.name}" has been generated for client "${client?.name}".
        
Next steps:
1. Should this document be automatically sent to the client?
2. Does it need approval first?
3. Any follow-up tasks to create?`;
        break;
      }

      case 'report_generated': {
        const reports = await base44.asServiceRole.entities.ReportInstance.filter({ 
          id: event.source_entity_id 
        });
        const report = reports[0];
        
        if (!report) break;

        context = { report };
        reasoning_prompt = `Report "${report.title}" has been generated.
        
Analyze the report findings:
1. Are there critical insights requiring immediate action?
2. Should stakeholders be notified?
3. Any strategic actions to propose based on findings?`;
        break;
      }

      default:
        return Response.json({ 
          success: true, 
          message: 'Event type not yet implemented',
          monitored: false 
        });
    }

    if (!reasoning_prompt) {
      return Response.json({ 
        success: true, 
        message: 'No context available for reasoning',
        monitored: false 
      });
    }

    // Call AI for reasoning
    const systemPrompt = `You are The Operator - the AI Monitoring Agent for Business OS.

Your role: Monitor system events and proactively identify issues, opportunities, and actions.
Your goal: Zero Surprise Failures.

EVENT CONTEXT:
${JSON.stringify(context, null, 2)}

Provide your analysis and proposed actions in structured format.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\n${reasoning_prompt}`,
      response_json_schema: {
        type: "object",
        properties: {
          analysis: {
            type: "string",
            description: "Brief analysis of the situation"
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "Severity level"
          },
          proposed_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action_type: { type: "string" },
                description: { type: "string" },
                priority: { type: "string" },
                payload: { type: "object" }
              }
            }
          },
          insights: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["analysis", "severity"]
      }
    });

    // Update client insights if applicable
    if (client_id && aiResponse.insights && aiResponse.insights.length > 0) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      const client = clients[0];
      
      if (client) {
        const updatedInsights = {
          ...(client.insights || {}),
          last_ai_analysis: aiResponse.analysis,
          last_analyzed_at: new Date().toISOString()
        };

        await base44.asServiceRole.entities.Client.update(client_id, {
          insights: updatedInsights
        });
      }
    }

    // Create audit log
    await base44.asServiceRole.entities.AIAuditLog.create({
      action_type: 'event_monitoring',
      actor_type: 'ai',
      actor_id: 'operator_agent',
      input_summary: `Monitor event: ${event.event_type}`,
      output_summary: `${aiResponse.severity} severity - ${aiResponse.proposed_actions?.length || 0} actions proposed`,
      raw_input: { event_id, event_type: event.event_type, context },
      raw_output: aiResponse,
      status: 'success'
    });

    // Store proposed actions (if in a strategy space context, create StrategyAction records)
    // For now, we return them for potential user approval
    const createdActions = [];
    if (aiResponse.proposed_actions && aiResponse.proposed_actions.length > 0 && client_id) {
      // Find or create a strategy space for this client
      const spaces = await base44.asServiceRole.entities.StrategySpace.filter({
        name: `Auto-Monitor: ${context.client?.name || 'System'}`
      });

      let spaceId;
      if (spaces.length > 0) {
        spaceId = spaces[0].id;
      } else {
        const newSpace = await base44.asServiceRole.entities.StrategySpace.create({
          name: `Auto-Monitor: ${context.client?.name || 'System'}`,
          description: 'Automated AI monitoring and recommendations'
        });
        spaceId = newSpace.id;
      }

      // Create strategy actions
      for (const action of aiResponse.proposed_actions) {
        const strategyAction = await base44.asServiceRole.entities.StrategyAction.create({
          strategy_space_id: spaceId,
          action_type: action.action_type || 'CREATE_TASK',
          status: 'pending',
          requested_by_user_id: 'ai_operator',
          payload: action.payload || {},
          description: action.description,
          target_object_type: event.source_entity_type,
          target_object_id: event.source_entity_id
        });
        createdActions.push(strategyAction);
      }
    }

    return Response.json({
      success: true,
      monitored: true,
      event_type: event.event_type,
      analysis: aiResponse.analysis,
      severity: aiResponse.severity,
      insights: aiResponse.insights,
      proposed_actions: createdActions
    });

  } catch (error) {
    console.error('AI Operator Monitor Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});