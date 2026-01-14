import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Wand2, 
  Edit3, 
  ArrowRight, 
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AIWorkflowGenerator from '@/components/workflow/AIWorkflowGenerator';
import ManualWorkflowBuilder from '@/components/workflow/ManualWorkflowBuilder';

export default function WorkflowBuilder() {
  const [creationMode, setCreationMode] = useState(null); // 'ai' or 'manual'
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Check for edit parameter and fetch template
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      setEditingTemplateId(editId);
      setCreationMode('manual');
    }
  }, [searchParams]);

  return (
    <div className="p-6 min-h-screen">
      {!creationMode ? (
        /* Mode Selection */
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Create Workflow Template</h1>
            <p className="text-[#A0AEC0]">Choose how you'd like to build your workflow</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* AI-Assisted */}
            <button
              onClick={() => setCreationMode('ai')}
              className="neumorphic-raised rounded-2xl p-8 text-left transition-all hover:translate-y-[-4px] group"
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#BD00FF] to-[#8B00CC] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI-Assisted Generation</h3>
              <p className="text-[#A0AEC0] mb-4">
                Describe your workflow in natural language and let the Architect AI generate a complete structure with stages, deliverables, and tasks.
              </p>
              <div className="flex items-center gap-2 text-[#BD00FF] text-sm font-medium">
                <span>Start with AI</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* Manual Builder */}
            <button
              onClick={() => setCreationMode('manual')}
              className="neumorphic-raised rounded-2xl p-8 text-left transition-all hover:translate-y-[-4px] group"
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#0099ff] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Edit3 className="w-8 h-8 text-[#121212]" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Manual Builder</h3>
              <p className="text-[#A0AEC0] mb-4">
                Build your workflow step-by-step with full control over every stage, deliverable, task, and detail.
              </p>
              <div className="flex items-center gap-2 text-[#00E5FF] text-sm font-medium">
                <span>Build manually</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          <button
            onClick={() => navigate(createPageUrl('Workflows'))}
            className="mt-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workflows
          </button>
        </div>
      ) : creationMode === 'ai' ? (
        <AIWorkflowGenerator onBack={() => setCreationMode(null)} />
      ) : (
        <ManualWorkflowBuilder onBack={() => setCreationMode(null)} editingTemplateId={editingTemplateId} />
      )}
    </div>
  );
}