import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import InsightsPanel from '@/components/analytics/InsightsPanel';
import {
  GitMerge,
  Layers,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Plus,
  Grid,
  List,
  Filter,
  MoreHorizontal,
  Sparkles,
  Edit,
  Trash2,
  XCircle,
  Trash
} from 'lucide-react';
import { toast } from 'sonner';

function WorkflowCard({ workflow, onClick, onCancel, onDelete }) {
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-500';
      case 'blocked': return 'bg-red-500';
      case 'in_progress': return 'bg-[#00E5FF]';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-[#4A5568]';
    }
  };

  return (
    <div className="neumorphic-raised rounded-xl p-5 group">
      <div 
        onClick={onClick}
        className="cursor-pointer"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-medium text-lg mb-1">{workflow.client_name || 'Unknown Client'}</h3>
            <p className="text-sm text-[#A0AEC0]">{workflow.name}</p>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {workflow.status !== 'completed' && workflow.status !== 'cancelled' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(workflow);
                }}
                className="p-2 rounded-lg hover:bg-red-500/10"
                title="Cancel workflow"
              >
                <XCircle className="w-4 h-4 text-red-400" />
              </button>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(workflow);
              }}
              className="p-2 rounded-lg hover:bg-red-500/10"
              title="Delete workflow"
            >
              <Trash className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-[#A0AEC0]">Progress</span>
          <span className="font-mono">{workflow.progress_percentage || 0}%</span>
        </div>
        <div className="h-2 bg-[#1A1B1E] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] rounded-full transition-all"
            style={{ width: `${workflow.progress_percentage || 0}%` }}
          />
        </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(workflow.status)}`} />
            <span className="text-sm text-[#A0AEC0] capitalize">{workflow.status?.replace('_', ' ') || 'Not Started'}</span>
          </div>
          {workflow.started_at && (
            <span className="text-xs font-mono text-[#4A5568]">
              {new Date(workflow.started_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, onStart, onEdit, onDelete }) {
  const categoryColors = {
    sales: 'from-blue-500 to-blue-600',
    onboarding: 'from-green-500 to-green-600',
    compliance: 'from-orange-500 to-orange-600',
    operations: 'from-purple-500 to-purple-600',
    support: 'from-pink-500 to-pink-600',
    renewal: 'from-cyan-500 to-cyan-600',
    custom: 'from-gray-500 to-gray-600',
  };

  return (
    <div className="neumorphic-raised rounded-xl p-5 group">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[template.category] || categoryColors.custom} flex items-center justify-center flex-shrink-0`}>
          <GitMerge className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium mb-1 flex-1">{template.name}</h3>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => onEdit(template)}
                className="p-1.5 rounded-lg hover:bg-[#2C2E33] text-[#A0AEC0] hover:text-[#00E5FF] transition-colors"
                title="Edit template"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(template)}
                className="p-1.5 rounded-lg hover:bg-[#2C2E33] text-[#A0AEC0] hover:text-red-400 transition-colors"
                title="Delete template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">{template.description || 'No description'}</p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#4A5568] capitalize">{template.type || 'linear'}</span>
            <span className="text-xs text-[#4A5568]">v{template.current_version || 1}</span>
          </div>
        </div>
      </div>
      <button 
        onClick={() => onStart(template)}
        className="mt-4 w-full py-2 rounded-lg border border-[#00E5FF]/30 text-[#00E5FF] text-sm font-medium hover:bg-[#00E5FF]/10 transition-colors opacity-0 group-hover:opacity-100"
      >
        Start Workflow
      </button>
    </div>
  );
}

