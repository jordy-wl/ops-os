import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Sparkles, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';

// Entity field suggestions
const ENTITY_FIELDS = {
  Client: [
    { path: 'name', label: 'Client Name', type: 'text' },
    { path: 'email', label: 'Email', type: 'email' },
    { path: 'industry', label: 'Industry', type: 'text' },
    { path: 'region', label: 'Region', type: 'text' },
    { path: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'text' },
    { path: 'value', label: 'Value', type: 'currency' },
    { path: 'website', label: 'Website', type: 'text' },
    { path: 'metadata.*', label: 'Custom Field (specify path)', type: 'text' }
  ],
  WorkflowInstance: [
    { path: 'name', label: 'Workflow Name', type: 'text' },
    { path: 'status', label: 'Status', type: 'text' },
    { path: 'progress_percentage', label: 'Progress %', type: 'number' },
    { path: 'current_stage_name', label: 'Current Stage', type: 'text' },
    { path: 'started_at', label: 'Started Date', type: 'date' }
  ],
  Contact: [
    { path: 'first_name', label: 'First Name', type: 'text' },
    { path: 'last_name', label: 'Last Name', type: 'text' },
    { path: 'email', label: 'Email', type: 'email' },
    { path: 'phone', label: 'Phone', type: 'text' },
    { path: 'job_title', label: 'Job Title', type: 'text' }
  ],
  TaskInstance: [
    { path: 'name', label: 'Task Name', type: 'text' },
    { path: 'status', label: 'Status', type: 'text' },
    { path: 'completed_at', label: 'Completed Date', type: 'date' }
  ]
};

