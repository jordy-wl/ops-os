import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { strategy_space_id, user_message } = await req.json();

  if (!strategy_space_id || !user_message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Save user message
  await base44.asServiceRole.entities.StrategyMessage.create({
    strategy_space_id,
    author_type: 'user',
    author_user_id: user.id,
    content: user_message
  });

  // Publish event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'strategy_message_created',
    source_entity_type: 'strategy_space',
    source_entity_id: strategy_space_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { message: user_message },
    occurred_at: new Date().toISOString()
  });

  // LOOK PHASE: Context Retrieval
  const strategySpace = await base44.entities.StrategySpace.filter({ id: strategy_space_id });
  const space = strategySpace[0];

  // Get related client context if anchored
  let clientContext = '';
  if (space.primary_client_id) {
    const clientDataRes = await base44.functions.invoke('getClientData', { 
      client_id: space.primary_client_id 
    });
    clientContext = JSON.stringify(clientDataRes.data, null, 2);
  }

  // Get workflow instances (current state)
  const activeWorkflows = await base44.entities.WorkflowInstance.filter({
    status: 'in_progress'
  }, '-created_date', 10);

  // Get blocked tasks
  const blockedTasks = await base44.entities.TaskInstance.filter({
    status: 'blocked'
  }, '-created_date', 5);

  // Get recent events for context
  const recentEvents = await base44.entities.Event.list('-occurred_at', 20);

  // Get conversation history
  const previousMessages = await base44.entities.StrategyMessage.filter({
    strategy_space_id
  }, 'created_date', 10);

  const conversationHistory = previousMessages
    .map(m => `${m.author_type === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n\n');

  // THINK PHASE: AI Reasoning with SAGO-RAG
  const systemPrompt = `You are the Strategist - the command center AI for Business OS.

Your role: Answer operational questions, surface bottlenecks, and propose system-wide actions.
Your goal: Maximize System Coherence.

You operate using SAGO-RAG (State-Aware, Goal-Oriented Retrieval):
1. Analyze CURRENT STATE (reality from data)
2. Identify DESIRED STATE (goals from templates)
3. Calculate GAP and propose actions to close it

CURRENT SYSTEM STATE:
- Active Workflows: ${activeWorkflows.length}
- Blocked Tasks: ${blockedTasks.length}
- Recent Activity: ${recentEvents.length} events

${clientContext ? `CLIENT CONTEXT:\n${clientContext}\n` : ''}

ACTIVE WORKFLOWS:
${JSON.stringify(activeWorkflows.slice(0, 5), null, 2)}

BLOCKED TASKS:
${JSON.stringify(blockedTasks, null, 2)}

CONVERSATION HISTORY:
${conversationHistory}

When proposing actions, be specific and actionable. Focus on:
- Identifying bottlenecks
- Suggesting workflow improvements
- Analyzing client progression
- Recommending next steps

If you identify an action to take, describe it clearly and suggest it as a proposal.`;

  // Invoke LLM with context
  const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `${systemPrompt}\n\nUSER QUERY: ${user_message}\n\nProvide a comprehensive response based on the current system state.`,
    add_context_from_internet: false
  });

  // Save AI message
  const aiMessage = await base44.asServiceRole.entities.StrategyMessage.create({
    strategy_space_id,
    author_type: 'ai',
    content: aiResponse
  });

  // Publish AI reasoning event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'ai_reasoning_triggered',
    source_entity_type: 'strategy_space',
    source_entity_id: strategy_space_id,
    actor_type: 'ai',
    payload: { 
      user_query: user_message,
      response_length: aiResponse.length
    },
    occurred_at: new Date().toISOString()
  });

  // Check if response suggests an action (simple keyword detection)
  const actionKeywords = ['recommend', 'suggest', 'propose', 'should create', 'should add'];
  const suggestsAction = actionKeywords.some(keyword => 
    aiResponse.toLowerCase().includes(keyword)
  );

  if (suggestsAction) {
    // Create a pending strategy action for user approval
    await base44.asServiceRole.entities.StrategyAction.create({
      strategy_space_id,
      trigger_message_id: aiMessage.id,
      action_type: 'other',
      status: 'pending',
      requested_by_user_id: user.id,
      executed_by: 'ai',
      payload: {
        description: aiResponse.substring(0, 500),
        full_response: aiResponse
      }
    });

    await base44.asServiceRole.entities.Event.create({
      event_type: 'strategy_action_requested',
      source_entity_type: 'strategy_space',
      source_entity_id: strategy_space_id,
      actor_type: 'ai',
      payload: { message_id: aiMessage.id },
      occurred_at: new Date().toISOString()
    });
  }

  return Response.json({ 
    success: true, 
    ai_response: aiResponse,
    message_id: aiMessage.id,
    action_proposed: suggestsAction
  });
});