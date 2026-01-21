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

        // Fetch all active pricing rules
        const allPricingRules = await base44.entities.PricingRule.filter({ is_active: true });

        const calculatedLineItems = [];
        let totalDealValue = 0;
        let totalPassThroughFees = 0;
        let totalDiscounts = 0;

        // Process each line item
        for (const item of line_items) {
            const { offering_id, offering_type, quantity = 1, custom_price, selected_pricing_rule_ids = [] } = item;

            // Fetch the offering
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

            // Start with base price
            let basePrice = custom_price || offering.base_price || 0;
            let applicablePricingRules = [];

            // Find applicable pricing rules
            if (selected_pricing_rule_ids.length > 0) {
                // User has manually selected pricing rules
                applicablePricingRules = allPricingRules.filter(rule => 
                    selected_pricing_rule_ids.includes(rule.id)
                );
            } else {
                // Auto-detect applicable rules
                applicablePricingRules = allPricingRules.filter(rule => {
                    // Check if rule applies to this offering
                    if (rule.applies_to_offering_ids && rule.applies_to_offering_ids.length > 0) {
                        if (!rule.applies_to_offering_ids.includes(offering_id)) {
                            return false;
                        }
                    }

                    // Check conditions
                    if (rule.conditions && Object.keys(rule.conditions).length > 0) {
                        for (const [key, value] of Object.entries(rule.conditions)) {
                            // Check client metadata
                            if (client.metadata && client.metadata[key] !== value) {
                                return false;
                            }
                            // Check offering metadata
                            if (offering.metadata && offering.metadata[key] !== value) {
                                return false;
                            }
                        }
                    }

                    // Check effective dates
                    const now = new Date();
                    if (rule.effective_from && new Date(rule.effective_from) > now) {
                        return false;
                    }
                    if (rule.effective_to && new Date(rule.effective_to) < now) {
                        return false;
                    }

                    return true;
                });

                // Sort by priority (higher priority first)
                applicablePricingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            }

            // Calculate line item value
            let lineItemValue = 0;
            let calculatedFees = [];
            let passThrough = 0;

            for (const rule of applicablePricingRules) {
                let fee = 0;

                switch (rule.calculation_method) {
                    case 'fixed_fee':
                        fee = rule.fee_value;
                        break;
                    
                    case 'percentage_of_value':
                        fee = (basePrice * quantity * rule.fee_value) / 100;
                        break;
                    
                    case 'per_unit':
                    case 'per_transaction':
                    case 'per_share':
                        fee = rule.fee_value * quantity;
                        break;
                    
                    case 'bps_of_value':
                        fee = (basePrice * quantity * rule.fee_value) / 10000;
                        break;
                    
                    case 'tiered':
                        if (rule.tiered_structure && Array.isArray(rule.tiered_structure)) {
                            for (const tier of rule.tiered_structure) {
                                if (quantity >= tier.from_quantity && 
                                    (!tier.to_quantity || quantity <= tier.to_quantity)) {
                                    fee = tier.fee_value * quantity;
                                    break;
                                }
                            }
                        }
                        break;
                    
                    default:
                        fee = rule.fee_value;
                }

                // Apply min/max constraints
                if (rule.minimum_fee && fee < rule.minimum_fee) {
                    fee = rule.minimum_fee;
                }
                if (rule.maximum_fee && fee > rule.maximum_fee) {
                    fee = rule.maximum_fee;
                }

                if (rule.is_pass_through) {
                    passThrough += fee;
                } else {
                    lineItemValue += fee;
                }

                calculatedFees.push({
                    rule_id: rule.id,
                    rule_name: rule.name,
                    calculation_method: rule.calculation_method,
                    fee_value: fee,
                    frequency: rule.frequency,
                    is_pass_through: rule.is_pass_through
                });
            }

            // Add base price
            lineItemValue += (basePrice * quantity);

            calculatedLineItems.push({
                offering_id,
                offering_type,
                offering_name: offering.name,
                quantity,
                base_price: basePrice,
                unit_price: basePrice,
                applied_rules: calculatedFees,
                pass_through_fees: passThrough,
                subtotal: lineItemValue,
                line_total: lineItemValue + passThrough
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