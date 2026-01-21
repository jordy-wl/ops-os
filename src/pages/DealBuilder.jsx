import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Trash2, Package, Wrench, DollarSign, Sparkles, FileText, Users, FileSignature, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPageUrl } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AddLineItemModal from '../components/deals/AddLineItemModal';
import TermsConditionsPanel from '../components/deals/TermsConditionsPanel';
import DealContactsPanel from '../components/deals/DealContactsPanel';

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
    probability: 50,
    deal_owner_id: '',
    terms_and_conditions: [],
    custom_terms: '',
    deal_contacts: []
  });

  const [lineItems, setLineItems] = useState([]);
  const [isAddLineItemOpen, setIsAddLineItemOpen] = useState(false);
  const [calculatedDealValue, setCalculatedDealValue] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

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

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: termBlocks = [] } = useQuery({
    queryKey: ['term-blocks'],
    queryFn: () => base44.entities.TermBlock.list()
  });

  const { data: existingLineItems = [] } = useQuery({
    queryKey: ['deal-line-items', dealId],
    queryFn: () => base44.entities.DealLineItem.filter({ deal_id: dealId }),
    enabled: !!dealId
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

  // Load existing line items when deal is loaded
  useEffect(() => {
    if (existingLineItems.length > 0) {
      setLineItems(existingLineItems.map(item => ({
        offering_id: item.offering_id,
        offering_type: item.offering_type,
        quantity: item.quantity,
        custom_price: item.unit_price,
        selected_pricing_rule_ids: []
      })));
    }
  }, [existingLineItems]);

  // Calculate deal value when line items change
  useEffect(() => {
    if (dealId && lineItems.length > 0 && clientId) {
      calculateDealValue();
    }
  }, [lineItems, dealId, clientId]);

  const calculateDealValue = async () => {
    if (!dealId || lineItems.length === 0) return;
    
    setIsCalculating(true);
    try {
      const response = await base44.functions.invoke('calculateDealValue', {
        deal_id: dealId,
        client_id: clientId || deal?.client_id,
        line_items: lineItems
      });
      
      setCalculatedDealValue(response.data);
      
      // Update deal total
      if (response.data?.summary?.grand_total !== deal?.total_expected_value) {
        updateDealMutation.mutate({
          id: dealId,
          data: { total_expected_value: response.data.summary.grand_total }
        });
      }
    } catch (error) {
      console.error('Calculate deal value error:', error);
      toast.error('Failed to calculate deal value');
    } finally {
      setIsCalculating(false);
    }
  };

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

  const handleAddLineItem = (newItem) => {
    setLineItems(prev => [...prev, newItem]);
    
    // Also create in database if deal exists
    if (dealId) {
      base44.entities.DealLineItem.create({
        deal_id: dealId,
        ...newItem,
        unit_price: newItem.custom_price || 0,
        total_line_value: 0
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['deal-line-items', dealId] });
      });
    }
  };

  const handleRemoveLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
    
    // Also delete from database if exists
    const existingItem = existingLineItems[index];
    if (existingItem?.id) {
      deleteLineItemMutation.mutate(existingItem.id);
    }
  };

  const handleUpdateDeal = (updates) => {
    setDealData(prev => ({ ...prev, ...updates }));
    
    if (dealId) {
      updateDealMutation.mutate({
        id: dealId,
        data: updates
      });
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
          <div className="neumorphic-raised rounded-xl p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Deal Name *</label>
              <Input
                value={dealData.name}
                onChange={(e) => setDealData({ ...dealData, name: e.target.value })}
                placeholder="Q1 2026 Implementation"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm text-[#A0AEC0] mb-2 block">Probability (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={dealData.probability}
                  onChange={(e) => setDealData({ ...dealData, probability: Number(e.target.value) })}
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm text-[#A0AEC0] mb-2 block">Deal Owner</label>
                <Select value={dealData.deal_owner_id} onValueChange={(v) => setDealData({ ...dealData, deal_owner_id: v })}>
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue placeholder="Select owner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Initial Terms & Conditions</label>
              <Select
                value={dealData.terms_and_conditions.length > 0 ? dealData.terms_and_conditions[0] : ''}
                onValueChange={(v) => {
                  if (v && !dealData.terms_and_conditions.includes(v)) {
                    setDealData({ ...dealData, terms_and_conditions: [...dealData.terms_and_conditions, v] });
                  }
                }}
              >
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue placeholder="Add term blocks..." />
                </SelectTrigger>
                <SelectContent>
                  {termBlocks.map(block => (
                    <SelectItem key={block.id} value={block.id}>
                      {block.name} ({block.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dealData.terms_and_conditions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {dealData.terms_and_conditions.map(termId => {
                    const block = termBlocks.find(b => b.id === termId);
                    return (
                      <div key={termId} className="flex items-center gap-2 text-xs bg-[#1A1B1E] px-2 py-1 rounded">
                        <span className="flex-1">{block?.name}</span>
                        <button
                          onClick={() => setDealData({
                            ...dealData,
                            terms_and_conditions: dealData.terms_and_conditions.filter(id => id !== termId)
                          })}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Custom Terms</label>
              <Input
                value={dealData.custom_terms}
                onChange={(e) => setDealData({ ...dealData, custom_terms: e.target.value })}
                placeholder="Any deal-specific custom terms..."
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <Button
              onClick={handleCreateDeal}
              disabled={!dealData.name || createDealMutation.isPending}
              className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              {createDealMutation.isPending ? 'Creating...' : 'Create Deal'}
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
            <h1 className="text-2xl font-bold">{deal?.name || 'Solution Builder'}</h1>
            <p className="text-sm text-[#A0AEC0]">{client?.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={calculateDealValue}
            disabled={lineItems.length === 0 || isCalculating}
            className="bg-[#2C2E33] hover:bg-[#3a3d44] text-[#00E5FF]"
          >
            <Calculator className="w-4 h-4 mr-2" />
            {isCalculating ? 'Calculating...' : 'Recalculate'}
          </Button>
          <Button
            onClick={() => generateQuoteMutation.mutate()}
            disabled={lineItems.length === 0 || generateQuoteMutation.isPending}
            className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Quote
          </Button>
        </div>
      </div>

      {/* Deal Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Stage</p>
          <p className="font-bold capitalize">{deal?.stage.replace('_', ' ')}</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Subtotal</p>
          <p className="text-xl font-bold">
            ${calculatedDealValue?.summary?.subtotal?.toLocaleString() || '0'}
          </p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Pass-Through Fees</p>
          <p className="text-xl font-bold text-orange-400">
            ${calculatedDealValue?.summary?.pass_through_fees?.toLocaleString() || '0'}
          </p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Total Value</p>
          <p className="text-2xl font-bold text-[#00E5FF]">
            ${calculatedDealValue?.summary?.grand_total?.toLocaleString() || '0'}
          </p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <p className="text-xs text-[#A0AEC0] mb-1">Line Items</p>
          <p className="font-bold">{lineItems.length}</p>
        </div>
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="line-items" className="w-full">
        <TabsList className="neumorphic-pressed">
          <TabsTrigger value="line-items">
            <Package className="w-4 h-4 mr-2" />
            Line Items
          </TabsTrigger>
          <TabsTrigger value="terms">
            <FileSignature className="w-4 h-4 mr-2" />
            Terms & Conditions
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="w-4 h-4 mr-2" />
            Deal Contacts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="line-items" className="space-y-4">
          {/* Add Line Item Button */}
          <Button
            onClick={() => setIsAddLineItemOpen(true)}
            className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Line Item
          </Button>

          {/* Line Items List */}
          <div className="neumorphic-raised rounded-xl p-6">
            {lineItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-[#4A5568] mx-auto mb-4" />
                <p className="text-[#A0AEC0] mb-2">No line items yet</p>
                <p className="text-xs text-[#4A5568]">Add products or services to start building your solution</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calculatedDealValue?.line_items?.map((item, index) => (
                  <div key={index} className="neumorphic-pressed rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {item.offering_type === 'product' ? (
                          <Package className="w-5 h-5 text-blue-400 mt-1" />
                        ) : (
                          <Wrench className="w-5 h-5 text-orange-400 mt-1" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium mb-1">{item.offering_name}</p>
                          <div className="flex items-center gap-4 text-xs text-[#A0AEC0] mb-2">
                            <span>Qty: {item.quantity}</span>
                            <span>•</span>
                            <span>Unit: ${item.unit_price.toLocaleString()}</span>
                            <span>•</span>
                            <span>Base: ${item.subtotal.toLocaleString()}</span>
                          </div>

                          {item.applied_rules?.length > 0 && (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-[#A0AEC0]">Applied Rules:</p>
                              {item.applied_rules.map((rule, rIdx) => (
                                <div key={rIdx} className="text-xs flex items-center justify-between bg-[#1A1B1E] rounded px-2 py-1">
                                  <span className={rule.is_pass_through ? 'text-orange-400' : 'text-[#A0AEC0]'}>
                                    {rule.rule_name} ({rule.calculation_method.replace('_', ' ')})
                                    {rule.is_pass_through && ' (Pass-through)'}
                                  </span>
                                  <span className="font-mono">${rule.fee_value.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.pass_through_fees > 0 && (
                            <div className="mt-2 text-xs text-orange-400">
                              Pass-through fees: ${item.pass_through_fees.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-start gap-3">
                        <div>
                          <p className="text-lg font-bold">${item.line_total.toLocaleString()}</p>
                          <p className="text-xs text-[#4A5568]">Total</p>
                        </div>
                        <button
                          onClick={() => handleRemoveLineItem(index)}
                          className="p-2 rounded hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="terms">
          <div className="neumorphic-raised rounded-xl p-6">
            <TermsConditionsPanel
              dealId={dealId}
              selectedTermBlockIds={dealData.terms_and_conditions || []}
              onUpdate={handleUpdateDeal}
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <div className="neumorphic-raised rounded-xl p-6">
            <DealContactsPanel
              dealId={dealId}
              clientId={clientId || deal?.client_id}
              selectedContactIds={dealData.deal_contacts || []}
              onUpdate={handleUpdateDeal}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Line Item Modal */}
      <AddLineItemModal
        isOpen={isAddLineItemOpen}
        onClose={() => setIsAddLineItemOpen(false)}
        onAdd={handleAddLineItem}
        clientId={clientId || deal?.client_id}
      />
    </div>
  );
}