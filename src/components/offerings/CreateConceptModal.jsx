import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function CreateConceptModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    type: 'methodology',
    description: '',
    key_principles: [],
    use_cases: [],
    associated_workflows: [],
    version: '1.0'
  });
  const [newPrinciple, setNewPrinciple] = useState('');
  const [newUseCase, setNewUseCase] = useState('');

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list(),
    enabled: isOpen
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BusinessConcept.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-concepts'] });
      onClose();
      setFormData({
        name: '',
        type: 'methodology',
        description: '',
        key_principles: [],
        use_cases: [],
        associated_workflows: [],
        version: '1.0'
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
    createMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-2xl relative z-10 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">New Business Concept</h2>
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
              placeholder="Concept name"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Type</label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="methodology">Methodology</SelectItem>
                  <SelectItem value="framework">Framework</SelectItem>
                  <SelectItem value="internal_process">Internal Process</SelectItem>
                  <SelectItem value="value_proposition">Value Proposition</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Version</label>
              <Input
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="1.0"
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this concept, methodology, or framework..."
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Key Principles</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newPrinciple}
                onChange={(e) => setNewPrinciple(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('key_principles', newPrinciple, setNewPrinciple)}
                placeholder="Add a key principle..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={() => addItem('key_principles', newPrinciple, setNewPrinciple)} size="sm" className="bg-[#BD00FF]/20 text-[#BD00FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.key_principles.map((principle, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{principle}</span>
                  <button onClick={() => removeItem('key_principles', idx)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Use Cases</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newUseCase}
                onChange={(e) => setNewUseCase(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('use_cases', newUseCase, setNewUseCase)}
                placeholder="Add a use case..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
              <Button onClick={() => addItem('use_cases', newUseCase, setNewUseCase)} size="sm" className="bg-[#BD00FF]/20 text-[#BD00FF]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.use_cases.map((useCase, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-[#1A1B1E] px-3 py-2 rounded-lg">
                  <span className="flex-1">{useCase}</span>
                  <button onClick={() => removeItem('use_cases', idx)} className="text-red-400 hover:text-red-300">
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
            className="flex-1 bg-gradient-to-r from-[#BD00FF] to-[#8B00CC] text-white hover:shadow-lg hover:shadow-[#BD00FF]/30"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Concept'}
          </Button>
        </div>
      </div>
    </div>
  );
}