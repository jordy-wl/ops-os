import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deliverable_instance_id } = await req.json();

    if (!deliverable_instance_id) {
      return Response.json({ error: 'deliverable_instance_id is required' }, { status: 400 });
    }

    // Fetch deliverable instance and related data
    const deliverableInstance = await base44.entities.DeliverableInstance.filter({ 
      id: deliverable_instance_id 
    }).then(r => r[0]);

    if (!deliverableInstance) {
      return Response.json({ error: 'Deliverable instance not found' }, { status: 404 });
    }

    const [deliverableTemplate, workflowInstance] = await Promise.all([
      base44.entities.DeliverableTemplate.filter({ 
        id: deliverableInstance.deliverable_template_id 
      }).then(r => r[0]),
      base44.entities.WorkflowInstance.filter({ 
        id: deliverableInstance.workflow_instance_id 
      }).then(r => r[0])
    ]);

    if (!deliverableTemplate?.document_template_ids?.[0]) {
      return Response.json({ error: 'No document template linked to deliverable' }, { status: 400 });
    }

    const [documentTemplate, client] = await Promise.all([
      base44.entities.DocumentTemplate.filter({ 
        id: deliverableTemplate.document_template_ids[0] 
      }).then(r => r[0]),
      base44.entities.Client.filter({ 
        id: workflowInstance.client_id 
      }).then(r => r[0])
    ]);

    if (!documentTemplate) {
      return Response.json({ error: 'Document template not found' }, { status: 404 });
    }

    // Gather all task instances for this deliverable
    const taskInstances = await base44.entities.TaskInstance.filter({
      deliverable_instance_id: deliverable_instance_id,
      status: 'completed'
    });

    // Build context data from required_entity_data
    const contextData = {};
    
    if (documentTemplate.required_entity_data) {
      for (const dataReq of documentTemplate.required_entity_data) {
        const { entity_type, field_path, description } = dataReq;
        
        if (entity_type === 'Client' && client) {
          const value = getNestedValue(client, field_path);
          if (value !== undefined) {
            contextData[`client_${field_path.replace(/\./g, '_')}`] = {
              value,
              description: description || `Client ${field_path}`
            };
          }
        } else if (entity_type === 'WorkflowInstance' && workflowInstance) {
          const value = getNestedValue(workflowInstance, field_path);
          if (value !== undefined) {
            contextData[`workflow_${field_path.replace(/\./g, '_')}`] = {
              value,
              description: description || `Workflow ${field_path}`
            };
          }
        } else if (entity_type === 'TaskInstance') {
          // Collect all task field values
          for (const task of taskInstances) {
            if (task.field_values) {
              for (const [fieldName, fieldValue] of Object.entries(task.field_values)) {
                contextData[`task_${task.name}_${fieldName}`.replace(/\s+/g, '_').toLowerCase()] = {
                  value: fieldValue,
                  description: `From task "${task.name}": ${fieldName}`
                };
              }
            }
          }
        }
      }
    }

    // Build AI prompt
    const contextString = Object.entries(contextData)
      .map(([key, data]) => `- ${data.description}: ${JSON.stringify(data.value)}`)
      .join('\n');

    const aiPrompt = `
You are generating a professional business document based on the following template and context.

DOCUMENT TEMPLATE STRUCTURE:
${documentTemplate.document_outline || 'Standard business document'}

TEMPLATE CONTENT BASE:
${stripHtml(documentTemplate.content_template || '')}

AI GENERATION INSTRUCTIONS:
${documentTemplate.ai_prompt_instructions || 'Generate professional, clear content based on the context provided.'}

CONTEXT DATA:
${contextString}

CLIENT INFORMATION:
- Name: ${client?.name || 'N/A'}
- Industry: ${client?.industry || 'N/A'}
- Region: ${client?.region || 'N/A'}
- Lifecycle Stage: ${client?.lifecycle_stage || 'N/A'}

WORKFLOW INFORMATION:
- Workflow: ${workflowInstance?.name || 'N/A'}
- Status: ${workflowInstance?.status || 'N/A'}

Please generate the complete document content in ${documentTemplate.output_format || 'markdown'} format. 
Use all the context data provided above to create a comprehensive, professional document.
Follow the template structure and generation instructions precisely.
    `.trim();

    // Call AI to generate document
    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      add_context_from_internet: false
    });

    // Determine file extension and handle PDF generation
    let fileUrl;
    let finalContent = aiResponse;
    
    if (documentTemplate.output_format === 'pdf') {
      // Generate PDF from markdown content
      const jsPDF = (await import('npm:jspdf@2.5.2')).default;
      const doc = new jsPDF();
      
      // Simple text wrapping for PDF
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let y = 20;
      
      // Add title
      doc.setFontSize(16);
      doc.text(documentTemplate.name, margin, y);
      y += 10;
      
      // Add content (strip markdown and format)
      doc.setFontSize(10);
      const lines = stripHtml(aiResponse).split('\n');
      
      for (const line of lines) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        
        if (line.trim()) {
          const wrappedLines = doc.splitTextToSize(line, maxWidth);
          doc.text(wrappedLines, margin, y);
          y += wrappedLines.length * 7;
        } else {
          y += 5;
        }
      }
      
      const pdfBytes = doc.output('arraybuffer');
      const fileName = `${documentTemplate.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
      
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new Blob([pdfBytes], { type: 'application/pdf' }),
        filename: fileName
      });
      
      fileUrl = uploadResponse.file_url;
    } else {
      // HTML or Markdown
      const fileExtension = documentTemplate.output_format === 'html' ? 'html' : 'md';
      const fileName = `${documentTemplate.name.replace(/\s+/g, '_')}_${new Date().getTime()}.${fileExtension}`;

      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: new Blob([aiResponse], { type: 'text/plain' }), 
        filename: fileName
      });

      fileUrl = uploadResponse.file_url;
    }

    // Create document instance with file_url (using service role for reliable creation)
    const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
      deliverable_instance_id: deliverable_instance_id,
      client_id: workflowInstance.client_id,
      document_template_id: documentTemplate.id,
      name: `${documentTemplate.name} - ${client?.name || 'Client'}`,
      content: finalContent,
      file_url: fileUrl,
      format: documentTemplate.output_format || 'markdown',
      status: 'draft',
      generated_by: 'ai',
      metadata: {
        generated_at: new Date().toISOString(),
        context_data: contextData
      }
    });

    // Update deliverable instance with document reference
    await base44.asServiceRole.entities.DeliverableInstance.update(deliverable_instance_id, {
      document_ids: [...(deliverableInstance.document_ids || []), documentInstance.id],
      ai_summary: `AI-generated document: ${documentInstance.name}`
    });

    return Response.json({
      success: true,
      document_instance_id: documentInstance.id,
      document_name: documentInstance.name,
      content_preview: aiResponse.substring(0, 200) + '...'
    });

  } catch (error) {
    console.error('Error generating AI document:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});

// Helper function to get nested object values
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to strip HTML tags for cleaner AI prompts
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}