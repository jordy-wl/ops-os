import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id } = await req.json();

    if (!deal_id) {
      return Response.json({ error: 'deal_id is required' }, { status: 400 });
    }

    // Fetch deal and related data
    const [deal] = await base44.entities.Deal.filter({ id: deal_id });
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    const [client, lineItems] = await Promise.all([
      base44.entities.Client.filter({ id: deal.client_id }).then(r => r[0]),
      base44.entities.DealLineItem.filter({ deal_id: deal_id })
    ]);

    // Fetch all offerings
    const productIds = lineItems.filter(li => li.offering_type === 'product').map(li => li.offering_id);
    const serviceIds = lineItems.filter(li => li.offering_type === 'service').map(li => li.offering_id);

    const [products, services] = await Promise.all([
      productIds.length > 0 ? base44.entities.Product.filter({ id: { $in: productIds } }) : [],
      serviceIds.length > 0 ? base44.entities.Service.filter({ id: { $in: serviceIds } }) : []
    ]);

    // Build line items text
    const lineItemsText = lineItems.map(item => {
      const offering = item.offering_type === 'product'
        ? products.find(p => p.id === item.offering_id)
        : services.find(s => s.id === item.offering_id);
      
      return `- ${offering?.name || 'Unknown'}: ${item.quantity} × $${item.unit_price.toLocaleString()} ${item.discount_percentage > 0 ? `(-${item.discount_percentage}%)` : ''} = $${item.total_line_value.toLocaleString()}`;
    }).join('\n');

    const totalValue = lineItems.reduce((sum, item) => sum + item.total_line_value, 0);

    // Generate quote document using AI
    const aiPrompt = `
Generate a professional business quote document for the following deal:

CLIENT INFORMATION:
- Company: ${client.name}
- Industry: ${client.industry || 'N/A'}
- Region: ${client.region || 'N/A'}

DEAL INFORMATION:
- Deal Name: ${deal.name}
- Stage: ${deal.stage}
- Expected Close Date: ${deal.expected_close_date || 'TBD'}

LINE ITEMS:
${lineItemsText}

TOTAL VALUE: $${totalValue.toLocaleString()}

Please create a complete, professional quote document in markdown format that includes:
1. Header with company information and quote details
2. Client information section
3. Detailed line items with descriptions
4. Pricing breakdown
5. Terms and conditions
6. Signature section

Make it formal, clear, and ready to send to the client.
    `.trim();

    const quoteContent = await base44.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      add_context_from_internet: false
    });

    // Generate PDF
    const { jsPDF } = await import('npm:jspdf@2.5.2');
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let y = 20;
    
    doc.setFontSize(16);
    doc.text(`Quote: ${deal.name}`, margin, y);
    y += 15;
    
    doc.setFontSize(10);
    const lines = quoteContent.split('\n');
    
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      if (line.trim()) {
        const wrappedLines = doc.splitTextToSize(line.replace(/[#*]/g, ''), maxWidth);
        doc.text(wrappedLines, margin, y);
        y += wrappedLines.length * 7;
      } else {
        y += 5;
      }
    }
    
    const pdfBytes = doc.output('arraybuffer');
    const fileName = `Quote_${deal.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    const pdfFile = new File([pdfBytes], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
      file: pdfFile
    });

    // Get existing quotes for versioning
    const existingQuotes = await base44.entities.Quote.filter({ deal_id: deal_id });
    const versionNumber = existingQuotes.length + 1;

    // Create quote record
    const quote = await base44.asServiceRole.entities.Quote.create({
      deal_id: deal_id,
      version_number: versionNumber,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      total_quoted_value: totalValue,
      quote_document_url: uploadResponse.file_url,
      status: 'draft'
    });

    return Response.json({
      success: true,
      quote_id: quote.id,
      quote_url: uploadResponse.file_url,
      version: versionNumber
    });

  } catch (error) {
    console.error('Error generating quote:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});