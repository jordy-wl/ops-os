import React, { useState } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LocalPricingOptionsEditor({ localPricingOptions, setLocalPricingOptions }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    calculation_method: 'fixed_fee',
    fee_value: '',
    fee_unit: 'USD',
    minimum_fee: '',
    maximum_fee: '',
    frequency: 'one_time',
    tiered_structure: [],
    conditions: {},
    is_default: false,
    is_active: true
  });

  const handleAdd = () => {
    setEditingIndex(null);
    setFormData({
      name: '',
      calculation_method: 'fixed_fee',
      fee_value: '',
      fee_unit: 'USD',
      minimum_fee: '',
      maximum_fee: '',
      frequency: 'one_time',
      tiered_structure: [],
      conditions: {},
      is_default: false,
      is_active: true
    });
    setIsFormOpen(true);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setFormData({ ...localPricingOptions[index] });
    setIsFormOpen(true);
  };

  const handleDelete = (index) => {
    setLocalPricingOptions(localPricingOptions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const cleanedData = {
      ...formData,
      fee_value: formData.fee_value ? parseFloat(formData.fee_value) : null,
      minimum_fee: formData.minimum_fee ? parseFloat(formData.minimum_fee) : null,
      maximum_fee: formData.maximum_fee ? parseFloat(formData.maximum_fee) : null
    };

    if (editingIndex !== null) {
      const updated = [...localPricingOptions];
      updated[editingIndex] = cleanedData;
      setLocalPricingOptions(updated);
    } else {
      setLocalPricingOptions([...localPricingOptions, cleanedData]);
    }

    setIsFormOpen(false);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingIndex(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#F5F5F5]">Pricing Options (Optional)</h3>
        <Button
          type="button"
          onClick={handleAdd}
          size="sm"
          className="bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Pricing Option
        </Button>
      </div>

      {/* List of existing local pricing options */}
      {localPricingOptions.length > 0 && (
        <div className="space-y-2 mb-4">
          {localPricingOptions.map((option, index) => (
            <div key={index} className="flex items-center justify-between bg-[#1A1B1E] rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{option.name}</h4>
                <p className="text-xs text-[#A0AEC0] mt-1">
                  {option.calculation_method.replace('_', ' ')} • {option.frequency.replace('_', ' ')}
                  {option.fee_value && ` • ${option.fee_value} ${option.fee_unit}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(index)}
                  className="p-2 rounded-lg hover:bg-[#2C2E33] transition-colors"
                >
                  <Edit className="w-4 h-4 text-[#A0AEC0]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="p-2 rounded-lg hover:bg-[#2C2E33] transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form for adding/editing pricing option */}
      {isFormOpen && (
        <div className="bg-[#1A1B1E] rounded-xl p-4 space-y-4 border border-[#2C2E33]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-[#F5F5F5]">
              {editingIndex !== null ? 'Edit Pricing Option' : 'New Pricing Option'}
            </h4>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded-lg hover:bg-[#2C2E33] transition-colors"
            >
              <X className="w-4 h-4 text-[#A0AEC0]" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Monthly Subscription"
              className="bg-[#121212] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Calculation Method</label>
              <Select
                value={formData.calculation_method}
                onValueChange={(v) => setFormData({ ...formData, calculation_method: v })}
              >
                <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="fixed_fee">Fixed Fee</SelectItem>
                  <SelectItem value="percentage_of_value">Percentage of Value</SelectItem>
                  <SelectItem value="per_unit">Per Unit</SelectItem>
                  <SelectItem value="per_transaction">Per Transaction</SelectItem>
                  <SelectItem value="per_share">Per Share</SelectItem>
                  <SelectItem value="bps_of_value">Basis Points (BPS)</SelectItem>
                  <SelectItem value="tiered">Tiered</SelectItem>
                  <SelectItem value="volume_based">Volume Based</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Frequency</label>
              <Select
                value={formData.frequency}
                onValueChange={(v) => setFormData({ ...formData, frequency: v })}
              >
                <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="per_event">Per Event</SelectItem>
                  <SelectItem value="per_transaction">Per Transaction</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Fee Value</label>
              <Input
                type="number"
                step="0.01"
                value={formData.fee_value}
                onChange={(e) => setFormData({ ...formData, fee_value: e.target.value })}
                placeholder="0.00"
                className="bg-[#121212] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Fee Unit</label>
              <Select
                value={formData.fee_unit}
                onValueChange={(v) => setFormData({ ...formData, fee_unit: v })}
              >
                <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="BPS">BPS</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="share">Share</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Minimum Fee</label>
              <Input
                type="number"
                step="0.01"
                value={formData.minimum_fee}
                onChange={(e) => setFormData({ ...formData, minimum_fee: e.target.value })}
                placeholder="Optional"
                className="bg-[#121212] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0AEC0] mb-2">Maximum Fee</label>
              <Input
                type="number"
                step="0.01"
                value={formData.maximum_fee}
                onChange={(e) => setFormData({ ...formData, maximum_fee: e.target.value })}
                placeholder="Optional"
                className="bg-[#121212] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!formData.name}
              size="sm"
              className="flex-1 bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30"
            >
              {editingIndex !== null ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {localPricingOptions.length === 0 && !isFormOpen && (
        <p className="text-xs text-[#4A5568] text-center py-4">
          No pricing options added yet. Click "Add Pricing Option" to create one.
        </p>
      )}
    </div>
  );
}