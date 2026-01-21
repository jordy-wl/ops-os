import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Trash2, Edit, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SectionEditor from '../components/documents/SectionEditor';

export default function DocumentTemplates() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: 'other',
    sections: [],
    glossary_term_ids: [],
    brand_kit_id: '',
    output_format: 'pdf'
  });

  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => base44.entities.DocumentTemplate.list()
  });

  const { data: brandKits = [] } = useQuery({
    queryKey: ['brand-kits'],
    queryFn: () => base44.entities.BrandKit.list()
  });

  const { data: glossaryTerms = [] } = useQuery({
    queryKey: ['glossary-terms'],
    queryFn: () => base44.entities.GlossaryTerm.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DocumentTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DocumentTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DocumentTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      category: 'other',
      sections: [],
      glossary_term_ids: [],
      brand_kit_id: '',
      output_format: 'pdf'
    });
    setEditingTemplate(null);
    setIsModalOpen(false);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      code: template.code || '',
      description: template.description || '',
      category: template.category || 'other',
      sections: template.sections || [],
      glossary_term_ids: template.glossary_term_ids || [],
      brand_kit_id: template.brand_kit_id || '',
      output_format: template.output_format || 'pdf'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: '',
      type: 'text',
      order: formData.sections.length,
      ai_prompt: '',
      data_references: []
    };
    setFormData({
      ...formData,
      sections: [...formData.sections, newSection]
    });
  };

  const updateSection = (index, updatedSection) => {
    const updated = [...formData.sections];
    updated[index] = updatedSection;
    setFormData({ ...formData, sections: updated });
  };

  const deleteSection = (index) => {
    const updated = formData.sections.filter((_, i) => i !== index);
    setFormData({ ...formData, sections: updated });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(formData.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reordered = items.map((item, index) => ({
      ...item,
      order: index
    }));

    setFormData({ ...formData, sections: reordered });
  };

  const toggleGlossaryTerm = (termId) => {
    const current = formData.glossary_term_ids || [];
    const updated = current.includes(termId)
      ? current.filter(id => id !== termId)
      : [...current, termId];
    setFormData({ ...formData, glossary_term_ids: updated });
  };

  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#F5F5F5]">Document Templates</h1>
          <p className="text-sm text-[#A0AEC0] mt-1">Create structured, AI-powered document templates with sections and branding</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="pl-10 bg-[#1A1B1E] border-[#2C2E33]"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="bg-[#1A1B1E] border-[#2C2E33] hover:border-[#00E5FF] transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#00E5FF]" />
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(template)}
                    className="h-7 w-7 text-[#A0AEC0] hover:text-[#00E5FF]"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(template.id)}
                    className="h-7 w-7 text-[#A0AEC0] hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#A0AEC0] mb-3">{template.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#4A5568]">{template.sections?.length || 0} sections</span>
                <span className="px-2 py-1 rounded bg-[#00E5FF]/10 text-[#00E5FF]">{template.category}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[#1A1B1E] border-[#2C2E33]">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F5]">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Template Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Client Proposal Template"
                  className="bg-[#121212] border-[#2C2E33]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Template Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., PROP-001"
                  className="bg-[#121212] border-[#2C2E33]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this template..."
                className="bg-[#121212] border-[#2C2E33]"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Brand Kit</label>
                <Select value={formData.brand_kit_id} onValueChange={(v) => setFormData({ ...formData, brand_kit_id: v })}>
                  <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                    <SelectValue placeholder="Select brand kit" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandKits.map(kit => (
                      <SelectItem key={kit.id} value={kit.id}>{kit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Output Format</label>
                <Select value={formData.output_format} onValueChange={(v) => setFormData({ ...formData, output_format: v })}>
                  <SelectTrigger className="bg-[#121212] border-[#2C2E33]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sections */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-[#A0AEC0]">Document Sections</label>
                <Button
                  onClick={addSection}
                  size="sm"
                  variant="outline"
                  className="bg-[#121212] border-[#2C2E33] text-[#00E5FF] hover:bg-[#2C2E33]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </div>

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
                              {...provided.dragHandleProps}
                            >
                              <SectionEditor
                                section={section}
                                onUpdate={(updated) => updateSection(index, updated)}
                                onDelete={() => deleteSection(index)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {formData.sections.length === 0 && (
                <div className="text-center py-8 text-[#4A5568] text-sm">
                  No sections yet. Click "Add Section" to start building your document structure.
                </div>
              )}
            </div>

            {/* Glossary Terms */}
            {glossaryTerms.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Include Glossary Terms</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-[#121212] rounded-lg border border-[#2C2E33]">
                  {glossaryTerms.map(term => (
                    <label key={term.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-[#00E5FF]">
                      <input
                        type="checkbox"
                        checked={formData.glossary_term_ids?.includes(term.id)}
                        onChange={() => toggleGlossaryTerm(term.id)}
                        className="rounded"
                      />
                      <span>{term.term}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#2C2E33]">
              <Button
                variant="outline"
                onClick={resetForm}
                className="bg-[#121212] border-[#2C2E33]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}