export default function CreateTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    name: '',
    description: '',
    category: 'other',
    content_template: '',
    document_outline: '',
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

  const insertPlaceholder = (key) => {
    setFormData({
      ...formData,
      content_template: (formData.content_template || '') + `<span style="background-color: #00E5FF20; padding: 2px 6px; border-radius: 4px; font-family: monospace;">{{${key}}}</span>`
    });
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

  // Generate preview with lorem ipsum for AI sections
  const documentPreview = useMemo(() => {
    let preview = formData.content_template || '';
    
    // Add lorem ipsum hints where AI will elaborate
    if (formData.ai_prompt_instructions && preview) {
      const loremHint = '<div style="background: linear-gradient(to right, #BD00FF20, transparent); border-left: 3px solid #BD00FF; padding: 12px; margin: 16px 0; font-style: italic; color: #A0AEC0;">✨ AI will elaborate here based on your prompt and context...</div>';
      preview = preview + loremHint;
    }
    
    return preview;
  }, [formData.content_template, formData.ai_prompt_instructions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-6xl relative z-10 shadow-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto scrollbar-dark">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00E5FF]" />
            {template ? 'Edit' : 'Create'} Document Template
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#00E5FF] mb-4">Basic Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Template Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Client Onboarding Agreement"
                    className="bg-[#1A1B1E] border-[#2C2E33]"
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

                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
                  <p className="text-xs text-[#4A5568] mb-2">Brief summary for internal reference</p>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this template..."
                    className="bg-[#1A1B1E] border-[#2C2E33] h-20"
                  />
                </div>
              </div>
            </div>

            {/* Document Structure */}
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#00E5FF] mb-4">Document Structure</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Document Outline</label>
                  <p className="text-xs text-[#4A5568] mb-2">Define the high-level structure (e.g., # Introduction, ## Background)</p>
                  <Textarea
                    value={formData.document_outline}
                    onChange={(e) => setFormData({ ...formData, document_outline: e.target.value })}
                    placeholder="# Executive Summary&#10;## Background&#10;## Proposal&#10;## Next Steps"
                    className="bg-[#1A1B1E] border-[#2C2E33] h-32 font-mono text-sm"
                  />
                </div>

                {/* Placeholders */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-[#A0AEC0]">Data Placeholders</label>
                    <Button size="sm" variant="outline" onClick={addPlaceholder} className="border-[#2C2E33] h-8">
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(formData.placeholder_schema || []).map((placeholder, idx) => (
                      <div key={idx} className="flex gap-2 items-center neumorphic-pressed p-2 rounded-lg">
                        <Input
                          value={placeholder.key}
                          onChange={(e) => updatePlaceholder(idx, 'key', e.target.value)}
                          placeholder="client.name"
                          className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-xs h-8"
                        />
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => insertPlaceholder(placeholder.key)}
                          className="text-[#00E5FF] hover:bg-[#00E5FF]/10 h-8 px-2 text-xs"
                        >
                          Insert
                        </Button>
                        <button onClick={() => removePlaceholder(idx)} className="p-1 hover:bg-[#3a3d44] rounded">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Configuration */}
            <div className="neumorphic-raised rounded-xl p-4 border border-[#BD00FF]/20">
              <h3 className="text-sm font-semibold text-[#BD00FF] mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Generation Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">AI Prompt</label>
                  <p className="text-xs text-[#4A5568] mb-2">Tell the AI how to elaborate, what tone to use, what to emphasize</p>
                  <Textarea
                    value={formData.ai_prompt_instructions}
                    onChange={(e) => setFormData({ ...formData, ai_prompt_instructions: e.target.value })}
                    placeholder="Write in a professional tone. Emphasize the client's industry needs. Elaborate on how our solution addresses their specific challenges..."
                    className="bg-[#1A1B1E] border-[#2C2E33] h-24"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-sm font-medium text-[#A0AEC0]">Context Data Points</label>
                      <p className="text-xs text-[#4A5568]">Specify which data the AI should reason over</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={addRequiredData} className="border-[#2C2E33] h-8">
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(formData.required_entity_data || []).map((data, idx) => (
                      <div key={idx} className="neumorphic-pressed p-3 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          <Select 
                            value={data.entity_type} 
                            onValueChange={(v) => updateRequiredData(idx, 'entity_type', v)}
                          >
                            <SelectTrigger className="w-32 bg-[#1A1B1E] border-[#2C2E33] text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                              <SelectItem value="Client">Client</SelectItem>
                              <SelectItem value="WorkflowInstance">Workflow</SelectItem>
                              <SelectItem value="Contact">Contact</SelectItem>
                              <SelectItem value="TaskInstance">Task</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select 
                            value={data.field_path} 
                            onValueChange={(v) => updateRequiredData(idx, 'field_path', v)}
                          >
                            <SelectTrigger className="flex-1 bg-[#1A1B1E] border-[#2C2E33] text-xs h-8">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                              {ENTITY_FIELDS[data.entity_type]?.map(field => (
                                <SelectItem key={field.path} value={field.path}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button onClick={() => removeRequiredData(idx)} className="p-1 hover:bg-[#3a3d44] rounded">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                        <Input
                          value={data.description}
                          onChange={(e) => updateRequiredData(idx, 'description', e.target.value)}
                          placeholder="How should AI use this? e.g., 'Explain implications of their industry...'"
                          className="bg-[#1A1B1E] border-[#2C2E33] text-xs h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Knowledge Keywords</label>
                  <p className="text-xs text-[#4A5568] mb-2">Keywords to search your knowledge library</p>
                  <Input
                    value={(formData.rag_keywords || []).join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      rag_keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) 
                    })}
                    placeholder="onboarding, compliance, best practices"
                    className="bg-[#1A1B1E] border-[#2C2E33]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="space-y-4">
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[#00E5FF] mb-4">Live Document Preview</h3>
              <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg overflow-hidden">
                <ReactQuill
                  value={formData.content_template}
                  onChange={(value) => setFormData({ ...formData, content_template: value })}
                  theme="snow"
                  className="min-h-[500px]"
                  placeholder="Start writing your document template... Use the placeholders from the left panel."
                />
              </div>
            </div>

            {formData.ai_prompt_instructions && (
              <div className="neumorphic-pressed rounded-xl p-4 border-l-4 border-[#BD00FF]">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#BD00FF] mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#BD00FF] mb-1">AI will generate content here</p>
                    <p className="text-xs text-[#A0AEC0] italic">
                      Based on your prompt, context data, and knowledge base...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#2C2E33] text-[#F5F5F5]">
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate(formData)}
            disabled={!formData.name || createMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
          >
            {createMutation.isPending ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}