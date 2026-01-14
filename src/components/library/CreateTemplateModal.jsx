import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Sparkles, FileText, Database } from 'lucide-react';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';

// List of available entities in the system
const AVAILABLE_ENTITIES = [
  'Client', 'Contact', 'WorkflowInstance', 'StageInstance', 'DeliverableInstance', 
  'TaskInstance', 'Team', 'Department', 'Product', 'Service', 'BusinessConcept'
];

export default function CreateTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    name: '',
    description: '',
    category: 'other',
    document_outline: '',
    ai_prompt_instructions: '',
    required_entity_data: [],
    output_format: 'markdown'
  });
  const [entitySchemas, setEntitySchemas] = useState({});

  // Fetch schema for an entity when needed
  const fetchEntitySchema = async (entityName) => {
    if (entitySchemas[entityName]) return;
    try {
      const schema = await base44.entities[entityName].schema();
      setEntitySchemas(prev => ({ ...prev, [entityName]: schema }));
    } catch (error) {
      console.error(`Failed to fetch schema for ${entityName}:`, error);
    }
  };

  // Get fields from schema
  const getFieldsForEntity = (entityName) => {
    const schema = entitySchemas[entityName];
    if (!schema?.properties) return [];
    
    return Object.entries(schema.properties).map(([key, value]) => ({
      path: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: value.type || 'text'
    }));
  };

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
    
    // If entity_type changed, fetch its schema and reset field_path
    if (field === 'entity_type') {
      updated[index].field_path = '';
      fetchEntitySchema(value);
    }
    
    setFormData({ ...formData, required_entity_data: updated });
  };

  const removeRequiredData = (index) => {
    const updated = [...(formData.required_entity_data || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, required_entity_data: updated });
  };



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

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Template Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Client Onboarding Proposal"
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
              placeholder="Brief description of this document template..."
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>

          {/* Document Structure */}
          <div className="neumorphic-raised rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#00E5FF] mb-4">Document Structure</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Document Outline</label>
                <p className="text-xs text-[#4A5568] mb-2">Define section headings and structure (optional)</p>
                <Textarea
                  value={formData.document_outline}
                  onChange={(e) => setFormData({ ...formData, document_outline: e.target.value })}
                  placeholder="# Executive Summary&#10;## Background&#10;## Our Proposal&#10;## Investment & ROI&#10;## Next Steps"
                  className="bg-[#1A1B1E] border-[#2C2E33] h-32 font-mono text-sm"
                />
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
          </div>

          {/* AI Configuration - Primary Focus */}
          <div className="neumorphic-raised rounded-xl p-6 border-2 border-[#BD00FF]/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#BD00FF]/20 to-[#BD00FF]/10">
                <Sparkles className="w-5 h-5 text-[#BD00FF]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#BD00FF]">AI Document Generation</h3>
                <p className="text-xs text-[#A0AEC0]">Tell AI how to write and what data to use</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#F5F5F5] mb-2">
                  Generation Prompt *
                </label>
                <p className="text-xs text-[#4A5568] mb-2">
                  Describe the tone, style, what to emphasize, and how the document should be structured
                </p>
                <Textarea
                  value={formData.ai_prompt_instructions}
                  onChange={(e) => setFormData({ ...formData, ai_prompt_instructions: e.target.value })}
                  placeholder="Example: Generate a professional client proposal with a consultative tone. Start with an executive summary, then detail our solution approach. Emphasize how we address their specific industry challenges. Include ROI projections and concrete implementation timelines. Close with clear next steps."
                  className="bg-[#1A1B1E] border-[#2C2E33] min-h-[120px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-[#F5F5F5]">Data Fields</label>
                    <p className="text-xs text-[#4A5568]">Select client and workflow data the AI should use</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={addRequiredData} className="border-[#BD00FF]/30 text-[#BD00FF] hover:bg-[#BD00FF]/10 h-8">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(formData.required_entity_data || []).length === 0 && (
                    <div className="neumorphic-pressed p-4 rounded-lg text-center">
                      <Database className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
                      <p className="text-sm text-[#A0AEC0]">No data fields selected yet</p>
                      <p className="text-xs text-[#4A5568] mt-1">Add fields to provide context to the AI</p>
                    </div>
                  )}
                  {(formData.required_entity_data || []).map((data, idx) => (
                    <div key={idx} className="neumorphic-pressed p-3 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <Select 
                          value={data.entity_type} 
                          onValueChange={(v) => updateRequiredData(idx, 'entity_type', v)}
                        >
                          <SelectTrigger className="w-28 bg-[#1A1B1E] border-[#2C2E33] text-xs h-8">
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
                        <button 
                          onClick={() => removeRequiredData(idx)} 
                          className="p-1.5 hover:bg-[#3a3d44] rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                      <Input
                        value={data.description}
                        onChange={(e) => updateRequiredData(idx, 'description', e.target.value)}
                        placeholder="How should the AI use this field? e.g., 'Use to personalize industry examples'"
                        className="bg-[#1A1B1E] border-[#2C2E33] text-xs h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
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