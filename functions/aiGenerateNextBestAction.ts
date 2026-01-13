import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    console.log('Generating next best action for client:', client_id);

    // Fetch comprehensive client context
    const [client] = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch active workflows
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter(
      { client_id, status: { $in: ['active', 'in_progress'] } },
      '-created_date',
      10
    );

    // Fetch recent communications
    const communications = await base44.asServiceRole.entities.CommunicationLog.filter(
      { client_id },
      '-occurred_at',
      20
    );

    // Fetch recent events
    const events = await base44.asServiceRole.entities.Event.filter(
      { 
        source_entity_type: 'workflow_instance',
        source_entity_id: { $in: workflows.map(w => w.id) }
      },
      '-occurred_at',
      50
    );

    // Calculate risk indicators
    const daysSinceLastCommunication = communications.length > 0
      ? Math.floor((Date.now() - new Date(communications[0].occurred_at)) / (1000 * 60 * 60 * 24))
      : 999;

    const blockedTasks = events.filter(e => e.event_type === 'task_blocked').length;
    const failedTasks = events.filter(e => e.event_type === 'task_failed').length;

    // Check for delayed workflows
    const delayedWorkflows = workflows.filter(w => {
      if (!w.expected_completion_date) return false;
      return new Date(w.expected_completion_date) < new Date();
    });

    // Search knowledge base for relevant context
    let knowledgeContext = '';
    try {
      const searchResult = await base44.functions.invoke('semanticSearchKnowledge', {
        query: `client management best practices ${client.industry} ${client.lifecycle_stage}`,
        top_k: 3,
      });
      
      if (searchResult.data?.results?.length > 0) {
        knowledgeContext = searchResult.data.results
          .map(r => `${r.knowledge_asset.title}: ${r.knowledge_asset.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Knowledge search error:', error);
    }

    console.log('Invoking LLM for predictive analysis...');

    // Generate AI recommendations with predictive insights
    const prompt = `You are a proactive AI business advisor analyzing client health and predicting future needs.

Client Profile:
- Name: ${client.name}
- Industry: ${client.industry}
- Stage: ${client.lifecycle_stage}
- Value: $${client.value || 0}
- Risk Score: ${client.risk_score || 0}/100
- Sentiment: ${client.sentiment_score || 'neutral'}

Current Situation:
- Active Workflows: ${workflows.length}
- Delayed Workflows: ${delayedWorkflows.length}
- Days Since Last Contact: ${daysSinceLastCommunication}
- Blocked Tasks: ${blockedTasks}
- Failed Tasks: ${failedTasks}

Recent Communication Pattern:
${communications.slice(0, 5).map(c => `- ${c.communication_type}: ${c.subject || 'No subject'} (${new Date(c.occurred_at).toLocaleDateString()})`).join('\n')}

Recent Events:
${events.slice(0, 10).map(e => `- ${e.event_type} at ${new Date(e.occurred_at).toLocaleDateString()}`).join('\n')}

Organizational Knowledge:
${knowledgeContext || 'No specific context found'}

Analyze this data and generate:
1. Risk Assessment: Predict potential issues (churn risk, delays, quality concerns)
2. Next Best Action: Specific, actionable recommendation
3. Priority Level: How urgent is this action?
4. Expected Impact: What outcome will this action drive?
5. Predictive Insights: What might happen if no action is taken?

Be proactive and specific. Focus on preventing issues before they occur.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_assessment: {
            type: 'object',
            properties: {
              churn_risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              delay_risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              quality_risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              summary: { type: 'string' }
            }
          },
          next_best_action: {
            type: 'object',
            properties: {
              action_type: { 
                type: 'string', 
                enum: ['communicate', 'schedule_meeting', 'escalate', 'provide_resource', 'adjust_workflow', 'review_deliverable', 'other']
              },
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              expected_impact: { type: 'string' },
              reasoning: { type: 'string' }
            }
          },
          predictive_insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scenario: { type: 'string' },
                probability: { type: 'string', enum: ['low', 'medium', 'high'] },
                impact: { type: 'string' },
                prevention: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Update client with AI insights
    await base44.asServiceRole.entities.Client.update(client.id, {
      next_best_action: aiResponse.next_best_action.title,
      risk_score: aiResponse.risk_assessment.churn_risk === 'critical' ? 90 :
                  aiResponse.risk_assessment.churn_risk === 'high' ? 70 :
                  aiResponse.risk_assessment.churn_risk === 'medium' ? 40 : 20,
      insights: {
        ...client.insights,
        last_ai_analysis: new Date().toISOString(),
        risk_assessment: aiResponse.risk_assessment,
        predictive_insights: aiResponse.predictive_insights
      }
    });

    // Log AI action
    await base44.asServiceRole.entities.AIAuditLog.create({
      agent_id: 'next_best_action_predictor',
      action_type: 'generate_recommendation',
      object_type: 'client',
      object_id: client_id,
      input_data: { client_id },
      output_data: aiResponse,
      user_id: user.id,
      timestamp: new Date().toISOString(),
      was_approved: null, // Will be set when user provides feedback
    });

    console.log('Next best action generated successfully');

    return Response.json({
      success: true,
      risk_assessment: aiResponse.risk_assessment,
      next_best_action: aiResponse.next_best_action,
      predictive_insights: aiResponse.predictive_insights,
    });

  } catch (error) {
    console.error('Error generating next best action:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});