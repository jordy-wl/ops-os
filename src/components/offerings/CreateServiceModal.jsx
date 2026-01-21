import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function CreateServiceModal({ isOpen, onClose, editingService }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    short_description: '',
    description: '',
    category: 'consulting',
    pricing_model: { type: 'hourly' },
    base_price: '',
    currency: 'USD',
    features: [],
    target_audience: [],
    associated_workflows: [],
    is_active: true
  });
  const [newFeature, setNewFeature] = useState('');
  const [newAudience, setNewAudience] = useState('');

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list(),
    enabled: isOpen
  });

  React.useEffect(() => {
    if (editingService) {
      setFormData({
        name: editingService.name || '',
        short_description: editingService.short_description || '',
        description: editingService.description || '',
        category: editingService.category || 'consulting',
        pricing_model: editingService.pricing_model || { type: 'hourly' },
        base_price: editingService.base_price || '',
        currency: editingService.currency || 'USD',
        features: editingService.features || [],
        target_audience: editingService.target_audience || [],
        associated_workflows: editingService.associated_workflows || [],
        is_active: editingService.is_active !== undefined ? editingService.is_active : true
      });
    }
  }, [editingService]);

  const createMutation = useMutation({
    mutationFn: (data) => editingService
      ? base44.entities.Service.update(editingService.id, data)
      : base44.entities.Service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
      setFormData({
        name: '',
        short_description: '',
        description: '',
        category: 'consulting',
        pricing_model: { type: 'hourly' },
        base_price: '',
        currency: 'USD',
        features: [],
        target_audience: [],
        associated_workflows: [],
        is_active: true
      });
    },
  });

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      setFormData({ ...formData, [field]: [...formData[field], value.trim()] });
      setter('');
    }
  };

  const removeItem = (field, index) => {
    setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) });
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
    const submitData = { ...formData };
    if (submitData.base_price) {
      submitData.base_price = parseFloat(submitData.base_price);
    }
    createMutation.mutate(submitData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-2xl relative z-10 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{editingService ? 'Edit Service' : 'New Service'}</h2>
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
              placeholder="Service name"
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
              placeholder="Detailed service description..."
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
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="advisory">Advisory</SelectItem>
                  <SelectItem value="implementation">Implementation</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="managed_services">Managed Services</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Pricing Model</label>
              <Select 
                value={formData.pricing_model?.type || 'hourly'} 
                onValueChange={(v) => setFormData({ ...formData, pricing_model: { type: v } })}
              >
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="retainer">Retainer</SelectItem>
                  <SelectItem value="fixed">Fixed Fee</SelectItem>
                  <SelectItem value="value_based">Value-Based</SelectItem>
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

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Features</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('features', newFeature, setNewFeature)}
                placeholder="Add a feature..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={() => addItem('features', newFeature, setNewFeature)} size="sm" className="bg-[#00E5FF]/20 text-[#00E5FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{feature}</span>
                  <button onClick={() => removeItem('features', idx)} className="text-red-400 hover:text-red-300">
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
                onKeyPress={(e) => e.key === 'Enter' && addItem('target_audience', newAudience, setNewAudience)}
                placeholder="e.g., Enterprise, SMBs..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={() => addItem('target_audience', newAudience, setNewAudience)} size="sm" className="bg-[#00E5FF]/20 text-[#00E5FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.target_audience.map((audience, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{audience}</span>
                  <button onClick={() => removeItem('target_audience', idx)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Associated Workflows</label>
            <div className="space-y-2 max-h-40 overflow-y-auto bg-[#1A1B1E] rounded-lg p-3">
              {workflows.length === 0 ? (
                <p className="text-xs text-[#4A5568]">No workflows available</p>
              ) : (
                workflows.map(workflow => (
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
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/30"
          >
            {createMutation.isPending ? (editingService ? 'Updating...' : 'Creating...') : (editingService ? 'Update Service' : 'Create Service')}
          </Button>
        </div>
      </div>
    </div>
  );
}