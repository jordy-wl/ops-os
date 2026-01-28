import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import PricingOptionsManager from './PricingOptionsManager';
import LocalPricingOptionsEditor from './LocalPricingOptionsEditor.jsx';

export default function CreateProductModal({ isOpen, onClose, editingProduct }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    short_description: '',
    description: '',
    category: 'software',
    features: [],
    target_audience: [],
    associated_workflows: [],
    is_active: true
  });
  const [newFeature, setNewFeature] = useState('');
  const [newAudience, setNewAudience] = useState('');
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [localPricingOptions, setLocalPricingOptions] = useState([]);

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list(),
    enabled: isOpen
  });

  React.useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        short_description: editingProduct.short_description || '',
        description: editingProduct.description || '',
        category: editingProduct.category || 'software',
        features: editingProduct.features || [],
        target_audience: editingProduct.target_audience || [],
        associated_workflows: editingProduct.associated_workflows || [],
        is_active: editingProduct.is_active !== undefined ? editingProduct.is_active : true
      });
    }
  }, [editingProduct]);

  const createMutation = useMutation({
    mutationFn: (data) => editingProduct 
      ? base44.entities.Product.update(editingProduct.id, data)
      : base44.entities.Product.create(data),
    onSuccess: async (createdProduct) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      // If creating a new product with local pricing options, bulk create them
      if (!editingProduct && localPricingOptions.length > 0) {
        try {
          const pricingOptionsToCreate = localPricingOptions.map(po => ({
            ...po,
            product_id: createdProduct.id
          }));
          await base44.entities.PricingOption.bulkCreate(pricingOptionsToCreate);
          queryClient.invalidateQueries({ queryKey: ['pricing-options'] });
        } catch (error) {
          toast.error('Product created, but failed to save pricing options: ' + error.message);
        }
      }
      
      toast.success(editingProduct ? 'Product updated' : 'Product created');
      onClose();
      setFormData({
        name: '',
        short_description: '',
        description: '',
        category: 'software',
        features: [],
        target_audience: [],
        associated_workflows: [],
        is_active: true
      });
      setLocalPricingOptions([]);
      if (!editingProduct) {
        navigate(createPageUrl('Offerings') + '?tab=products');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save product');
    }
  });

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData({ ...formData, features: [...formData.features, newFeature.trim()] });
      setNewFeature('');
    }
  };

  const removeFeature = (index) => {
    setFormData({ ...formData, features: formData.features.filter((_, i) => i !== index) });
  };

  const addAudience = () => {
    if (newAudience.trim()) {
      setFormData({ ...formData, target_audience: [...formData.target_audience, newAudience.trim()] });
      setNewAudience('');
    }
  };

  const removeAudience = (index) => {
    setFormData({ ...formData, target_audience: formData.target_audience.filter((_, i) => i !== index) });
  };

  const toggleWorkflow = (workflowId) => {
    const workflows = formData.associated_workflows || [];
    if (workflows.includes(workflowId)) {
      setFormData({ ...formData, associated_workflows: workflows.filter(id => id !== workflowId) });
    } else {
      setFormData({ ...formData, associated_workflows: [...workflows, workflowId] });
    }
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-2xl relative z-10 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Product name"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Short Description</label>
            <Input
              value={formData.short_description}
              onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
              placeholder="Brief one-liner..."
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed product description..."
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="managed_services">Managed Services</SelectItem>
                  <SelectItem value="implementation">Implementation</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Calculation Method</label>
              <Select value={formData.calculation_method} onValueChange={(v) => setFormData({ ...formData, calculation_method: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="fixed_fee">Fixed Fee</SelectItem>
                  <SelectItem value="percentage_of_value">Percentage of Value</SelectItem>
                  <SelectItem value="per_unit">Per Unit</SelectItem>
                  <SelectItem value="per_transaction">Per Transaction</SelectItem>
                  <SelectItem value="bps_of_value">Basis Points (BPS)</SelectItem>
                  <SelectItem value="tiered">Tiered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Base Price</label>
              <Input
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="0.00"
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Currency</label>
              <Input
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="USD"
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>
          </div>

          {/* Pricing Options */}
          <div className="border-t border-[#2C2E33] pt-4">
            {editingProduct ? (
              <PricingOptionsManager productId={editingProduct.id} isEditing={true} />
            ) : (
              <LocalPricingOptionsEditor 
                localPricingOptions={localPricingOptions}
                setLocalPricingOptions={setLocalPricingOptions}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Features</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                placeholder="Add a feature..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={addFeature} size="sm" className="bg-[#00E5FF]/20 text-[#00E5FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{feature}</span>
                  <button onClick={() => removeFeature(idx)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Target Audience</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAudience()}
                placeholder="e.g., Enterprise, SMBs..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={addAudience} size="sm" className="bg-[#00E5FF]/20 text-[#00E5FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.target_audience.map((audience, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{audience}</span>
                  <button onClick={() => removeAudience(idx)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Associated Workflows</label>
            
            {/* Selected Workflows */}
            {formData.associated_workflows?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.associated_workflows.map(workflowId => {
                  const workflow = workflows.find(w => w.id === workflowId);
                  return workflow ? (
                    <div key={workflowId} className="flex items-center gap-2 text-sm bg-[#00E5FF]/20 text-[#00E5FF] px-3 py-1 rounded-lg">
                      <span>{workflow.name}</span>
                      <button onClick={() => toggleWorkflow(workflowId)} className="hover:text-[#00E5FF]/70">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            <Input
              value={workflowSearch}
              onChange={(e) => setWorkflowSearch(e.target.value)}
              placeholder="Search workflows..."
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] mb-2"
            />
            <div className="space-y-2 max-h-40 overflow-y-auto bg-[#1A1B1E] rounded-lg p-3">
              {workflows.length === 0 ? (
                <p className="text-xs text-[#4A5568]">No workflows available</p>
              ) : (
                workflows
                  .filter(w => w.name.toLowerCase().includes(workflowSearch.toLowerCase()))
                  .map(workflow => (
                    <div key={workflow.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.associated_workflows?.includes(workflow.id)}
                        onCheckedChange={() => toggleWorkflow(workflow.id)}
                      />
                      <label className="text-sm cursor-pointer" onClick={() => toggleWorkflow(workflow.id)}>
                        {workflow.name}
                      </label>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || createMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
          >
            {createMutation.isPending ? (editingProduct ? 'Updating...' : 'Creating...') : (editingProduct ? 'Update Product' : 'Create Product')}
          </Button>
        </div>
      </div>
    </div>
  );
}