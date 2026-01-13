import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      action,
      user_message,
      workflow_context,
      uploaded_file_urls,
      suggestion,
    } = await req.json();

    // Handle approval action
    if (action === 'approve' && suggestion) {
      return await handleApproval(base44, suggestion, workflow_context);
    }

    // Handle conversation and generation
    return await handleConversation(base44, user_message, workflow_context, uploaded_file_urls);

  } catch (error) {
    console.error('Error in aiBuildWorkflow:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleApproval(base44, suggestion, workflow_context) {
  let updatedContext = workflow_context || {};
  let createdEntity = null;

  try {
    switch (suggestion.type) {
      case 'workflow':
        createdEntity = await base44.asServiceRole.entities.WorkflowTemplate.create({
          name: suggestion.name,
          description: suggestion.description,
          type: suggestion.workflow_type || 'linear',
          category: suggestion.category || 'custom',
          is_active: true,
        });
        updatedContext.workflow = createdEntity;
        updatedContext.workflow_template_id = createdEntity.id;
        break;

      case 'stage':
        if (!workflow_context?.workflow_template_version_id) {
          // Create a version first if doesn't exist
          const version = await base44.asServiceRole.entities.WorkflowTemplateVersion.create({
            workflow_template_id: workflow_context.workflow_template_id,
            version_number: 1,
            name: 'Initial Version',
            status: 'draft',
          });
          updatedContext.workflow_template_version_id = version.id;
        }

        createdEntity = await base44.asServiceRole.entities.StageTemplate.create({
          workflow_template_version_id: updatedContext.workflow_template_version_id,
          name: suggestion.name,
          description: suggestion.description,
          sequence_order: (workflow_context?.stages?.length || 0) + 1,
          is_parallel: suggestion.is_parallel || false,
        });
        updatedContext.stages = [...(updatedContext.stages || []), createdEntity];
        break;

      case 'deliverable':
        const currentStageId = workflow_context?.current_stage_id || workflow_context?.stages?.[workflow_context.stages.length - 1]?.id;
        
        if (!currentStageId) {
          throw new Error('No stage available to add deliverable');
        }

        createdEntity = await base44.asServiceRole.entities.DeliverableTemplate.create({
          stage_template_id: currentStageId,
          name: suggestion.name,
          description: suggestion.description,
          sequence_order: (workflow_context?.deliverables?.length || 0) + 1,
          output_type: suggestion.output_type || 'document',
        });
        updatedContext.deliverables = [...(updatedContext.deliverables || []), createdEntity];
        updatedContext.current_stage_id = currentStageId;
        break;

      case 'task':
        const currentDeliverableId = workflow_context?.current_deliverable_id || 
          workflow_context?.deliverables?.[workflow_context.deliverables.length - 1]?.id;
        
        if (!currentDeliverableId) {
          throw new Error('No deliverable available to add task');
        }

        createdEntity = await base44.asServiceRole.entities.TaskTemplate.create({
          deliverable_template_id: currentDeliverableId,
          name: suggestion.name,
          description: suggestion.description,
          instructions: suggestion.instructions || '',
          sequence_order: (workflow_context?.tasks?.length || 0) + 1,
          is_required: suggestion.is_required !== false,
        });
        updatedContext.tasks = [...(updatedContext.tasks || []), createdEntity];
        updatedContext.current_deliverable_id = currentDeliverableId;
        break;
    }

    return Response.json({
      success: true,
      approved_id: suggestion.id,
      created_entity: createdEntity,
      workflow_context: updatedContext,
      assistant_message: `✅ ${suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)} "${suggestion.name}" created successfully! What would you like to add next?`,
    });

  } catch (error) {
    console.error('Error approving suggestion:', error);
    return Response.json({
      error: error.message,
      workflow_context: workflow_context,
    }, { status: 500 });
  }
}

async function handleConversation(base44, user_message, workflow_context, uploaded_file_urls) {
  // Step 1: Extract document content if files uploaded
  let documentContent = '';
  if (uploaded_file_urls && uploaded_file_urls.length > 0) {
    for (const fileUrl of uploaded_file_urls) {
      try {
        const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              key_points: { type: 'array', items: { type: 'string' } },
            },
          },
        });
        
        if (extractResult.status === 'success') {
          documentContent += '\n\n' + extractResult.output.content;
        }
      } catch (error) {
        console.error('Error extracting document:', error);
      }
    }
  }

  // Step 2: Semantic search for relevant knowledge
  let relevantKnowledge = '';
  try {
    const searchQuery = user_message + ' ' + (documentContent ? documentContent.substring(0, 500) : '');
    const searchResult = await base44.functions.invoke('semanticSearchKnowledge', {
      query: searchQuery,
      top_k: 5,
    });

    if (searchResult.data?.results?.length > 0) {
      relevantKnowledge = searchResult.data.results
        .map(r => `[${r.knowledge_asset.title}]\n${r.knowledge_asset.content || r.knowledge_asset.description || ''}`)
        .join('\n\n---\n\n');
    }
  } catch (error) {
    console.error('Error searching knowledge:', error);
  }

  // Step 3: Build comprehensive prompt
  const systemPrompt = `You are an expert AI Workflow Architect helping users design business workflows. You have access to the organization's knowledge base and uploaded documents.

Your role:
- Guide users through workflow creation step by step
- Suggest stages, deliverables, and tasks based on best practices and organizational knowledge
- Ask clarifying questions when needed
- Provide structured suggestions that can be approved, edited, or rejected

Current workflow context:
${JSON.stringify(workflow_context || {}, null, 2)}

Relevant organizational knowledge:
${relevantKnowledge || 'No relevant knowledge found.'}

Uploaded document content:
${documentContent || 'No documents uploaded.'}

When suggesting workflow elements, respond with:
1. A conversational message to the user
2. Structured suggestions in this format

Response format:
{
  "assistant_message": "Your conversational response here",
  "suggestions": [
    {
      "id": "unique_id_here",
      "type": "workflow|stage|deliverable|task",
      "name": "Element name",
      "description": "Clear description",
      ... other relevant fields based on type
    }
  ]
}

Guidelines:
- Start with workflow template if none exists
- Then suggest stages (major phases)
- For each stage, suggest deliverables (outputs)
- For each deliverable, suggest tasks (actions)
- Be conversational and helpful
- Ask questions to clarify requirements
- Reference organizational knowledge when relevant`;

  const userPrompt = user_message || 'I uploaded some documents. Can you help me build a workflow based on them?';

  // Step 4: Invoke LLM
  const llmResponse = await base44.integrations.Core.InvokeLLM({
    prompt: `${systemPrompt}\n\nUser: ${userPrompt}`,
    response_json_schema: {
      type: 'object',
      properties: {
        assistant_message: { type: 'string' },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['workflow', 'stage', 'deliverable', 'task'] },
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  });

  return Response.json({
    assistant_message: llmResponse.assistant_message,
    suggestions: llmResponse.suggestions || [],
    workflow_context: workflow_context || {},
  });
}