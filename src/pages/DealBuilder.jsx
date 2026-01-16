import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Trash2, Package, Wrench, DollarSign, Sparkles, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function DealBuilder() {
  const params = new URLSearchParams(window.location.search);
  const dealId = params.get('id');
  const clientId = params.get('client');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [dealData, setDealData] = useState({
    name: '',
    stage: 'prospecting',
    expected_close_date: '',
    probability: 50
  });

  const [selectedOffering, setSelectedOffering] = useState(null);
  const [offeringType, setOfferingType] = useState('product');
  const [lineItemData, setLineItemData] = useState({
    quantity: 1,
    discount_percentage: 0
  });

  const { data: deal } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: async () => {
      const deals = await base44.entities.Deal.filter({ id: dealId });
      return deals[0];
    },
    enabled: !!dealId
  });

  const { data: client } = useQuery({
    queryKey: ['client', clientId || deal?.client_id],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: clientId || deal?.client_id });
      return clients[0];
    },
    enabled: !!(clientId || deal?.client_id)
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ is_active: true })
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.filter({ is_active: true })
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['deal-line-items', dealId],
    queryFn: () => base44.entities.DealLineItem.filter({ deal_id: dealId }),
    enabled: !!dealId
  });

  const { data: pricingRules = [] } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: () => base44.entities.PricingRule.filter({ is_active: true })
  });

  const createDealMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Deal.create(data);
    },
    onSuccess: (newDeal) => {
      toast.success('Deal created');
      navigate(createPageUrl('DealBuilder') + `?id=${newDeal.id}`);
    }
  });

  const addLineItemMutation = useMutation({
    mutationFn: async (item) => {
      return base44.entities.DealLineItem.create(item);
    },
    onSuccess: () => {
      toast.success('Line item added');
      queryClient.invalidateQueries({ queryKey: ['deal-line-items', dealId] });
      setSelectedOffering(null);
      setLineItemData({ quantity: 1, discount_percentage: 0 });
    }
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (itemId) => {
      await base44.entities.DealLineItem.delete(itemId);
    },
    onSuccess: () => {
      toast.success('Line item removed');
      queryClient.invalidateQueries({ queryKey: ['deal-line-items', dealId] });
    }
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.Deal.update(id, data);
    },
    onSuccess: () => {
      toast.success('Deal updated');
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
    }
  });

  const generateQuoteMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateQuoteDocument', {
        deal_id: dealId
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Quote generated');
      queryClient.invalidateQueries({ queryKey: ['quotes', dealId] });
    }
  });

  const handleCreateDeal = () => {
    if (!clientId) {
      toast.error('Client ID required');
      return;
    }
    createDealMutation.mutate({
      ...dealData,
      client_id: clientId,
      total_expected_value: 0
    });
  };

  const handleAddLineItem = () => {
    if (!selectedOffering || !dealId) return;

    const offering = offeringType === 'product' 
      ? products.find(p => p.id === selectedOffering)
      : services.find(s => s.id === selectedOffering);

    const unitPrice = offering.base_price || 0;
    const totalLineValue = (lineItemData.quantity * unitPrice) * (1 - lineItemData.discount_percentage / 100);

    addLineItemMutation.mutate({
      deal_id: dealId,
      offering_id: selectedOffering,
      offering_type: offeringType,
      quantity: lineItemData.quantity,
      unit_price: unitPrice,
      discount_percentage: lineItemData.discount_percentage,
      total_line_value: totalLineValue
    });
  };

  const totalDealValue = lineItems.reduce((sum, item) => sum + (item.total_line_value || 0), 0);

  React.useEffect(() => {
    if (dealId && totalDealValue !== deal?.total_expected_value) {
      updateDealMutation.mutate({
        id: dealId,
        data: { total_expected_value: totalDealValue }
      });
    }
  }, [totalDealValue]);

  const getOfferingName = (item) => {
    if (item.offering_type === 'product') {
      return products.find(p => p.id === item.offering_id)?.name || 'Unknown Product';
    } else {
      return services.find(s => s.id === item.offering_id)?.name || 'Unknown Service';
    }
  };

  if (!dealId && !clientId) {
    return (
      <div className="p-6">
        <p className="text-[#A0AEC0]">Please select a client to create a deal</p>
      </div>
    );
  }

  if (!dealId) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Create New Deal</h1>
          <div className="neumorphic-raised rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Deal Name</label>
              <Input
                value={dealData.name}
                onChange={(e) => setDealData({ ...dealData, name: e.target.value })}
                placeholder="Q1 2026 Implementation"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Stage</label>
              <Select value={dealData.stage} onValueChange={(v) => setDealData({ ...dealData, stage: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Expected Close Date</label>
              <Input
                type="date"
                value={dealData.expected_close_date}
                onChange={(e) => setDealData({ ...dealData, expected_close_date: e.target.value })}
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Probability (%)</label>
              <Input
                type="number"
                value={dealData.probability}
                onChange={(e) => setDealData({ ...dealData, probability: Number(e.target.value) })}
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <Button
              onClick={handleCreateDeal}
              disabled={!dealData.name || createDealMutation.isPending}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              Create Deal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('ClientDetail') + `?id=${client?.id}`}>
            <Button variant="ghost" size="icon" className="hover:bg-[#2C2E33]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{deal?.name || 'Deal Builder'}</h1>
            <p className="text-sm text-[#A0AEC0]">{client?.name}</p>
          </div>
        </div>
        <Button
          onClick={() => generateQuoteMutation.mutate()}
          disabled={lineItems.length === 0 || generateQuoteMutation.isPending}
          className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
        >
          <FileText className="w-4 h-4 mr-2" />
          Generate Quote
        </Button>
      </div>

      {/* Deal Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Stage</p>
          <p className="font-bold capitalize">{deal?.stage.replace('_', ' ')}</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Total Value</p>
          <p className="text-2xl font-bold">${totalDealValue.toLocaleString()}</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Probability</p>
          <p className="font-bold">{deal?.probability}%</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Line Items</p>
          <p className="font-bold">{lineItems.length}</p>
        </div>
      </div>

      {/* Add Line Item */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Add Line Item</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Type</label>
            <Select value={offeringType} onValueChange={setOfferingType}>
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Offering</label>
            <Select value={selectedOffering} onValueChange={setSelectedOffering}>
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {(offeringType === 'product' ? products : services).map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Quantity</label>
            <Input
              type="number"
              value={lineItemData.quantity}
              onChange={(e) => setLineItemData({ ...lineItemData, quantity: Number(e.target.value) })}
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>
          <div>
            <label className="text-sm text-[#A0AEC0] mb-2 block">Discount (%)</label>
            <Input
              type="number"
              value={lineItemData.discount_percentage}
              onChange={(e) => setLineItemData({ ...lineItemData, discount_percentage: Number(e.target.value) })}
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAddLineItem}
              disabled={!selectedOffering || addLineItemMutation.isPending}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Line Items</h3>
        {lineItems.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-[#4A5568] mx-auto mb-2" />
            <p className="text-[#A0AEC0]">No line items yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="neumorphic-pressed rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {item.offering_type === 'product' ? (
                    <Package className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Wrench className="w-5 h-5 text-orange-400" />
                  )}
                  <div>
                    <p className="font-medium">{getOfferingName(item)}</p>
                    <p className="text-xs text-[#A0AEC0]">
                      Qty: {item.quantity} × ${item.unit_price.toLocaleString()}
                      {item.discount_percentage > 0 && ` (-${item.discount_percentage}%)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold">${item.total_line_value.toLocaleString()}</p>
                  <button
                    onClick={() => deleteLineItemMutation.mutate(item.id)}
                    className="p-2 rounded hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}