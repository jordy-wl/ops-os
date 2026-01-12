import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      chat_history, 
      title, 
      description, 
      type = 'other', 
      related_entities = [],
      tags = []
    } = await req.json();

    if (!chat_history || !Array.isArray(chat_history) || chat_history.length === 0) {
      return Response.json({ 
        error: 'Missing or invalid chat_history' 
      }, { status: 400 });
    }

    if (!title) {
      return Response.json({ error: 'Missing title' }, { status: 400 });
    }

    // Convert chat history to text format
    const chatText = chat_history
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Use AI to analyze and summarize the conversation
    const prompt = `You are analyzing a strategic conversation or discussion to create a knowledge asset.

Conversation:
${chatText}

Tasks:
1. Generate a concise summary (2-3 paragraphs) of the key points discussed
2. Extract actionable insights and key takeaways (bullet points)
3. If this is a process or SOP discussion, structure the content into clear steps
4. Identify important decisions or commitments made

Type of asset: ${type}
${description ? `Context: ${description}` : ''}

Output as JSON with:
- ai_summary: Brief summary of the discussion
- ai_insights: Key takeaways as a string with bullet points
- content: Structured content suitable for a ${type} (markdown format)`;

    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          ai_summary: { type: "string" },
          ai_insights: { type: "string" },
          content: { type: "string" }
        }
      }
    });

    // Create KnowledgeAsset
    const knowledgeAsset = await base44.asServiceRole.entities.KnowledgeAsset.create({
      title,
      description: description || analysis.ai_summary,
      content: analysis.content,
      type,
      source: 'strategy_chat',
      related_entities,
      tags,
      ai_summary: analysis.ai_summary,
      ai_insights: analysis.ai_insights,
      is_active: true,
      metadata: {
        created_by: user.email,
        chat_message_count: chat_history.length,
        original_chat_date: new Date().toISOString()
      }
    });

    // Publish event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'strategy_message_created',
      source_entity_type: 'knowledge_asset',
      source_entity_id: knowledgeAsset.id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        type,
        title,
        message_count: chat_history.length
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      knowledge_asset: knowledgeAsset
    });

  } catch (error) {
    console.error('Save Chat as Knowledge Asset Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});