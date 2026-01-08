import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, strategySpaceId } = await req.json();

    if (!prompt || !strategySpaceId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load AI Agent Configuration
    const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({ 
      agent_id: 'strategist',
      is_enabled: true 
    });
    const agentConfig = agentConfigs[0];

    if (!agentConfig) {
      return Response.json({ error: 'AI Strategist agent not configured or disabled' }, { status: 403 });
    }

    // CONTEXT RETRIEVAL ("Look" Phase) - Fetch Current State & Desired State
    const [workflowInstances, clients, templates, space] = await Promise.all([
      base44.asServiceRole.entities.WorkflowInstance.list('-updated_date', 50),
      base44.asServiceRole.entities.Client.list('-updated_date', 50),
      base44.asServiceRole.entities.WorkflowTemplate.list('-updated_date', 50),
      base44.asServiceRole.entities.StrategySpace.filter({ id: strategySpaceId }),
    ]);

    const strategySpace = space[0];

    // Fetch recent messages for conversational context
    const recentMessages = await base44.asServiceRole.entities.StrategyMessage.filter(
      { strategy_space_id: strategySpaceId },
      '-created_date',
      10
    );

    // Build context summary for the LLM
    const contextSummary = {
      total_workflows: workflowInstances.length,
      active_workflows: workflowInstances.filter(w => w.status === 'in_progress').length,
      blocked_workflows: workflowInstances.filter(w => w.status === 'blocked').length,
      total_clients: clients.length,
      clients_by_stage: clients.reduce((acc, c) => {
        acc[c.lifecycle_stage] = (acc[c.lifecycle_stage] || 0) + 1;
        return acc;
      }, {}),
      available_templates: templates.length,
    };

    // Fetch Rolling Summaries (Long-term Memory)
    const clientsWithHistory = clients
      .filter(c => c.summary_history && c.summary_history.length > 0)
      .map(c => ({
        client_name: c.name,
        summaries: c.summary_history.slice(-5) // Last 5 summaries per client
      }));

    const rollingSummariesContext = clientsWithHistory.length > 0
      ? `\n\n**Historical Context (Rolling Summaries):**\n${clientsWithHistory.map(c => 
          `Client: ${c.client_name}\n${c.summaries.map(s => 
            `- ${s.workflow_name} > ${s.stage_name}: ${s.summary_text}`
          ).join('\n')}`
        ).join('\n\n')}`
      : '';

    // Apply agent configuration to system prompt
    const contextSources = agentConfig.config_jsonb?.context_sources || ['workflows', 'clients', 'templates'];
    const safetyGuardrails = agentConfig.config_jsonb?.safety_guardrails || {
      require_approval_for: ['DELETE', 'PROPOSE_TEMPLATE_CHANGE'],
      max_actions_per_response: 5
    };

    // REASONING ("Think" Phase) - Call LLM with SAGO-RAG approach
    const systemPrompt = `You are The Strategist, an AI assistant for Business OS.

    **Agent Configuration:**
    - Role: ${agentConfig.role}
    - Allowed Context Sources: ${contextSources.join(', ')}
    - Safety: Actions requiring approval - ${safetyGuardrails.require_approval_for.join(', ')}
    - Max actions per response: ${safetyGuardrails.max_actions_per_response}
    
    **Your Role:** Strategic Command Center AI that answers operational questions, identifies bottlenecks, and proposes system-wide actions.
    
    **Your Goal:** Maximize System Coherence.
    
    **SAGO-RAG Framework:**
    For every request, solve: Gap = Desired State (Template) - Current State (Instance)
    - If Gap > 0: Propose actions to close the gap
    - If Gap = 0: Look for optimization opportunities
    
    **Available Action Types You Can Propose:**
    1. CREATE_WORKFLOW - Start a new workflow for a client
    2. UPDATE_CLIENT_FIELD - Update client record data
    3. GENERATE_REPORT - Build analytical reports
    4. CREATE_TASK - Add ad-hoc tasks to workflows
    5. PROPOSE_TEMPLATE_CHANGE - Suggest workflow template improvements
    
    **Current System State:**
    ${JSON.stringify(contextSummary, null, 2)}
    ${rollingSummariesContext}
    
    **Conversation Context:**
    ${recentMessages.slice(-5).map(m => `${m.author_type}: ${m.content}`).join('\n')}
    
    **Instructions:**
    - Be concise and actionable
    - Ground all responses in actual data
    - Use the Rolling Summaries to recall historical context when relevant
    - When proposing actions, structure them clearly
    - Identify bottlenecks and suggest concrete improvements
    - Never hallucinate data - only use what you can see in the context`;

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nUser Request: ${prompt}`,
      response_json_schema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Natural language response to the user"
          },
          proposed_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action_type: { type: "string" },
                description: { type: "string" },
                payload: { type: "object" }
              }
            }
          }
        },
        required: ["message"]
      }
    });

    // Create AI message in the database
    const aiMessage = await base44.asServiceRole.entities.StrategyMessage.create({
      strategy_space_id: strategySpaceId,
      author_type: 'ai',
      content: llmResponse.message,
    });

    // Create StrategyAction records for any proposed actions (with permission checks)
    const createdActions = [];
    if (llmResponse.proposed_actions && llmResponse.proposed_actions.length > 0) {
      // Enforce max actions limit from config
      const actionsToCreate = llmResponse.proposed_actions.slice(0, safetyGuardrails.max_actions_per_response);

      for (const action of actionsToCreate) {
        // Check if this action requires approval
        const requiresApproval = safetyGuardrails.require_approval_for.includes(action.action_type);

        const strategyAction = await base44.asServiceRole.entities.StrategyAction.create({
          strategy_space_id: strategySpaceId,
          trigger_message_id: aiMessage.id,
          action_type: action.action_type,
          status: requiresApproval ? 'pending' : 'approved',
          requested_by_user_id: user.id,
          payload: action.payload || {},
          description: action.description,
        });
        createdActions.push(strategyAction);
      }
    }

    return Response.json({
      message: aiMessage,
      actions: createdActions,
    });

  } catch (error) {
    console.error('AI Strategist Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});