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

    // Fetch client, line items, and contacts in parallel
    const [client, lineItems, dealContactRelations] = await Promise.all([
      base44.entities.Client.filter({ id: deal.client_id }).then(r => r[0]),
      base44.entities.DealLineItem.filter({ deal_id: deal_id }),
      deal.deal_contacts?.length > 0 
        ? Promise.all(deal.deal_contacts.map(id => base44.entities.Contact.filter({ id }).then(r => r[0])))
        : []
    ]);

    // Calculate deal value using the CPQ function
    const calculationResponse = await base44.functions.invoke('calculateDealValue', {
      deal_id: deal_id,
      client_id: deal.client_id,
      line_items: lineItems.map(item => ({
        offering_id: item.offering_id,
        offering_type: item.offering_type,
        quantity: item.quantity,
        custom_price: item.unit_price,
        selected_pricing_rule_ids: []
      }))
    });

    const calculatedDeal = calculationResponse.data;

    // Fetch term blocks if specified
    let termBlocksContent = '';
    if (deal.terms_and_conditions?.length > 0) {
      const termBlocks = await Promise.all(
        deal.terms_and_conditions.map(id => 
          base44.entities.TermBlock.filter({ id }).then(r => r[0])
        )
      );
      
      termBlocksContent = termBlocks
        .filter(Boolean)
        .map(block => `### ${block.name}\n\n${block.content}\n`)
        .join('\n');
    }

    // Build detailed line items with pricing rules
    const lineItemsDetail = calculatedDeal.line_items.map(item => {
      let detail = `**${item.offering_name}**\n`;
      detail += `- Quantity: ${item.quantity}\n`;
      detail += `- Unit Price: $${item.unit_price.toLocaleString()}\n`;
      detail += `- Base Total: $${item.subtotal.toLocaleString()}\n`;
      
      if (item.applied_rules?.length > 0) {
        detail += `- Applied Pricing Rules:\n`;
        item.applied_rules.forEach(rule => {
          detail += `  - ${rule.rule_name} (${rule.calculation_method.replace('_', ' ')}): $${rule.fee_value.toLocaleString()}`;
          if (rule.is_pass_through) detail += ` (Pass-through)`;
          if (rule.frequency) detail += ` - ${rule.frequency}`;
          detail += `\n`;
        });
      }
      
      if (item.pass_through_fees > 0) {
        detail += `- Pass-through Fees: $${item.pass_through_fees.toLocaleString()}\n`;
      }
      
      detail += `- **Line Total: $${item.line_total.toLocaleString()}**\n`;
      
      return detail;
    }).join('\n\n');

    // Build contacts section
    const contactsSection = dealContactRelations.length > 0
      ? dealContactRelations.map(c => 
          `${c.first_name} ${c.last_name}${c.job_title ? ` - ${c.job_title}` : ''}\n${c.email}${c.phone ? ` | ${c.phone}` : ''}`
        ).join('\n\n')
      : 'N/A';

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

DEAL CONTACTS:
${contactsSection}

LINE ITEMS WITH DETAILED PRICING:
${lineItemsDetail}

PRICING SUMMARY:
- Subtotal: $${calculatedDeal.summary.subtotal.toLocaleString()}
- Pass-through Fees: $${calculatedDeal.summary.pass_through_fees.toLocaleString()}
- **TOTAL VALUE: $${calculatedDeal.summary.grand_total.toLocaleString()}**

${deal.custom_terms ? `CUSTOM TERMS:\n${deal.custom_terms}\n` : ''}

${termBlocksContent ? `STANDARD TERMS & CONDITIONS:\n${termBlocksContent}` : ''}

Please create a complete, professional quote document in markdown format that includes:
1. Header with company information, quote number, and date
2. Client information section with contacts
3. Executive summary
4. Detailed line items table with all pricing rules, frequencies, and pass-through fees clearly shown
5. Pricing breakdown and summary
6. Payment terms and conditions
7. Custom terms if provided
8. Standard terms and conditions from the term blocks
9. Acceptance and signature section

Make it formal, clear, comprehensive, and ready to send to the client. Emphasize transparency in pricing with all fees clearly itemized.
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
    y += 10;
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 15;
    
    const lines = quoteContent.split('\n');
    
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      if (line.trim()) {
        const cleanLine = line.replace(/[#*]/g, '').trim();
        if (cleanLine) {
          const wrappedLines = doc.splitTextToSize(cleanLine, maxWidth);
          doc.text(wrappedLines, margin, y);
          y += wrappedLines.length * 5;
        }
      } else {
        y += 3;
      }
    }
    
    const pdfBytes = doc.output('arraybuffer');
    const fileName = `Quote_${deal.name.replace(/\s+/g, '_')}_v${(await base44.entities.Quote.filter({ deal_id: deal_id })).length + 1}_${Date.now()}.pdf`;
    const pdfFile = new File([pdfBytes], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
      file: pdfFile
    });

    // Get existing quotes for versioning
    const existingQuotes = await base44.entities.Quote.filter({ deal_id: deal_id });
    const versionNumber = existingQuotes.length + 1;

    // Generate secure token for deal room access
    const dealRoomToken = crypto.randomUUID();

    // Create quote record with full content
    const quote = await base44.asServiceRole.entities.Quote.create({
      deal_id: deal_id,
      version_number: versionNumber,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      total_quoted_value: calculatedDeal.summary.grand_total,
      quote_document_url: uploadResponse.file_url,
      status: 'draft',
      content: quoteContent,
      deal_room_token: dealRoomToken
    });

    // Update deal with deal room URL
    await base44.asServiceRole.entities.Deal.update(deal_id, {
      deal_room_url: `/deal-room?token=${dealRoomToken}`,
      deal_room_token: dealRoomToken
    });

    return Response.json({
      success: true,
      quote_id: quote.id,
      quote_url: uploadResponse.file_url,
      version: versionNumber,
      deal_room_url: `/deal-room?token=${dealRoomToken}`,
      deal_room_token: dealRoomToken
    });

  } catch (error) {
    console.error('Error generating quote:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});