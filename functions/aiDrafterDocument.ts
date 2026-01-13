import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { document_template_id, client_id, workflow_instance_id, deliverable_instance_id } = await req.json();

  if (!document_template_id || !client_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get document template
  const templates = await base44.entities.DocumentTemplate.filter({ id: document_template_id });
  if (templates.length === 0) {
    return Response.json({ error: 'Document template not found' }, { status: 404 });
  }

  const template = templates[0];

  // Get client data with enriched fields
  const clientDataRes = await base44.functions.invoke('getClientData', { client_id });
  const clientData = clientDataRes.data;

  // Fetch workflow and deliverable context if provided
  let workflowContext = null;
  let deliverableContext = null;

  if (workflow_instance_id) {
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ id: workflow_instance_id });
    workflowContext = workflows[0] || null;
  }

  if (deliverable_instance_id) {
    const deliverables = await base44.asServiceRole.entities.DeliverableInstance.filter({ id: deliverable_instance_id });
    deliverableContext = deliverables[0] || null;

    // Fetch tasks associated with the deliverable for additional context
    if (deliverableContext) {
      const tasks = await base44.asServiceRole.entities.TaskInstance.filter({ 
        deliverable_instance_id: deliverable_instance_id,
        status: 'completed'
      });
      deliverableContext.completed_tasks = tasks;
    }
  }

  // Gather required entity data based on template configuration
  const requiredData = {};
  if (template.required_entity_data && template.required_entity_data.length > 0) {
    for (const requirement of template.required_entity_data) {
      const { entity_type, field_path } = requirement;
      
      if (entity_type === 'Client') {
        requiredData[field_path] = getNestedValue(clientData.client, field_path);
      } else if (entity_type === 'WorkflowInstance' && workflowContext) {
        requiredData[field_path] = getNestedValue(workflowContext, field_path);
      }
    }
  }

  // Perform RAG search if keywords are defined
  let knowledgeContext = '';
  if (template.rag_keywords && template.rag_keywords.length > 0) {
    try {
      const searchQuery = `${template.rag_keywords.join(' ')} ${template.name} ${template.category}`;
      const searchResult = await base44.functions.invoke('semanticSearchKnowledge', {
        query: searchQuery,
        top_k: 5,
      });
      
      if (searchResult.data?.results?.length > 0) {
        knowledgeContext = searchResult.data.results
          .map(r => `[${r.knowledge_asset.title}]\n${r.knowledge_asset.content || r.knowledge_asset.description || ''}`)
          .join('\n\n---\n\n');
      }
    } catch (error) {
      console.error('Error performing RAG search:', error);
    }
  }

// Helper function to get nested values
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

  // THINK PHASE: Fill template placeholders and generate content with AI reasoning
  const generationPrompt = `You are the Drafter - the Document Engine AI for Business OS.

Your role: Fill document templates with data, reason over context, and generate intelligent prose.
Your goal: Zero Manual Assembly with Deep Contextual Understanding.

DOCUMENT TEMPLATE: ${template.name}
CATEGORY: ${template.category}
DESCRIPTION: ${template.description || 'No description'}

${template.document_outline ? `DOCUMENT OUTLINE (Follow this structure):
${template.document_outline}

` : ''}${template.ai_prompt_instructions ? `AI INSTRUCTIONS:
${template.ai_prompt_instructions}

` : ''}CLIENT DATA:
${JSON.stringify(clientData, null, 2)}

${Object.keys(requiredData).length > 0 ? `REQUIRED DATA POINTS:
${JSON.stringify(requiredData, null, 2)}

` : ''}${workflowContext ? `WORKFLOW CONTEXT:
Workflow: ${workflowContext.name}
Status: ${workflowContext.status}
Progress: ${workflowContext.progress_percentage}%
Current Stage: ${workflowContext.current_stage_name || 'N/A'}

` : ''}${deliverableContext ? `DELIVERABLE CONTEXT:
Deliverable: ${deliverableContext.name}
Collected Fields: ${JSON.stringify(deliverableContext.fields || {}, null, 2)}
Completed Tasks: ${deliverableContext.completed_tasks?.length || 0}

` : ''}${knowledgeContext ? `ORGANIZATIONAL KNOWLEDGE (RAG Context):
${knowledgeContext}

` : ''}TEMPLATE CONTENT:
${template.content_template || 'No template content provided - generate appropriate document structure for this category'}

PLACEHOLDERS TO FILL:
${JSON.stringify(template.placeholder_schema || [], null, 2)}

INSTRUCTIONS:
1. Replace all placeholders with actual client data from the context
2. Reason over the client's situation, workflow progress, and deliverable outcomes
3. Use the organizational knowledge (RAG) to inform your writing with relevant best practices and context
4. Fill in blanks and elaborate on sections based on all available context
5. Write professional, coherent prose that addresses the document's purpose
6. Ensure the document is production-ready and follows best practices for ${template.category} documents
7. Output ONLY the final document content in clean markdown format
8. Do not include any explanations or metadata - just the document itself

Generate the complete document now:`;

  const generatedContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: generationPrompt,
    add_context_from_internet: false
  });

  // Publish DOCUMENT_GENERATION_REQUESTED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'document_generation_requested',
    source_entity_type: 'document_template',
    source_entity_id: document_template_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { client_id },
    occurred_at: new Date().toISOString()
  });

  // Create document instance
  const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
    document_template_id,
    client_id,
    workflow_instance_id,
    deliverable_instance_id,
    name: `${template.name} - ${clientData.client?.name || 'Client'}`,
    content: generatedContent,
    status: 'generated',
    generated_at: new Date().toISOString(),
    generated_by: user.id
  });

  // Publish DOCUMENT_GENERATED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'document_generated',
    source_entity_type: 'document_instance',
    source_entity_id: documentInstance.id,
    actor_type: 'ai',
    payload: { 
      template_name: template.name,
      client_id 
    },
    occurred_at: new Date().toISOString()
  });

  // Log AI action with detailed audit
  await base44.asServiceRole.entities.AIAuditLog.create({
    action_type: 'generate_document',
    actor_type: 'ai',
    actor_id: user.id,
    input_summary: `Generate ${template.category} document: ${template.name} for client ${clientData.client?.name || client_id}`,
    output_summary: `Document generated successfully (${generatedContent.length} characters)`,
    raw_input: { 
      document_template_id, 
      client_id, 
      workflow_instance_id, 
      deliverable_instance_id,
      template_name: template.name 
    },
    raw_output: { 
      document_id: documentInstance.id,
      document_name: documentInstance.name,
      content_length: generatedContent.length
    },
    status: 'success'
  });

  return Response.json({ 
    success: true, 
    document: documentInstance
  });
});