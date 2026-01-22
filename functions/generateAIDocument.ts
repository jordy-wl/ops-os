import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import puppeteer from 'npm:puppeteer@23.11.0';

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

    // Fetch brand kit if specified
    let brandKit = null;
    if (documentTemplate.brand_kit_id) {
      brandKit = await base44.entities.BrandKit.filter({ 
        id: documentTemplate.brand_kit_id 
      }).then(r => r[0]);
    }

    // Fetch glossary terms if specified
    let glossaryTerms = [];
    if (documentTemplate.glossary_term_ids?.length > 0) {
      glossaryTerms = await Promise.all(
        documentTemplate.glossary_term_ids.map(id =>
          base44.entities.GlossaryTerm.filter({ id }).then(r => r[0])
        )
      );
    }

    // Gather all task instances for this deliverable
    const taskInstances = await base44.entities.TaskInstance.filter({
      deliverable_instance_id: deliverable_instance_id,
      status: 'completed'
    });

    // Build context data helper function
    const buildContextData = (dataReferences) => {
      const contextData = {};
      for (const ref of dataReferences) {
        const { entity_type, field_paths } = ref;
        for (const field_path of field_paths || []) {
          if (entity_type === 'Client' && client) {
            const value = getNestedValue(client, field_path);
            if (value !== undefined) {
              contextData[`client_${field_path.replace(/\./g, '_')}`] = {
                value,
                description: `Client ${field_path}`
              };
            }
          } else if (entity_type === 'Workflow' && workflowInstance) {
            const value = getNestedValue(workflowInstance, field_path);
            if (value !== undefined) {
              contextData[`workflow_${field_path.replace(/\./g, '_')}`] = {
                value,
                description: `Workflow ${field_path}`
              };
            }
          }
        }
      }
      // Add task data
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
      return contextData;
    };

    // Generate content for each section
    const sections = documentTemplate.sections || [];
    const generatedSections = [];

    for (const section of sections.sort((a, b) => a.order - b.order)) {
      if (section.type === 'text') {
        const contextData = buildContextData(section.data_references || []);
        const contextString = Object.entries(contextData)
          .map(([key, data]) => `- ${data.description}: ${JSON.stringify(data.value)}`)
          .join('\n');

        const sectionPrompt = `
Generate content for the "${section.title}" section of a professional business document.

SECTION INSTRUCTIONS:
${section.ai_prompt || 'Generate professional, clear content.'}

CONTEXT DATA:
${contextString}

CLIENT: ${client?.name || 'N/A'} (${client?.industry || 'N/A'})
WORKFLOW: ${workflowInstance?.name || 'N/A'}

Generate the section content in HTML format with appropriate heading tags.
        `.trim();

        const content = await base44.integrations.Core.InvokeLLM({
          prompt: sectionPrompt,
          add_context_from_internet: false
        });

        generatedSections.push({
          title: section.title,
          type: section.type,
          content
        });
      } else if (section.type === 'chart') {
        generatedSections.push({
          title: section.title,
          type: section.type,
          content: `<div class="chart-placeholder"><p>Chart: ${section.chart_type || 'bar'}</p><p>${section.title}</p></div>`
        });
      } else if (section.type === 'glossary') {
        const glossaryHtml = glossaryTerms.map(term => 
          `<div class="glossary-term"><strong>${term.term}</strong>: ${term.definition}</div>`
        ).join('\n');
        generatedSections.push({
          title: section.title,
          type: section.type,
          content: `<div class="glossary">${glossaryHtml}</div>`
        });
      } else if (section.type === 'table' || section.type === 'appendix') {
        generatedSections.push({
          title: section.title,
          type: section.type,
          content: `<div class="${section.type}"><p>${section.title} content will be generated here.</p></div>`
        });
      }
    }

    // Build branded HTML document
    const sectionsHtml = generatedSections.map(section => `
      <section class="document-section ${section.type}">
        <h2>${section.title}</h2>
        ${section.content}
      </section>
    `).join('\n');

    const brandedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${documentTemplate.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(brandKit?.font_family_heading || 'Poppins')}:wght@300;400;600&family=${encodeURIComponent(brandKit?.font_family || 'Inter')}:wght@300;400;500&display=swap');
    
    body {
      font-family: ${brandKit?.font_family || 'Inter, sans-serif'};
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 40px;
    }
    
    h1, h2, h3 {
      font-family: ${brandKit?.font_family_heading || 'Poppins, sans-serif'};
      color: ${brandKit?.primary_color || '#00E5FF'};
    }
    
    h1 { font-size: 32px; margin-bottom: 10px; }
    h2 { font-size: 24px; margin-top: 30px; margin-bottom: 15px; }
    h3 { font-size: 18px; margin-top: 20px; }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${brandKit?.primary_color || '#00E5FF'};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .logo {
      max-width: 200px;
      max-height: 80px;
    }
    
    .document-section {
      margin-bottom: 40px;
    }
    
    .chart-placeholder {
      background: ${brandKit?.accent_color || '#F5F5F5'};
      padding: 40px;
      text-align: center;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .glossary-term {
      margin: 10px 0;
      padding: 10px;
      background: ${brandKit?.accent_color || '#F5F5F5'};
      border-left: 3px solid ${brandKit?.secondary_color || '#BD00FF'};
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid ${brandKit?.primary_color || '#00E5FF'};
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    
    ${brandKit?.custom_css || ''}
  </style>
</head>
<body>
  ${brandKit?.header_html_template || `
    <div class="header">
      ${brandKit?.logo_url ? `<img src="${brandKit.logo_url}" class="logo" alt="Logo" />` : ''}
      <div>
        <h1>${documentTemplate.name}</h1>
        <p>Generated for ${client?.name || 'Client'}</p>
      </div>
    </div>
  `}
  
  ${sectionsHtml}
  
  ${brandKit?.footer_html_template || `
    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
  `}
</body>
</html>
    `;

    let fileUrl;
    let finalContent = brandedHtml;
    
    if (documentTemplate.output_format === 'pdf') {
      // Generate PDF using Puppeteer for better rendering
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(brandedHtml);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: brandKit?.page_margins?.top || '1in',
          right: brandKit?.page_margins?.right || '1in',
          bottom: brandKit?.page_margins?.bottom || '1in',
          left: brandKit?.page_margins?.left || '1in'
        },
        printBackground: true
      });
      
      await browser.close();
      
      const fileName = `${documentTemplate.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
      const pdfFile = new File([pdfBuffer], fileName, { type: 'application/pdf' });
      
      const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
        file: pdfFile
      });
      
      fileUrl = uploadResponse.file_url;
    } else {
      // HTML or Markdown
      const fileExtension = documentTemplate.output_format === 'html' ? 'html' : 'md';
      const fileName = `${documentTemplate.name.replace(/\s+/g, '_')}_${new Date().getTime()}.${fileExtension}`;

      const textFile = new File([finalContent], fileName, { type: 'text/plain' });

      const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
        file: textFile
      });

      fileUrl = uploadResponse.file_url;
    }

    // Create document instance with file_url (using service role for reliable creation)
    const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
      deliverable_instance_id: deliverable_instance_id,
      client_id: workflowInstance.client_id,
      workflow_instance_id: workflowInstance.id,
      document_template_id: documentTemplate.id,
      name: `${documentTemplate.name} - ${client?.name || 'Client'}`,
      generated_content: finalContent,
      file_url: fileUrl,
      status: 'generated',
      generated_at: new Date().toISOString(),
      generated_by: 'ai',
      metadata: {
        generated_at: new Date().toISOString(),
        sections: generatedSections.length,
        brand_kit: brandKit?.name || 'none'
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
      file_url: fileUrl,
      sections_generated: generatedSections.length
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