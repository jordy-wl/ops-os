import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, DollarSign, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function PricingOptionsManager({ productId, serviceId, isEditing = true }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    calculation_method: 'fixed_fee',
    fee_value: '',
    fee_unit: 'USD',
    minimum_fee: '',
    maximum_fee: '',
    frequency: 'one_time',
    is_default: false
  });

  const { data: pricingOptions = [] } = useQuery({
    queryKey: ['pricing-options', productId, serviceId],
    queryFn: async () => {
      const allOptions = await base44.entities.PricingOption.list();
      return allOptions.filter(opt => 
        (productId && opt.product_id === productId) || 
        (serviceId && opt.service_id === serviceId)
      );
    },
    enabled: !!(productId || serviceId)
  });

  const createMutation = useMutation({
    mutationFn: (data) => editingOption
      ? base44.entities.PricingOption.update(editingOption.id, data)
      : base44.entities.PricingOption.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-options'] });
      toast.success(editingOption ? 'Pricing option updated' : 'Pricing option added');
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PricingOption.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-options'] });
      toast.success('Pricing option removed');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      calculation_method: 'fixed_fee',
      fee_value: '',
      fee_unit: 'USD',
      minimum_fee: '',
      maximum_fee: '',
      frequency: 'one_time',
      is_default: false
    });
    setShowForm(false);
    setEditingOption(null);
  };

  const handleEdit = (option) => {
    setEditingOption(option);
    setFormData({
      name: option.name || '',
      calculation_method: option.calculation_method || 'fixed_fee',
      fee_value: option.fee_value || '',
      fee_unit: option.fee_unit || 'USD',
      minimum_fee: option.minimum_fee || '',
      maximum_fee: option.maximum_fee || '',
      frequency: option.frequency || 'one_time',
      is_default: option.is_default || false
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      product_id: productId || null,
      service_id: serviceId || null,
      fee_value: formData.fee_value ? parseFloat(formData.fee_value) : null,
      minimum_fee: formData.minimum_fee ? parseFloat(formData.minimum_fee) : null,
      maximum_fee: formData.maximum_fee ? parseFloat(formData.maximum_fee) : null
    };
    createMutation.mutate(data);
  };

  const formatPricing = (option) => {
    const parts = [];
    if (option.fee_value) {
      if (option.fee_unit === 'percentage') {
        parts.push(`${option.fee_value}%`);
      } else if (option.fee_unit === 'BPS') {
        parts.push(`${option.fee_value} bps`);
      } else if (['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(option.fee_unit)) {
        parts.push(`$${option.fee_value}`);
      } else {
        parts.push(`${option.fee_value} ${option.fee_unit}`);
      }
    }
    if (option.frequency && option.frequency !== 'one_time') {
      parts.push(`/${option.frequency}`);
    }
    return parts.join(' ') || 'Custom pricing';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F5F5F5] flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#00E5FF]" />
          Pricing Options
        </h3>
        {isEditing && (
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30 h-7"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Option
          </Button>
        )}
      </div>

      {/* Existing Options */}
      {pricingOptions.length > 0 ? (
        <div className="space-y-2">
          {pricingOptions.map(option => (
            <div key={option.id} className="neumorphic-pressed rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{option.name}</span>
                  {option.is_default && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[#A0AEC0] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#00E5FF]">{formatPricing(option)}</span>
                    <span>•</span>
                    <span>{option.calculation_method.replace('_', ' ')}</span>
                  </div>
                  {(option.minimum_fee || option.maximum_fee) && (
                    <div className="flex gap-2">
                      {option.minimum_fee && <span>Min: ${option.minimum_fee}</span>}
                      {option.maximum_fee && <span>Max: ${option.maximum_fee}</span>}
                    </div>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(option)}
                    className="p-1.5 rounded hover:bg-[#2C2E33] text-[#A0AEC0] hover:text-[#00E5FF]"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(option.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-[#A0AEC0] hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="neumorphic-pressed rounded-lg p-4 text-center text-sm text-[#4A5568]">
          No pricing options defined yet
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && isEditing && (
        <div className="neumorphic-raised rounded-lg p-4 space-y-3 border-2 border-[#00E5FF]/30">
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Pricing option name (e.g., Monthly Subscription)"
            className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={formData.calculation_method}
              onValueChange={(v) => setFormData({ ...formData, calculation_method: v })}
            >
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                <SelectItem value="fixed_fee">Fixed Fee</SelectItem>
                <SelectItem value="percentage_of_value">Percentage</SelectItem>
                <SelectItem value="per_unit">Per Unit</SelectItem>
                <SelectItem value="per_transaction">Per Transaction</SelectItem>
                <SelectItem value="bps_of_value">Basis Points</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={formData.frequency}
              onValueChange={(v) => setFormData({ ...formData, frequency: v })}
            >
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                <SelectItem value="one_time">One Time</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
                <SelectItem value="per_transaction">Per Transaction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={formData.fee_value}
              onChange={(e) => setFormData({ ...formData, fee_value: e.target.value })}
              placeholder="Fee amount"
              className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8"
            />
            <Select
              value={formData.fee_unit}
              onValueChange={(v) => setFormData({ ...formData, fee_unit: v })}
            >
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="BPS">BPS</SelectItem>
                <SelectItem value="trade">Per Trade</SelectItem>
                <SelectItem value="user">Per User</SelectItem>
                <SelectItem value="unit">Per Unit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={formData.minimum_fee}
              onChange={(e) => setFormData({ ...formData, minimum_fee: e.target.value })}
              placeholder="Min fee (optional)"
              className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8"
            />
            <Input
              type="number"
              value={formData.maximum_fee}
              onChange={(e) => setFormData({ ...formData, maximum_fee: e.target.value })}
              placeholder="Max fee (optional)"
              className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-8"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#A0AEC0] cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded"
            />
            Set as default pricing option
          </label>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={resetForm}
              className="flex-1 border-[#2C2E33] text-[#F5F5F5] h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] h-7 text-xs"
            >
              {editingOption ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}