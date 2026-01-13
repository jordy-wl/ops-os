import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';

export default function CreateTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    name: '',
    description: '',
    category: 'other',
    content_template: '',
    placeholder_schema: [],
    ai_prompt_instructions: '',
    required_entity_data: [],
    rag_keywords: [],
    output_format: 'markdown'
  });

  const createMutation = useMutation({
    mutationFn: (data) => template 
      ? base44.entities.DocumentTemplate.update(template.id, data)
      : base44.entities.DocumentTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success(template ? 'Template updated' : 'Template created');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const addPlaceholder = () => {
    setFormData({
      ...formData,
      placeholder_schema: [
        ...(formData.placeholder_schema || []),
        { key: '', label: '', type: 'text', example: '' }
      ]
    });
  };

  const updatePlaceholder = (index, field, value) => {
    const updated = [...(formData.placeholder_schema || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, placeholder_schema: updated });
  };

  const removePlaceholder = (index) => {
    const updated = [...(formData.placeholder_schema || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, placeholder_schema: updated });
  };

  const addRequiredData = () => {
    setFormData({
      ...formData,
      required_entity_data: [
        ...(formData.required_entity_data || []),
        { entity_type: 'Client', field_path: '', description: '', is_required: false }
      ]
    });
  };

  const updateRequiredData = (index, field, value) => {
    const updated = [...(formData.required_entity_data || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, required_entity_data: updated });
  };

  const removeRequiredData = (index) => {
    const updated = [...(formData.required_entity_data || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, required_entity_data: updated });
  };

  const insertPlaceholder = (key) => {
    setFormData({
      ...formData,
      content_template: (formData.content_template || '') + `{{${key}}}`
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-4xl relative z-10 shadow-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{template ? 'Edit' : 'Create'} Document Template</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Client Onboarding Agreement"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="welcome_pack">Welcome Pack</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this template..."
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>

          {/* Placeholders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#A0AEC0]">Placeholders</label>
              <Button size="sm" variant="outline" onClick={addPlaceholder} className="border-[#2C2E33]">
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
            </div>
            <div className="space-y-2 mb-4">
              {(formData.placeholder_schema || []).map((placeholder, idx) => (
                <div key={idx} className="flex gap-2 items-start neumorphic-pressed p-3 rounded-lg">
                  <Input
                    value={placeholder.key}
                    onChange={(e) => updatePlaceholder(idx, 'key', e.target.value)}
                    placeholder="e.g., client.name or client.metadata.company_size"
                    className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                  />
                  <Input
                    value={placeholder.label}
                    onChange={(e) => updatePlaceholder(idx, 'label', e.target.value)}
                    placeholder="Label"
                    className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                  />
                  <Select 
                    value={placeholder.type} 
                    onValueChange={(v) => updatePlaceholder(idx, 'type', v)}
                  >
                    <SelectTrigger className="w-32 bg-[#1A1B1E] border-[#2C2E33] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => insertPlaceholder(placeholder.key)}
                    className="text-[#00E5FF] hover:bg-[#00E5FF]/10"
                  >
                    Insert
                  </Button>
                  <button onClick={() => removePlaceholder(idx)} className="p-2 hover:bg-[#3a3d44] rounded">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Content Template */}
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Template Content</label>
            <p className="text-xs text-[#4A5568] mb-2">
              Use placeholders like {`{{client.name}}`} or {`{{client.metadata.field_name}}`}
            </p>
            <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg overflow-hidden">
              <ReactQuill
                value={formData.content_template}
                onChange={(value) => setFormData({ ...formData, content_template: value })}
                theme="snow"
                className="h-64"
              />
            </div>
          </div>

          {/* AI Configuration */}
          <div className="border-t border-[#2C2E33] pt-6">
            <h3 className="text-sm font-semibold text-[#BD00FF] mb-4">AI Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">AI Instructions</label>
                <Textarea
                  value={formData.ai_prompt_instructions}
                  onChange={(e) => setFormData({ ...formData, ai_prompt_instructions: e.target.value })}
                  placeholder="Tell the AI how to elaborate, what tone to use, what to emphasize..."
                  className="bg-[#1A1B1E] border-[#2C2E33] h-24"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[#A0AEC0]">Required Entity Data</label>
                  <Button size="sm" variant="outline" onClick={addRequiredData} className="border-[#2C2E33]">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Data Point
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.required_entity_data || []).map((data, idx) => (
                    <div key={idx} className="flex gap-2 items-start neumorphic-pressed p-3 rounded-lg">
                      <Select 
                        value={data.entity_type} 
                        onValueChange={(v) => updateRequiredData(idx, 'entity_type', v)}
                      >
                        <SelectTrigger className="w-40 bg-[#1A1B1E] border-[#2C2E33] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                          <SelectItem value="Client">Client</SelectItem>
                          <SelectItem value="WorkflowInstance">Workflow</SelectItem>
                          <SelectItem value="Contact">Contact</SelectItem>
                          <SelectItem value="TaskInstance">Task</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={data.field_path}
                        onChange={(e) => updateRequiredData(idx, 'field_path', e.target.value)}
                        placeholder="Field path (e.g., name, metadata.company_size)"
                        className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                      />
                      <Input
                        value={data.description}
                        onChange={(e) => updateRequiredData(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-sm"
                      />
                      <button onClick={() => removeRequiredData(idx)} className="p-2 hover:bg-[#3a3d44] rounded">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">RAG Keywords</label>
                <p className="text-xs text-[#4A5568] mb-2">
                  Keywords to search your knowledge library for relevant context
                </p>
                <Input
                  value={(formData.rag_keywords || []).join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    rag_keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) 
                  })}
                  placeholder="e.g., onboarding, compliance, best practices"
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Output Format</label>
            <Select value={formData.output_format} onValueChange={(v) => setFormData({ ...formData, output_format: v })}>
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#2C2E33]">
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate(formData)}
            disabled={!formData.name || createMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
          >
            {createMutation.isPending ? 'Saving...' : template ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}