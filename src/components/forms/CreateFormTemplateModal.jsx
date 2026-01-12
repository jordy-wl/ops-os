import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateFormTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    name: '',
    description: '',
    form_schema: [],
    client_data_map: {},
    thank_you_message: 'Thank you for your submission!',
    is_active: true
  });

  const createMutation = useMutation({
    mutationFn: (data) => template 
      ? base44.entities.FormTemplate.update(template.id, data)
      : base44.entities.FormTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] });
      toast.success(template ? 'Form template updated' : 'Form template created');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const addField = () => {
    setFormData({
      ...formData,
      form_schema: [
        ...(formData.form_schema || []),
        { 
          field_key: '', 
          field_label: '', 
          field_type: 'text', 
          is_required: false,
          placeholder: ''
        }
      ]
    });
  };

  const updateField = (index, updates) => {
    const updated = [...(formData.form_schema || [])];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, form_schema: updated });
  };

  const removeField = (index) => {
    const updated = [...(formData.form_schema || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, form_schema: updated });
  };

  const updateDataMap = (fieldKey, clientPath) => {
    setFormData({
      ...formData,
      client_data_map: {
        ...(formData.client_data_map || {}),
        [fieldKey]: clientPath
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-4xl relative z-10 shadow-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{template ? 'Edit' : 'Create'} Form Template</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Form Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Client Onboarding Information"
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this form..."
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>

          {/* Form Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#A0AEC0]">Form Fields</label>
              <Button size="sm" variant="outline" onClick={addField} className="border-[#2C2E33]">
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
            </div>
            <div className="space-y-3">
              {(formData.form_schema || []).map((field, idx) => (
                <div key={idx} className="neumorphic-pressed p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-[#4A5568]" />
                    <Input
                      value={field.field_key}
                      onChange={(e) => updateField(idx, { field_key: e.target.value })}
                      placeholder="Field key (e.g., company_name)"
                      className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                    <Input
                      value={field.field_label}
                      onChange={(e) => updateField(idx, { field_label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                    <button onClick={() => removeField(idx)} className="p-2 hover:bg-[#3a3d44] rounded">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <Select 
                      value={field.field_type} 
                      onValueChange={(v) => updateField(idx, { field_type: v })}
                    >
                      <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                      placeholder="Placeholder text"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />

                    <label className="flex items-center gap-2 text-sm text-[#A0AEC0] bg-[#1A1B1E] px-3 rounded-lg border border-[#2C2E33]">
                      <input
                        type="checkbox"
                        checked={field.is_required || false}
                        onChange={(e) => updateField(idx, { is_required: e.target.checked })}
                        className="rounded"
                      />
                      Required
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-[#4A5568] mb-1 block">
                      Map to Client Field (e.g., email, metadata.company_size)
                    </label>
                    <Input
                      value={formData.client_data_map?.[field.field_key] || ''}
                      onChange={(e) => updateDataMap(field.field_key, e.target.value)}
                      placeholder="e.g., metadata.company_size"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Thank You Message</label>
            <Textarea
              value={formData.thank_you_message}
              onChange={(e) => setFormData({ ...formData, thank_you_message: e.target.value })}
              placeholder="Message shown after form submission"
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#2C2E33]">
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate(formData)}
            disabled={!formData.name || createMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
          >
            {createMutation.isPending ? 'Saving...' : template ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}