export default function Workflows() {
  const [activeTab, setActiveTab] = useState('control'); // 'control' or 'studio'
  const [workflowSubTab, setWorkflowSubTab] = useState('active'); // 'active', 'completed', 'cancelled'
  const [viewMode, setViewMode] = useState('grid');
  const [showInsights, setShowInsights] = useState(false);
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: async () => {
      const workflowInstances = await base44.entities.WorkflowInstance.list('-created_date', 50);
      
      // Get unique client IDs
      const clientIds = [...new Set(workflowInstances.map(w => w.client_id).filter(Boolean))];
      
      // Fetch all clients
      const clients = await Promise.all(
        clientIds.map(id => base44.entities.Client.filter({ id }))
      );
      
      // Create a client lookup map
      const clientMap = {};
      clients.forEach(clientArray => {
        if (clientArray.length > 0) {
          const client = clientArray[0];
          clientMap[client.id] = client.name;
        }
      });
      
      // Attach client names to workflow instances
      return workflowInstances.map(workflow => ({
        ...workflow,
        client_name: clientMap[workflow.client_id] || 'Unknown Client'
      }));
    },
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list('-created_date', 50),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      await base44.entities.WorkflowTemplate.delete(templateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  const cancelWorkflowMutation = useMutation({
    mutationFn: async (workflowInstanceId) => {
      const response = await base44.functions.invoke('cancelWorkflow', {
        workflow_instance_id: workflowInstanceId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      toast.success('Workflow cancelled successfully');
    },
    onError: () => {
      toast.error('Failed to cancel workflow');
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowInstanceId) => {
      const response = await base44.functions.invoke('deleteWorkflow', {
        workflow_instance_id: workflowInstanceId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      toast.success('Workflow deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete workflow');
    },
  });

  const handleEditTemplate = (template) => {
    // Navigate to WorkflowBuilder with template ID for editing
    window.location.href = createPageUrl('WorkflowBuilder') + `?edit=${template.id}`;
  };

  const handleDeleteTemplate = (template) => {
    if (confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };

  const handleCancelWorkflow = (workflow) => {
    if (confirm(`Are you sure you want to cancel this workflow? All pending tasks will be deleted.`)) {
      cancelWorkflowMutation.mutate(workflow.id);
    }
  };

  const handleDeleteWorkflow = (workflow) => {
    if (confirm(`Are you sure you want to permanently delete this workflow and all its history? This action cannot be undone.`)) {
      deleteWorkflowMutation.mutate(workflow.id);
    }
  };

  // Filter instances based on sub-tab
  const filteredInstances = instances.filter(workflow => {
    if (workflowSubTab === 'active') {
      return ['in_progress', 'not_started', 'blocked'].includes(workflow.status);
    } else if (workflowSubTab === 'completed') {
      return workflow.status === 'completed';
    } else if (workflowSubTab === 'cancelled') {
      return workflow.status === 'cancelled';
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Workflows</h1>
          <p className="text-[#A0AEC0]">
            {activeTab === 'control' 
              ? `${filteredInstances.length} ${workflowSubTab} workflows`
              : `${templates.length} templates`
            }
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Tab Toggle */}
          <div className="neumorphic-pressed rounded-lg p-1 flex">
            <button
              onClick={() => setActiveTab('control')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                activeTab === 'control' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              <Play className="w-4 h-4 inline mr-2" />
              Control Tower
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                activeTab === 'studio' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-2" />
              Studio
            </button>
          </div>

          {activeTab === 'studio' && (
            <Link to={createPageUrl('WorkflowBuilder')}>
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm hover:shadow-lg hover:shadow-[#00E5FF]/30 transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </Link>
          )}
        </div>
      </div>

      {activeTab === 'control' ? (
        /* Control Tower - Active Instances */
        <div>
          {/* Sub-tabs for workflow status */}
          <div className="neumorphic-pressed rounded-lg p-1 flex mb-6 w-fit">
            <button
              onClick={() => setWorkflowSubTab('active')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                workflowSubTab === 'active' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setWorkflowSubTab('completed')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                workflowSubTab === 'completed' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setWorkflowSubTab('cancelled')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                workflowSubTab === 'cancelled' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              Cancelled
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <button className="neumorphic-pressed px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-[#A0AEC0] hover:text-[#F5F5F5]">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button 
              onClick={() => setShowInsights(!showInsights)}
              className={`neumorphic-pressed px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                showInsights ? 'text-[#BD00FF]' : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI Insights
            </button>
            <div className="neumorphic-pressed rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md ${viewMode === 'grid' ? 'bg-[#2C2E33] text-[#00E5FF]' : 'text-[#A0AEC0]'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md ${viewMode === 'list' ? 'bg-[#2C2E33] text-[#00E5FF]' : 'text-[#A0AEC0]'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showInsights && (
            <div className="mb-6 neumorphic-raised rounded-xl p-4">
              <h3 className="font-semibold mb-4">Workflow Analytics</h3>
              <InsightsPanel />
            </div>
          )}

          {instancesLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <GitMerge className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No {workflowSubTab.charAt(0).toUpperCase() + workflowSubTab.slice(1)} Workflows</h3>
              <p className="text-[#A0AEC0] mb-4">
                {workflowSubTab === 'active' 
                  ? 'Start a new workflow from the Studio or push a client into a workflow.'
                  : `You don't have any ${workflowSubTab} workflows yet.`
                }
              </p>
              {workflowSubTab === 'active' && (
                <button 
                  onClick={() => setActiveTab('studio')}
                  className="px-4 py-2 rounded-lg bg-[#2C2E33] text-[#00E5FF] text-sm hover:bg-[#3a3d44]"
                >
                  Go to Studio
                </button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'}>
              {filteredInstances.map(workflow => (
                <WorkflowCard 
                  key={workflow.id} 
                  workflow={workflow} 
                  onClick={() => {}}
                  onCancel={handleCancelWorkflow}
                  onDelete={handleDeleteWorkflow}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Studio - Templates */
        <div>
          {templatesLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-40 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <Layers className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Templates Yet</h3>
              <p className="text-[#A0AEC0] mb-4">Create your first workflow template to standardize your processes.</p>
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm">
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {templates.map(template => (
                <TemplateCard 
                  key={template.id} 
                  template={template} 
                  onStart={() => {}} 
                  onEdit={handleEditTemplate}
                  onDelete={handleDeleteTemplate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}