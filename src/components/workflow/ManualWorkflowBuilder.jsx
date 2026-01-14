import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  Trash2, 
  GripVertical,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WorkflowStructurePanel from './WorkflowStructurePanel';
import DeliverableTaskPanel from './DeliverableTaskPanel';
import WorkflowLogicPanel from './WorkflowLogicPanel';
import WorkflowReviewPanel from './WorkflowReviewPanel';

const STEPS = ['Basic Info', 'Stages', 'Deliverables & Tasks', 'Logic', 'Review'];

export default function ManualWorkflowBuilder({ onBack }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'linear',
    category: 'custom',
    next_workflow_template_id: '',
    stages: [],
    deliverables: {},
    tasks: {}
  });
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: availableTemplates = [] } = useQuery({
    queryKey: ['workflow-templates-list'],
    queryFn: () => base44.entities.WorkflowTemplate.filter({ is_active: true }),
  });

  const addStage = () => {
    setFormData({
      ...formData,
      stages: [...formData.stages, { name: '', description: '' }]
    });
  };

  const removeStage = (index) => {
    const newStages = formData.stages.filter((_, i) => i !== index);
    setFormData({ ...formData, stages: newStages });
  };

  const updateStage = (index, field, value) => {
    const newStages = [...formData.stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setFormData({ ...formData, stages: newStages });
  };

  const addDeliverable = (stageIndex) => {
    setEditingDeliverable({ stageIndex, delIndex: null, data: null });
  };

  const saveDeliverable = (data) => {
    const { stageIndex, delIndex } = editingDeliverable;
    const key = `stage_${stageIndex}`;
    const existing = [...(formData.deliverables[key] || [])];
    
    if (delIndex !== null) {
      existing[delIndex] = data;
    } else {
      existing.push(data);
    }
    
    setFormData({
      ...formData,
      deliverables: { ...formData.deliverables, [key]: existing }
    });
    setEditingDeliverable(null);
  };

  const removeDeliverable = (stageIndex, delIndex) => {
    const key = `stage_${stageIndex}`;
    const existing = formData.deliverables[key] || [];
    setFormData({
      ...formData,
      deliverables: {
        ...formData.deliverables,
        [key]: existing.filter((_, i) => i !== delIndex)
      }
    });
  };

  const updateDeliverable = (stageIndex, delIndex, field, value) => {
    const key = `stage_${stageIndex}`;
    const existing = [...(formData.deliverables[key] || [])];
    existing[delIndex] = { ...existing[delIndex], [field]: value };
    setFormData({
      ...formData,
      deliverables: {
        ...formData.deliverables,
        [key]: existing
      }
    });
  };

  const addTask = (stageIndex, delIndex) => {
    setEditingTask({ stageIndex, delIndex, taskIndex: null, data: null });
  };

  const saveTask = (data) => {
    const { stageIndex, delIndex, taskIndex } = editingTask;
    const key = `stage_${stageIndex}_del_${delIndex}`;
    const existing = [...(formData.tasks[key] || [])];
    
    if (taskIndex !== null) {
      existing[taskIndex] = data;
    } else {
      existing.push(data);
    }
    
    setFormData({
      ...formData,
      tasks: { ...formData.tasks, [key]: existing }
    });
    setEditingTask(null);
  };

  const removeTask = (stageIndex, delIndex, taskIndex) => {
    const key = `stage_${stageIndex}_del_${delIndex}`;
    const existing = formData.tasks[key] || [];
    setFormData({
      ...formData,
      tasks: {
        ...formData.tasks,
        [key]: existing.filter((_, i) => i !== taskIndex)
      }
    });
  };

  const updateTask = (stageIndex, delIndex, taskIndex, field, value) => {
    const key = `stage_${stageIndex}_del_${delIndex}`;
    const existing = [...(formData.tasks[key] || [])];
    existing[taskIndex] = { ...existing[taskIndex], [field]: value };
    setFormData({
      ...formData,
      tasks: {
        ...formData.tasks,
        [key]: existing
      }
    });
  };

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      const user = await base44.auth.me();

      const template = await base44.entities.WorkflowTemplate.create({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        category: formData.category,
        current_version: 1,
        owner_type: 'user',
        owner_id: user.id,
        is_active: true,
        next_workflow_template_id: formData.next_workflow_template_id || null
      });

      const version = await base44.entities.WorkflowTemplateVersion.create({
        workflow_template_id: template.id,
        version_number: 1,
        name: formData.name,
        description: formData.description,
        status: 'draft',
        published_by: user.id
      });

      for (let stageIdx = 0; stageIdx < formData.stages.length; stageIdx++) {
        const stageData = formData.stages[stageIdx];
        
        const stage = await base44.entities.StageTemplate.create({
          workflow_template_version_id: version.id,
          name: stageData.name,
          description: stageData.description,
          sequence_order: stageIdx + 1,
          owner_type: 'user',
          owner_id: user.id
        });

        const deliverables = formData.deliverables[`stage_${stageIdx}`] || [];
        
        for (let delIdx = 0; delIdx < deliverables.length; delIdx++) {
          const delData = deliverables[delIdx];
          
          const deliverable = await base44.entities.DeliverableTemplate.create({
            stage_template_id: stage.id,
            name: delData.name,
            description: delData.description,
            sequence_order: delIdx + 1,
            owner_type: 'user',
            owner_id: user.id
          });

          const tasks = formData.tasks[`stage_${stageIdx}_del_${delIdx}`] || [];
          
          for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
            const taskData = tasks[taskIdx];
            
            const taskTemplate = await base44.entities.TaskTemplate.create({
              deliverable_template_id: deliverable.id,
              name: taskData.name,
              description: taskData.description,
              instructions: taskData.instructions,
              priority: taskData.priority || 'normal',
              estimated_duration_minutes: taskData.estimated_duration_minutes || 0,
              is_required: taskData.is_required !== false,
              requires_review: taskData.requires_review || false,
              can_be_overridden: taskData.can_be_overridden !== false,
              data_field_definitions: taskData.data_field_definitions || [],
              conditions: { outcomes: taskData.outcomes || [] },
              assignment_config: taskData.assignment_config || {},
              sequence_order: taskIdx + 1,
              owner_type: taskData.owner_type || 'user',
              owner_id: taskData.owner_id || user.id
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      navigate(createPageUrl('Workflows'));
    } catch (error) {
      console.error('Failed to create workflow:', error);
      alert('Failed to create workflow: ' + error.message);
      setIsCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.name && formData.description;
      case 1: return formData.stages.length > 0 && formData.stages.every(s => s.name);
      case 2: {
        // Check that each stage has at least one deliverable with tasks
        return formData.stages.every((_, stageIdx) => {
          const dels = formData.deliverables[`stage_${stageIdx}`] || [];
          if (dels.length === 0) return false;
          
          return dels.every((d, delIdx) => {
            const taskList = formData.tasks[`stage_${stageIdx}_del_${delIdx}`] || [];
            return d.name && taskList.length > 0 && taskList.every(t => t.name);
          });
        });
      }
      case 3: return true; // Logic is optional
      default: return true;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                idx < currentStep 
                  ? 'bg-green-500/20 text-green-400' 
                  : idx === currentStep 
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF]' 
                  : 'bg-[#2C2E33] text-[#4A5568]'
              }`}>
                {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
              </div>
              <span className={`text-sm ${idx === currentStep ? 'text-[#F5F5F5]' : 'text-[#A0AEC0]'}`}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${idx < currentStep ? 'bg-green-500/50' : 'bg-[#2C2E33]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="neumorphic-raised rounded-2xl p-8 min-h-[500px]">
        {currentStep === 0 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Workflow Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Enterprise Sales Process"
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose and scope of this workflow..."
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                  Type
                </label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="cyclical">Cyclical</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Next Workflow (Optional)
              </label>
              <Select 
                value={formData.next_workflow_template_id} 
                onValueChange={(v) => setFormData({ ...formData, next_workflow_template_id: v })}
              >
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue placeholder="Auto-start another workflow on completion" />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value={null}>None</SelectItem>
                  {availableTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#4A5568] mt-2">
                When this workflow completes, automatically start the selected workflow for the same client
              </p>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <WorkflowStructurePanel 
            stages={formData.stages}
            onUpdateStages={(stages) => setFormData({ ...formData, stages })}
          />
        )}

        {currentStep === 2 && (
          <DeliverableTaskPanel
            stages={formData.stages}
            deliverables={formData.deliverables}
            tasks={formData.tasks}
            onUpdateDeliverables={(deliverables) => setFormData({ ...formData, deliverables })}
            onUpdateTasks={(tasks) => setFormData({ ...formData, tasks })}
          />
        )}

        {currentStep === 3 && (
          <WorkflowLogicPanel
            stages={formData.stages}
            deliverables={formData.deliverables}
            tasks={formData.tasks}
            onUpdateTasks={(tasks) => setFormData({ ...formData, tasks })}
          />
        )}

        {currentStep === 4 && (
          <WorkflowReviewPanel
            formData={formData}
            stages={formData.stages}
            deliverables={formData.deliverables}
            tasks={formData.tasks}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : onBack()}
          className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? 'Cancel' : 'Previous'}
        </Button>

        <Button
          onClick={() => {
            if (currentStep === STEPS.length - 1) {
              handleCreate();
            } else {
              setCurrentStep(currentStep + 1);
            }
          }}
          disabled={!canProceed() || isCreating}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Create Template
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>


    </div>
  );
}