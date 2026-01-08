import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Wand2, Loader2, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AIWorkflowGenerator({ onBack }) {
  const [formData, setFormData] = useState({
    description: '',
    type: 'linear',
    category: 'custom'
  });
  const [generatedStructure, setGeneratedStructure] = useState(null);
  const [expandedStages, setExpandedStages] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const generateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('aiArchitectWorkflow', data);
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedStructure(data.structure);
      setIsGenerating(false);
    },
    onError: () => {
      setIsGenerating(false);
    }
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate({
      workflow_description: formData.description,
      workflow_type: formData.type,
      category: formData.category
    });
  };

  const publishMutation = useMutation({
    mutationFn: async (versionId) => {
      await base44.entities.WorkflowTemplateVersion.update(versionId, {
        status: 'published',
        published_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      navigate(createPageUrl('Workflows'));
    }
  });

  const handlePublish = async () => {
    if (generateMutation.data?.version?.id) {
      publishMutation.mutate(generateMutation.data.version.id);
    } else {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      navigate(createPageUrl('Workflows'));
    }
  };

  const toggleStage = (index) => {
    setExpandedStages({ ...expandedStages, [index]: !expandedStages[index] });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">AI Workflow Generator</h1>
        <p className="text-[#A0AEC0]">Describe your workflow and the Architect will build it for you</p>
      </div>

      {!generatedStructure ? (
        /* Input Form */
        <div className="neumorphic-raised rounded-2xl p-8 max-w-3xl mx-auto">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Workflow Type
              </label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="linear">Linear (One-time progression)</SelectItem>
                  <SelectItem value="cyclical">Cyclical (Repeating process)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#4A5568] mt-2">
                {formData.type === 'linear' 
                  ? 'Client progresses through stages once (e.g., Sales pipeline)' 
                  : 'Recurring cycle of tasks (e.g., Quarterly business reviews)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Category
              </label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Describe Your Workflow *
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Example: Build a comprehensive enterprise sales workflow that starts with discovery, moves through qualification, proposal creation, negotiation, contracting, and handoff to onboarding. Include compliance checkpoints and legal reviews."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#BD00FF] h-40 resize-none"
              />
              <p className="text-xs text-[#4A5568] mt-2">
                Be specific about stages, deliverables, and key tasks you want included.
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!formData.description || isGenerating}
              className="w-full bg-gradient-to-r from-[#BD00FF] to-[#8B00CC] text-white hover:shadow-lg hover:shadow-[#BD00FF]/30 py-6"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Architect is designing your workflow...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate Workflow with AI
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Generated Structure Preview */
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{generatedStructure.name}</h2>
                <p className="text-sm text-[#A0AEC0]">{generatedStructure.description}</p>
              </div>
            </div>
            <Button
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish Template'
              )}
            </Button>
          </div>

          {/* Stages Preview */}
          <div className="space-y-4">
            {generatedStructure.stages.map((stage, stageIdx) => (
              <div key={stageIdx} className="neumorphic-raised rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleStage(stageIdx)}
                  className="w-full p-5 flex items-center justify-between hover:bg-[#2C2E33] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/20 flex items-center justify-center text-sm font-medium text-[#00E5FF]">
                      {stageIdx + 1}
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium">{stage.name}</h3>
                      <p className="text-sm text-[#A0AEC0]">
                        {stage.deliverables.length} deliverables
                      </p>
                    </div>
                  </div>
                  {expandedStages[stageIdx] ? (
                    <ChevronDown className="w-5 h-5 text-[#A0AEC0]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#A0AEC0]" />
                  )}
                </button>

                {expandedStages[stageIdx] && (
                  <div className="border-t border-[#2C2E33] p-5 space-y-4">
                    {stage.deliverables.map((deliverable, delIdx) => (
                      <div key={delIdx} className="neumorphic-pressed rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-6 h-6 rounded bg-[#2C2E33] flex items-center justify-center text-xs text-[#A0AEC0]">
                            D{delIdx + 1}
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{deliverable.name}</h4>
                          </div>
                        </div>

                        {/* Tasks */}
                        <div className="ml-9 space-y-2">
                          {deliverable.tasks.map((task, taskIdx) => (
                            <div key={taskIdx} className="flex items-start gap-2 text-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#4A5568] mt-2" />
                              <div className="flex-1">
                                <p className="text-[#F5F5F5]">{task.name}</p>
                                <p className="text-xs text-[#4A5568] mt-1">{task.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setGeneratedStructure(null)}
              className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}