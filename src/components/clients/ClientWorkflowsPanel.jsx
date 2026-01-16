import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { GitMerge, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusColors = {
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  not_started: 'bg-[#2C2E33] text-[#A0AEC0] border-[#3a3d44]',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  archived: 'bg-[#2C2E33] text-[#4A5568] border-[#3a3d44]',
};

export default function ClientWorkflowsPanel({ clientId }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: workflowInstances = [] } = useQuery({
    queryKey: ['workflow-instances', clientId],
    queryFn: () => base44.entities.WorkflowInstance.filter({ client_id: clientId }, '-created_date', 100),
    enabled: !!clientId,
  });

  const { data: availableTemplates = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.filter({ is_active: true }, '-created_date', 50),
  });

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0];
    },
    enabled: !!clientId,
  });

  const startWorkflowMutation = useMutation({
    mutationFn: async (templateId) => {
      return await base44.functions.invoke('startWorkflow', {
        workflow_template_id: templateId,
        client_id: clientId,
      });
    },
    onSuccess: () => {
      toast.success(`Workflow initiated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      setIsDropdownOpen(false);
    },
  });

  const activeWorkflows = workflowInstances.filter(w => w.status === 'in_progress' || w.status === 'not_started' || w.status === 'blocked');
  const completedWorkflows = workflowInstances.filter(w => w.status === 'completed');
  const otherWorkflows = workflowInstances.filter(w => w.status === 'cancelled' || w.status === 'archived');

  return (
    <div className="space-y-4">
      {/* Start New Workflow */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] hover:shadow-lg hover:shadow-[#00E5FF]/30 rounded-lg transition-all text-sm text-[#121212] font-medium"
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Start New Workflow
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#2C2E33] border border-[#3a3d44] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {availableTemplates.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#4A5568]">No workflows available</p>
            ) : (
              availableTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => startWorkflowMutation.mutate(template.id)}
                  disabled={startWorkflowMutation.isPending}
                  className="w-full text-left px-4 py-3 hover:bg-[#3a3d44] border-b border-[#1A1B1E] last:border-b-0 text-sm text-[#F5F5F5] transition-colors disabled:opacity-50"
                >
                  <p className="font-medium">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-[#A0AEC0] mt-0.5">{template.description}</p>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Active Workflows */}
      {activeWorkflows.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[#A0AEC0] mb-2 uppercase tracking-wide">Active</h4>
          <div className="space-y-2">
            {activeWorkflows.map((workflow) => (
              <Link
                key={workflow.id}
                to={createPageUrl('Workflows') + '?id=' + workflow.id}
                className="block neumorphic-pressed rounded-lg p-4 hover:bg-[#2C2E33] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <GitMerge className="w-4 h-4 text-[#00E5FF] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{workflow.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${statusColors[workflow.status] || statusColors.not_started}`}>
                        {workflow.status?.replace('_', ' ')}
                      </span>
                      {workflow.progress_percentage !== null && workflow.progress_percentage !== undefined && (
                        <span className="text-xs text-[#4A5568]">{workflow.progress_percentage}% complete</span>
                      )}
                    </div>
                    {workflow.started_at && (
                      <p className="text-xs text-[#4A5568] mt-1">
                        Started {new Date(workflow.started_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Completed Workflows */}
      {completedWorkflows.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[#A0AEC0] mb-2 uppercase tracking-wide">Completed</h4>
          <div className="space-y-2">
            {completedWorkflows.slice(0, 5).map((workflow) => (
              <Link
                key={workflow.id}
                to={createPageUrl('Workflows') + '?id=' + workflow.id}
                className="block neumorphic-pressed rounded-lg p-4 hover:bg-[#2C2E33] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <GitMerge className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{workflow.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusColors.completed}`}>
                        Completed
                      </span>
                    </div>
                    {workflow.completed_at && (
                      <p className="text-xs text-[#4A5568] mt-1">
                        Completed {new Date(workflow.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {workflowInstances.length === 0 && (
        <div className="neumorphic-pressed rounded-lg p-8 text-center">
          <GitMerge className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
          <p className="text-sm text-[#A0AEC0]">No workflows yet</p>
          <p className="text-xs text-[#4A5568] mt-1">Start a workflow to begin tracking progress</p>
        </div>
      )}
    </div>
  );
}