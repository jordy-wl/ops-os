import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Sparkles, FileText, Database, GripVertical, BarChart, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import ReactQuill from 'react-quill';
import MultiSelectField from './MultiSelectField';

// Helper to convert schema type to readable label
const getFieldLabel = (fieldName, fieldSchema) => {
  if (fieldSchema.description) return fieldSchema.description;
  return fieldName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function CreateTemplateModal({ isOpen, onClose, template }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(template || {
    name: '',
    description: '',
    category: 'other',
    sections: [],
    glossary_term_ids: [],
    brand_kit_id: null,
    output_format: 'pdf'
  });

  useEffect(() => {
    if (template) {
      setFormData(template);
    }
  }, [template]);

  // Build Client fields from schema
  const clientFields = useMemo(() => {
    const clientSchema = {
      name: { description: 'Client/company name' },
      industry: { description: 'Industry' },
      region: { description: 'Region' },
      lifecycle_stage: { description: 'Lifecycle Stage' },
      value: { description: 'Aggregate client value' },
      currency: { description: 'Currency' },
      website: { description: 'Website' },
      logo_url: { description: 'Logo URL' },
      sentiment_score: { description: 'Sentiment Score' },
      risk_score: { description: 'Churn Risk Score' },
      next_best_action: { description: 'AI-suggested next action' }
    };
    return Object.entries(clientSchema).map(([path, schema]) => ({
      path,
      label: getFieldLabel(path, schema)
    }));
  }, []);

  // Fetch workflow templates and their task fields
  const { data: workflowFields = [] } = useQuery({
    queryKey: ['workflow-fields'],
    queryFn: async () => {
      const templates = await base44.entities.WorkflowTemplate.list();
      const fields = [];
      
      // Add base workflow template fields
      const baseFields = [
        { path: 'name', label: 'Workflow Name' },
        { path: 'description', label: 'Description' },
        { path: 'category', label: 'Category' }
      ];
      fields.push(...baseFields);

      // Fetch task templates to get custom data fields
      if (templates.length > 0) {
        const taskTemplates = await base44.entities.TaskTemplate.list();
        const customFields = new Set();
        
        taskTemplates.forEach(task => {
          if (task.data_field_definitions && Array.isArray(task.data_field_definitions)) {
            task.data_field_definitions.forEach(field => {
              customFields.add(JSON.stringify({
                path: `task_fields.${field.field_code}`,
                label: field.field_name
              }));
            });
          }
        });

        customFields.forEach(fieldStr => {
          fields.push(JSON.parse(fieldStr));
        });
      }

      return fields;
    },
    enabled: isOpen
  });

  const { data: brandKits = [] } = useQuery({
    queryKey: ['brand-kits'],
    queryFn: () => base44.entities.BrandKit.list('-created_date', 50),
    enabled: isOpen
  });

  const { data: glossaryTerms = [] } = useQuery({
    queryKey: ['glossary-terms'],
    queryFn: () => base44.entities.GlossaryTerm.list('term', 100),
    enabled: isOpen
  });

  const entityOptions = ['Client', 'Workflow'];

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



  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: '',
      type: 'text',
      order: formData.sections?.length || 0,
      ai_prompt: '',
      data_references: []
    };
    setFormData({
      ...formData,
      sections: [...(formData.sections || []), newSection]
    });
  };

  const updateSection = (index, field, value) => {
    const updated = [...(formData.sections || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, sections: updated });
  };

  const removeSection = (index) => {
    const updated = [...(formData.sections || [])];
    updated.splice(index, 1);
    // Reorder
    updated.forEach((s, i) => s.order = i);
    setFormData({ ...formData, sections: updated });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(formData.sections || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    // Update order
    items.forEach((s, i) => s.order = i);
    setFormData({ ...formData, sections: items });
  };

  const addDataReference = (sectionIndex) => {
    const updated = [...(formData.sections || [])];
    const section = updated[sectionIndex];
    section.data_references = [
      ...(section.data_references || []),
      { entity_type: 'Client', field_paths: [], usage_prompt: '' }
    ];
    setFormData({ ...formData, sections: updated });
  };

  const updateDataReference = (sectionIndex, refIndex, field, value) => {
    const updated = [...(formData.sections || [])];
    const refs = updated[sectionIndex].data_references;
    refs[refIndex] = { ...refs[refIndex], [field]: value };
    setFormData({ ...formData, sections: updated });
  };

  const removeDataReference = (sectionIndex, refIndex) => {
    const updated = [...(formData.sections || [])];
    updated[sectionIndex].data_references.splice(refIndex, 1);
    setFormData({ ...formData, sections: updated });
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

          {/* Brand Kit Selection */}
          <div className="neumorphic-raised rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#00E5FF] mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Branding & Output
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Brand Kit</label>
                <Select value={formData.brand_kit_id || ''} onValueChange={(v) => setFormData({ ...formData, brand_kit_id: v || null })}>
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue placeholder="Select brand kit..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                    <SelectItem value={null}>None</SelectItem>
                    {brandKits.map(kit => (
                      <SelectItem key={kit.id} value={kit.id}>{kit.name}</SelectItem>
                    ))}
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
          </div>

          {/* Document Sections */}
          <div className="neumorphic-raised rounded-xl p-6 border-2 border-[#BD00FF]/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-[#BD00FF]/20 to-[#BD00FF]/10">
                  <Sparkles className="w-5 h-5 text-[#BD00FF]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#BD00FF]">Document Sections</h3>
                  <p className="text-xs text-[#A0AEC0]">Build your document section by section with AI</p>
                </div>
              </div>
              <Button size="sm" onClick={addSection} className="bg-[#BD00FF]/20 text-[#BD00FF] hover:bg-[#BD00FF]/30 h-8">
                <Plus className="w-3 h-3 mr-1" />
                Add Section
              </Button>
            </div>

            {(!formData.sections || formData.sections.length === 0) ? (
              <div className="neumorphic-pressed p-8 rounded-lg text-center">
                <FileText className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
                <p className="text-sm text-[#A0AEC0]">No sections yet</p>
                <p className="text-xs text-[#4A5568] mt-1">Add sections to define your document structure</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="sections">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                      {formData.sections.map((section, index) => (
                        <Draggable key={section.id} draggableId={section.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="neumorphic-pressed rounded-lg p-4 space-y-3"
                            >
                              <div className="flex items-start gap-3">
                                <div {...provided.dragHandleProps} className="mt-2">
                                  <GripVertical className="w-4 h-4 text-[#4A5568] cursor-grab active:cursor-grabbing" />
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <Input
                                      value={section.title}
                                      onChange={(e) => updateSection(index, 'title', e.target.value)}
                                      placeholder="Section title..."
                                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                                    />
                                    <Select 
                                      value={section.type} 
                                      onValueChange={(v) => updateSection(index, 'type', v)}
                                    >
                                      <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="chart">Chart</SelectItem>
                                        <SelectItem value="table">Table</SelectItem>
                                        <SelectItem value="glossary">Glossary</SelectItem>
                                        <SelectItem value="appendix">Appendix</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {section.type === 'text' && (
                                    <>
                                      <Textarea
                                        value={section.ai_prompt}
                                        onChange={(e) => updateSection(index, 'ai_prompt', e.target.value)}
                                        placeholder="AI instructions for this section..."
                                        className="bg-[#1A1B1E] border-[#2C2E33] text-sm h-20"
                                      />
                                      
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="text-xs text-[#A0AEC0]">Data References</label>
                                          <button
                                            onClick={() => addDataReference(index)}
                                            className="text-xs text-[#BD00FF] hover:underline"
                                          >
                                            + Add Data
                                          </button>
                                        </div>
                                        {section.data_references?.map((ref, refIdx) => (
                                          <div key={refIdx} className="flex gap-2 mb-2">
                                            <Select 
                                              value={ref.entity_type} 
                                              onValueChange={(v) => updateDataReference(index, refIdx, 'entity_type', v)}
                                            >
                                              <SelectTrigger className="w-28 bg-[#1A1B1E] border-[#2C2E33] text-xs h-7">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                                                <SelectItem value="Client">Client</SelectItem>
                                                <SelectItem value="Workflow">Workflow</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <div className="flex-1">
                                              <MultiSelectField
                                                options={ref.entity_type === 'Client' ? clientFields : workflowFields}
                                                value={ref.field_paths || []}
                                                onChange={(v) => updateDataReference(index, refIdx, 'field_paths', v)}
                                                placeholder="Fields..."
                                              />
                                            </div>
                                            <button 
                                              onClick={() => removeDataReference(index, refIdx)}
                                              className="p-1 hover:bg-[#3a3d44] rounded"
                                            >
                                              <Trash2 className="w-3 h-3 text-red-400" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {section.type === 'chart' && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <Select 
                                        value={section.chart_type || 'bar'} 
                                        onValueChange={(v) => updateSection(index, 'chart_type', v)}
                                      >
                                        <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                                          <SelectValue placeholder="Chart type..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                                          <SelectItem value="bar">Bar Chart</SelectItem>
                                          <SelectItem value="line">Line Chart</SelectItem>
                                          <SelectItem value="pie">Pie Chart</SelectItem>
                                          <SelectItem value="area">Area Chart</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2 text-xs text-[#4A5568]">
                                        <BarChart className="w-4 h-4" />
                                        Configure data source in advanced settings
                                      </div>
                                    </div>
                                  )}

                                  {section.type === 'glossary' && (
                                    <p className="text-xs text-[#4A5568]">
                                      Automatically includes selected glossary terms below
                                    </p>
                                  )}
                                </div>
                                <button 
                                  onClick={() => removeSection(index)}
                                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Glossary Terms</label>
              <MultiSelectField
                options={glossaryTerms.map(t => ({ path: t.id, label: t.term }))}
                value={formData.glossary_term_ids || []}
                onChange={(v) => setFormData({ ...formData, glossary_term_ids: v })}
                placeholder="Select terms for glossary/appendix..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#2C2E33] text-[#F5F5F5]">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              const data = { ...formData };
              // Clean up sections data
              if (data.sections) {
                data.sections = data.sections.map(s => ({
                  ...s,
                  data_references: s.data_references || []
                }));
              }
              createMutation.mutate(data);
            }}
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