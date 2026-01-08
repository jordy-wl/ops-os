import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function GenerateDocumentModal({ 
  isOpen, 
  onClose, 
  clientId,
  workflowInstanceId = null,
  deliverableInstanceId = null 
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => base44.entities.DocumentTemplate.filter({ is_active: true }),
    enabled: isOpen,
  });

  const generateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('aiDrafterDocument', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Document generated successfully by The Drafter');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
      setSelectedTemplateId('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate document');
    },
  });

  const handleGenerate = () => {
    if (!selectedTemplateId) {
      toast.error('Please select a document template');
      return;
    }

    generateMutation.mutate({
      document_template_id: selectedTemplateId,
      client_id: clientId,
      workflow_instance_id: workflowInstanceId,
      deliverable_instance_id: deliverableInstanceId,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#BD00FF] to-[#9000cc] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Generate Document</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Document Template *
            </label>
            {templatesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-[#A0AEC0]" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-[#4A5568] py-4 text-center">
                No document templates available
              </div>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#BD00FF]" />
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-[#A0AEC0]">{template.category}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-[#4A5568] mt-2">
              The Drafter will automatically fill the template with client data and generate professional content.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || generateMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white hover:shadow-lg hover:shadow-[#BD00FF]/30"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}