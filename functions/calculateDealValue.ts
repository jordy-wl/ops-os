import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { deal_id, line_items, client_id } = await req.json();

        // Fetch client details for context
        const clients = await base44.entities.Client.filter({ id: client_id });
        const client = clients[0];

        if (!client) {
            return Response.json({ error: 'Client not found' }, { status: 404 });
        }

        const calculatedLineItems = [];
        let totalDealValue = 0;
        let totalPassThroughFees = 0;
        let totalDiscounts = 0;

        // Process each line item
        for (const item of line_items) {
            const { offering_id, offering_type, quantity = 1, custom_price } = item;

            // Fetch the offering (which now contains embedded pricing configuration)
            let offering;
            if (offering_type === 'product') {
                const products = await base44.entities.Product.filter({ id: offering_id });
                offering = products[0];
            } else {
                const services = await base44.entities.Service.filter({ id: offering_id });
                offering = services[0];
            }

            if (!offering) {
                continue;
            }

            // Use custom price if provided, otherwise calculate from offering's pricing config
            let unitPrice = custom_price || offering.base_price || 0;
            let calculatedFees = [];
            let passThrough = 0;
            let lineItemValue = 0;

            // If offering has pricing configuration and no custom price, calculate based on rules
            if (!custom_price && offering.calculation_method) {
                let calculatedPrice = 0;

                // Check if conditions match (e.g., jurisdiction, client tier)
                let conditionsMatch = true;
                if (offering.conditions && Object.keys(offering.conditions).length > 0) {
                    for (const [key, value] of Object.entries(offering.conditions)) {
                        // Check client metadata
                        if (client.metadata && client.metadata[key] !== value) {
                            conditionsMatch = false;
                            break;
                        }
                        // Check offering metadata
                        if (offering.metadata && offering.metadata[key] !== value) {
                            conditionsMatch = false;
                            break;
                        }
                    }
                }

                if (conditionsMatch) {
                    const feeValue = offering.fee_value || 0;

                    switch (offering.calculation_method) {
                        case 'fixed_fee':
                            calculatedPrice = feeValue;
                            break;
                        
                        case 'percentage_of_value':
                            calculatedPrice = (offering.base_price * feeValue) / 100;
                            break;
                        
                        case 'per_unit':
                        case 'per_transaction':
                        case 'per_share':
                            calculatedPrice = feeValue;
                            break;
                        
                        case 'bps_of_value':
                            calculatedPrice = (offering.base_price * feeValue) / 10000;
                            break;
                        
                        case 'tiered':
                            if (offering.tiered_structure && Array.isArray(offering.tiered_structure)) {
                                for (const tier of offering.tiered_structure) {
                                    if (quantity >= tier.from_quantity && 
                                        (!tier.to_quantity || quantity <= tier.to_quantity)) {
                                        calculatedPrice = tier.fee_value;
                                        break;
                                    }
                                }
                            }
                            break;
                        
                        default:
                            calculatedPrice = offering.base_price || 0;
                    }

                    // Apply min/max constraints
                    if (offering.minimum_fee && calculatedPrice < offering.minimum_fee) {
                        calculatedPrice = offering.minimum_fee;
                    }
                    if (offering.maximum_fee && calculatedPrice > offering.maximum_fee) {
                        calculatedPrice = offering.maximum_fee;
                    }

                    unitPrice = calculatedPrice;
                }

                // Track pass-through fees
                if (offering.is_pass_through) {
                    passThrough = unitPrice * quantity;
                    lineItemValue = 0;
                } else {
                    lineItemValue = unitPrice * quantity;
                }

                calculatedFees.push({
                    calculation_method: offering.calculation_method,
                    fee_value: unitPrice,
                    frequency: offering.frequency,
                    is_pass_through: offering.is_pass_through || false
                });
            } else {
                // No pricing calculation needed, just use unit price
                lineItemValue = unitPrice * quantity;
            }

            calculatedLineItems.push({
                offering_id,
                offering_type,
                offering_name: offering.name,
                quantity,
                base_price: offering.base_price || 0,
                unit_price: unitPrice,
                applied_pricing: calculatedFees,
                pass_through_fees: passThrough,
                subtotal: lineItemValue,
                line_total: lineItemValue + passThrough,
                frequency: offering.frequency || 'one_time'
            });

            totalDealValue += lineItemValue;
            totalPassThroughFees += passThrough;
        }

        const grandTotal = totalDealValue + totalPassThroughFees;

        return Response.json({
            success: true,
            deal_id,
            client_id,
            line_items: calculatedLineItems,
            summary: {
                subtotal: totalDealValue,
                pass_through_fees: totalPassThroughFees,
                total_discounts: totalDiscounts,
                grand_total: grandTotal
            }
        });

    } catch (error) {
        console.error('calculateDealValue error:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});