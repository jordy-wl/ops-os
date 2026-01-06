import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  MoreHorizontal
} from 'lucide-react';

function WorkflowCard({ workflow, onClick }) {
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-500';
      case 'blocked': return 'bg-red-500';
      case 'in_progress': return 'bg-[#00E5FF]';
      default: return 'bg-[#4A5568]';
    }
  };

  return (
    <div 
      onClick={onClick}
      className="neumorphic-raised rounded-xl p-5 cursor-pointer transition-all duration-200 hover:translate-y-[-2px] group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-medium text-lg mb-1">{workflow.client_name || 'Unknown Client'}</h3>
          <p className="text-sm text-[#A0AEC0]">{workflow.name}</p>
        </div>
        <button className="p-2 rounded-lg hover:bg-[#3a3d44] opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4 text-[#A0AEC0]" />
        </button>
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
  );
}

function TemplateCard({ template, onStart }) {
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
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[template.category] || categoryColors.custom} flex items-center justify-center`}>
          <GitMerge className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium mb-1">{template.name}</h3>
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
  const [viewMode, setViewMode] = useState('grid');

  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => base44.entities.WorkflowInstance.list('-created_date', 50),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list('-created_date', 50),
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Workflows</h1>
          <p className="text-[#A0AEC0]">
            {activeTab === 'control' 
              ? `${instances.length} active instances`
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
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm hover:shadow-lg hover:shadow-[#00E5FF]/30 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </button>
          )}
        </div>
      </div>

      {activeTab === 'control' ? (
        /* Control Tower - Active Instances */
        <div>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <button className="neumorphic-pressed px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-[#A0AEC0] hover:text-[#F5F5F5]">
              <Filter className="w-4 h-4" />
              Filter
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

          {instancesLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : instances.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <GitMerge className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Active Workflows</h3>
              <p className="text-[#A0AEC0] mb-4">Start a new workflow from the Studio or push a client into a workflow.</p>
              <button 
                onClick={() => setActiveTab('studio')}
                className="px-4 py-2 rounded-lg bg-[#2C2E33] text-[#00E5FF] text-sm hover:bg-[#3a3d44]"
              >
                Go to Studio
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3'}>
              {instances.map(workflow => (
                <WorkflowCard key={workflow.id} workflow={workflow} onClick={() => {}} />
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
                <TemplateCard key={template.id} template={template} onStart={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}