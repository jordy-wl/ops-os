import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function Glossary() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  
  const [formData, setFormData] = useState({
    term: '',
    definition: '',
    user_defined_label: '',
    system_mapping: '',
    category: 'general',
    examples: [],
    synonyms: []
  });

  const { data: glossaryTerms = [], isLoading } = useQuery({
    queryKey: ['glossary-terms'],
    queryFn: () => base44.entities.GlossaryTerm.list()
  });

  const createTermMutation = useMutation({
    mutationFn: (data) => base44.entities.GlossaryTerm.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      toast.success('Term created');
      resetForm();
    }
  });

  const updateTermMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GlossaryTerm.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      toast.success('Term updated');
      resetForm();
    }
  });

  const deleteTermMutation = useMutation({
    mutationFn: (id) => base44.entities.GlossaryTerm.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary-terms'] });
      toast.success('Term deleted');
    }
  });

  const resetForm = () => {
    setFormData({
      term: '',
      definition: '',
      user_defined_label: '',
      system_mapping: '',
      category: 'general',
      examples: [],
      synonyms: []
    });
    setEditingTerm(null);
    setIsCreateModalOpen(false);
  };

  const handleSubmit = () => {
    if (editingTerm) {
      updateTermMutation.mutate({ id: editingTerm.id, data: formData });
    } else {
      createTermMutation.mutate({
        ...formData,
        usage_count: 0,
        is_active: true
      });
    }
  };

  const handleEdit = (term) => {
    setEditingTerm(term);
    setFormData({
      term: term.term,
      definition: term.definition,
      user_defined_label: term.user_defined_label,
      system_mapping: term.system_mapping,
      category: term.category,
      examples: term.examples || [],
      synonyms: term.synonyms || []
    });
    setIsCreateModalOpen(true);
  };

  const filteredTerms = glossaryTerms.filter(term => {
    const matchesSearch = term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         term.user_defined_label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryColors = {
    pricing: 'bg-green-500/20 text-green-400 border-green-500/30',
    offering: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    workflow: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    client: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    general: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-[#00E5FF]" />
            Business Glossary
          </h1>
          <p className="text-sm text-[#A0AEC0] mt-1">
            Define custom terminology for your business
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Term
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search terms..."
            className="pl-10 bg-[#1A1B1E] border-[#2C2E33]"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48 bg-[#1A1B1E] border-[#2C2E33]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="pricing">Pricing</SelectItem>
            <SelectItem value="offering">Offering</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Terms Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-[#A0AEC0]">Loading terms...</div>
      ) : filteredTerms.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-[#4A5568] mx-auto mb-4" />
          <p className="text-[#A0AEC0]">No terms found</p>
          <p className="text-sm text-[#4A5568] mt-1">Create custom terminology for your business</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTerms.map((term) => (
            <div key={term.id} className="neumorphic-raised rounded-xl p-4 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{term.term}</h3>
                  <p className="text-sm text-[#00E5FF]">{term.user_defined_label}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(term)}
                    className="p-2 hover:bg-[#2C2E33] rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-[#A0AEC0]" />
                  </button>
                  <button
                    onClick={() => deleteTermMutation.mutate(term.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-[#E0E0E0] mb-3">{term.definition}</p>

              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${categoryColors[term.category]} border`}>
                  {term.category}
                </Badge>
                <span className="text-xs text-[#4A5568]">
                  Maps to: {term.system_mapping}
                </span>
              </div>

              {term.synonyms?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-3 h-3 text-[#A0AEC0]" />
                  {term.synonyms.slice(0, 3).map((syn, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-[#1A1B1E] rounded">
                      {syn}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-[#2C2E33] border-[#3a3d44] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F5]">
              {editingTerm ? 'Edit Term' : 'Add New Term'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Term</label>
              <Input
                value={formData.term}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                placeholder="e.g., Unit, Transaction, Event"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">User-Defined Label</label>
              <Input
                value={formData.user_defined_label}
                onChange={(e) => setFormData({ ...formData, user_defined_label: e.target.value })}
                placeholder="e.g., Consulting Hour, Share Transfer"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Definition</label>
              <Textarea
                value={formData.definition}
                onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                placeholder="Clear definition of what this term means in your business"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#A0AEC0] mb-2 block">System Mapping</label>
                <Input
                  value={formData.system_mapping}
                  onChange={(e) => setFormData({ ...formData, system_mapping: e.target.value })}
                  placeholder="e.g., PricingRule.fee_unit"
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>

              <div>
                <label className="text-sm text-[#A0AEC0] mb-2 block">Category</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pricing">Pricing</SelectItem>
                    <SelectItem value="offering">Offering</SelectItem>
                    <SelectItem value="workflow">Workflow</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">
                Examples (comma-separated)
              </label>
              <Input
                value={formData.examples?.join(', ') || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  examples: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., 50 consulting hours, 100 transactions"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">
                Synonyms (comma-separated)
              </label>
              <Input
                value={formData.synonyms?.join(', ') || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  synonyms: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g., hour, time unit, billing hour"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={resetForm}
                className="flex-1 bg-[#1A1B1E] border-[#2C2E33] hover:bg-[#2C2E33]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.term || !formData.definition || !formData.user_defined_label || !formData.system_mapping}
                className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                {editingTerm ? 'Update' : 'Create'} Term
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}