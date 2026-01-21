import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import puppeteer from 'npm:puppeteer@23.11.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template_id, client_id, deal_id, workflow_instance_id } = await req.json();

    // Fetch template
    const template = await base44.asServiceRole.entities.DocumentTemplate.filter({ id: template_id });
    if (!template || template.length === 0) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }
    const documentTemplate = template[0];

    // Fetch brand kit if specified
    let brandKit = null;
    if (documentTemplate.brand_kit_id) {
      const brandKits = await base44.asServiceRole.entities.BrandKit.filter({ id: documentTemplate.brand_kit_id });
      brandKit = brandKits[0] || null;
    }

    // Fetch contextual data
    let client = null;
    let deal = null;
    let workflowInstance = null;

    if (client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      client = clients[0] || null;
    }

    if (deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      deal = deals[0] || null;
    }

    if (workflow_instance_id) {
      const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ id: workflow_instance_id });
      workflowInstance = workflows[0] || null;
    }

    // Process sections
    const processedSections = [];
    for (const section of documentTemplate.sections || []) {
      let sectionContent = '';

      if (section.type === 'text') {
        // Generate text content using AI
        const contextData = {
          client,
          deal,
          workflow: workflowInstance
        };

        // Build data context for AI
        let dataContext = '';
        if (section.data_references && section.data_references.length > 0) {
          for (const ref of section.data_references) {
            const entityData = contextData[ref.entity_type?.toLowerCase()];
            if (entityData) {
              const fieldData = ref.field_paths?.map(path => {
                return `${path}: ${entityData[path]}`;
              }).join(', ');
              dataContext += `\n${ref.entity_type} data: ${fieldData}`;
              if (ref.usage_prompt) {
                dataContext += `\nHow to use: ${ref.usage_prompt}`;
              }
            }
          }
        }

        const aiPrompt = `
You are writing a section for a professional business document.

Section Title: ${section.title}
Instructions: ${section.ai_prompt}

${dataContext ? `Available Data:\n${dataContext}` : ''}

Generate well-structured, professional content for this section. Use markdown formatting for headers, lists, and emphasis.
        `.trim();

        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: aiPrompt,
          add_context_from_internet: false
        });

        sectionContent = aiResponse;
      } else if (section.type === 'chart') {
        // For charts, we'll create a placeholder that will be rendered in the PDF
        sectionContent = `
          <div class="chart-container">
            <h3>${section.title}</h3>
            <p class="chart-type">${section.chart_type} Chart</p>
            <p class="chart-note">Chart visualization based on: ${JSON.stringify(section.chart_data_source || {})}</p>
          </div>
        `;
      } else if (section.type === 'glossary' && documentTemplate.glossary_term_ids?.length > 0) {
        // Fetch glossary terms
        const terms = await base44.asServiceRole.entities.GlossaryTerm.list();
        const selectedTerms = terms.filter(t => documentTemplate.glossary_term_ids.includes(t.id));
        
        sectionContent = '<div class="glossary">\n';
        sectionContent += `<h2>${section.title || 'Glossary'}</h2>\n`;
        selectedTerms.forEach(term => {
          sectionContent += `<div class="glossary-item">\n`;
          sectionContent += `  <h4>${term.term}</h4>\n`;
          sectionContent += `  <p>${term.definition}</p>\n`;
          sectionContent += `</div>\n`;
        });
        sectionContent += '</div>';
      } else if (section.type === 'table') {
        sectionContent = `<div class="table-section"><h3>${section.title}</h3><p>Table content placeholder</p></div>`;
      } else if (section.type === 'appendix') {
        sectionContent = `<div class="appendix"><h3>${section.title}</h3><p>Appendix content</p></div>`;
      }

      processedSections.push({
        title: section.title,
        type: section.type,
        content: sectionContent,
        order: section.order
      });
    }

    // Sort sections by order
    processedSections.sort((a, b) => a.order - b.order);

    // Build HTML document
    const html = generateHTML(documentTemplate, processedSections, brandKit, client, deal);

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: brandKit?.page_margins || { top: '1in', right: '1in', bottom: '1in', left: '1in' }
    });

    await browser.close();

    // Upload PDF to storage
    const fileName = `${documentTemplate.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Create document instance
    const docInstance = await base44.asServiceRole.entities.DocumentInstance.create({
      document_template_id: template_id,
      client_id: client_id,
      workflow_instance_id: workflow_instance_id,
      name: documentTemplate.name,
      file_url: uploadResult.file_url,
      status: 'generated',
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      data_snapshot: { client, deal, sections: processedSections }
    });

    return Response.json({
      success: true,
      document_id: docInstance.id,
      file_url: uploadResult.file_url,
      sections_generated: processedSections.length
    });

  } catch (error) {
    console.error('Document generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateHTML(template, sections, brandKit, client, deal) {
  const primaryColor = brandKit?.primary_color || '#00E5FF';
  const secondaryColor = brandKit?.secondary_color || '#BD00FF';
  const fontFamily = brandKit?.font_family || 'Inter, sans-serif';
  const headingFont = brandKit?.font_family_heading || 'Poppins, sans-serif';
  
  let htmlContent = sections.map(s => {
    if (s.type === 'text') {
      // Convert markdown to basic HTML
      const html = s.content
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
      return `<section class="content-section">${html}</section>`;
    }
    return `<section class="content-section">${s.content}</section>`;
  }).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Poppins:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fontFamily};
      font-size: 11pt;
      line-height: 1.6;
      color: #2d3748;
      background: white;
    }
    
    h1, h2, h3, h4 {
      font-family: ${headingFont};
      color: ${primaryColor};
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }
    
    h1 { font-size: 24pt; font-weight: 700; }
    h2 { font-size: 18pt; font-weight: 600; margin-top: 1.5em; }
    h3 { font-size: 14pt; font-weight: 600; margin-top: 1em; }
    
    p {
      margin-bottom: 1em;
    }
    
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
      background: linear-gradient(135deg, ${primaryColor}22 0%, ${secondaryColor}22 100%);
    }
    
    .cover-page h1 {
      font-size: 36pt;
      margin-bottom: 0.5em;
    }
    
    .cover-page .client-name {
      font-size: 18pt;
      color: #4a5568;
    }
    
    ${brandKit?.logo_url ? `
    .logo {
      width: 150px;
      margin-bottom: 2em;
    }
    ` : ''}
    
    section {
      margin-bottom: 2em;
      page-break-inside: avoid;
    }
    
    .glossary {
      margin-top: 2em;
      page-break-before: always;
    }
    
    .glossary-item {
      margin-bottom: 1.5em;
      padding: 1em;
      background: #f7fafc;
      border-left: 4px solid ${primaryColor};
    }
    
    .glossary-item h4 {
      color: ${primaryColor};
      margin-bottom: 0.5em;
    }
    
    .chart-container {
      padding: 2em;
      background: #f7fafc;
      border-radius: 8px;
      margin: 2em 0;
    }
    
    .chart-type {
      font-weight: 600;
      color: ${secondaryColor};
    }
    
    ${brandKit?.custom_css || ''}
  </style>
</head>
<body>
  <div class="cover-page">
    ${brandKit?.logo_url ? `<img src="${brandKit.logo_url}" class="logo" alt="Logo" />` : ''}
    <h1>${template.name}</h1>
    ${client ? `<p class="client-name">Prepared for ${client.name}</p>` : ''}
    <p style="margin-top: 2em; color: #718096;">Generated on ${new Date().toLocaleDateString()}</p>
  </div>
  
  ${htmlContent}
</body>
</html>
  `.trim();
}