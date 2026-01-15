import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X, Trash2, GitBranch } from 'lucide-react';
import { AssignmentUserSelector, AssignmentTeamSelector, AssignmentDepartmentSelector } from './AssignmentSelectors';

const fieldTypeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'single_select', label: 'Single Select' },
  { value: 'multiselect', label: 'Multi Select' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'file', label: 'File Upload' }
];

export default function TaskConfigPanel({ task, onSave, onClose, allStages, allDeliverables, allTasks, isLogicStage }) {
  const [formData, setFormData] = useState(task || {
    name: '',
    description: '',
    instructions: '',
    priority: 'normal',
    estimated_duration_minutes: 0,
    is_required: true,
    requires_review: false,
    can_be_overridden: true,
    data_field_definitions: [],
    conditions: {},
    assignment_config: {
      auto_assign_to_lead: false,
      allow_reassignment: true,
      reassignment_allowed_by: ['team_lead', 'department_head']
    }
  });

  const [activeTab, setActiveTab] = useState('basic');

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const addDataField = () => {
    setFormData({
      ...formData,
      data_field_definitions: [
        ...(formData.data_field_definitions || []),
        {
          field_name: '',
          field_code: '',
          field_type: 'text',
          is_required: false,
          save_to_client_field: '',
          description: ''
        }
      ]
    });
  };

  const updateDataField = (index, updates) => {
    const fields = [...formData.data_field_definitions];
    fields[index] = { ...fields[index], ...updates };
    setFormData({ ...formData, data_field_definitions: fields });
  };

  const removeDataField = (index) => {
    const fields = formData.data_field_definitions.filter((_, i) => i !== index);
    setFormData({ ...formData, data_field_definitions: fields });
  };

  const addOutcome = () => {
    const outcomes = formData.conditions?.outcomes || [];
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        outcomes: [
          ...outcomes,
          {
            outcome_name: '',
            action: 'continue',
            target_stage_id: '',
            target_task_id: '',
            target_deliverable_id: '',
            target_workflow_template_id: ''
          }
        ]
      }
    });
  };

  const updateOutcome = (index, updates) => {
    const outcomes = [...(formData.conditions?.outcomes || [])];
    outcomes[index] = { ...outcomes[index], ...updates };
    setFormData({ 
      ...formData, 
      conditions: { ...formData.conditions, outcomes } 
    });
  };

  const removeOutcome = (index) => {
    const outcomes = (formData.conditions?.outcomes || []).filter((_, i) => i !== index);
    setFormData({ 
      ...formData, 
      conditions: { ...formData.conditions, outcomes } 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Configure Task</h3>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs - Only show in non-logic stage */}
      {!isLogicStage && (
        <div className="flex gap-2 border-b border-[#2C2E33]">
          {['basic', 'data', 'assignment'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[#00E5FF] border-b-2 border-[#00E5FF]'
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Logic Stage Header */}
      {isLogicStage && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Task: {formData.name}</h3>
          <p className="text-sm text-[#A0AEC0]">Define conditional outcomes for this task</p>
        </div>
      )}

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {/* Basic Tab */}
        {!isLogicStage && activeTab === 'basic' && (
          <>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Collect Requirements"
                className={`bg-[#1A1B1E] border-[#2C2E33] ${!formData.name ? 'border-red-400/50' : ''}`}
              />
              {!formData.name && (
                <p className="text-xs text-red-400 mt-1">Task name is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this task accomplish?"
                className="bg-[#1A1B1E] border-[#2C2E33] h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Instructions (SOP)</label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Step-by-step instructions..."
                className="bg-[#1A1B1E] border-[#2C2E33] h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Priority</label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Duration (min)</label>
                <Input
                  type="number"
                  value={formData.estimated_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) })}
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-[#A0AEC0]">Required task</label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.requires_review}
                  onChange={(e) => setFormData({ ...formData, requires_review: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-[#A0AEC0]">Requires review before completion</label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.can_be_overridden}
                  onChange={(e) => setFormData({ ...formData, can_be_overridden: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-[#A0AEC0]">Can be skipped/modified in instances</label>
              </div>
            </div>
          </>
        )}

        {/* Data Fields Tab */}
        {!isLogicStage && activeTab === 'data' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#A0AEC0]">
                Define data fields to collect. Values are saved to the client record.
              </p>
              <Button
                size="sm"
                onClick={addDataField}
                className="bg-[#00E5FF] text-[#121212]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>

            {formData.data_field_definitions?.map((field, idx) => (
              <div key={idx} className="neumorphic-pressed rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Field {idx + 1}</span>
                  <button
                    onClick={() => removeDataField(idx)}
                    className="p-1 rounded hover:bg-[#3a3d44]"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Field Name</label>
                    <Input
                      value={field.field_name}
                      onChange={(e) => updateDataField(idx, { field_name: e.target.value })}
                      placeholder="Budget Amount"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Field Code</label>
                    <Input
                      value={field.field_code}
                      onChange={(e) => updateDataField(idx, { field_code: e.target.value })}
                      placeholder="budget_amount"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#A0AEC0] mb-1">Field Type</label>
                  <Select 
                    value={field.field_type} 
                    onValueChange={(v) => updateDataField(idx, { field_type: v })}
                  >
                    <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2E33]">
                      {fieldTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={(e) => updateDataField(idx, { is_required: e.target.checked })}
                    className="w-3 h-3"
                  />
                  <label className="text-xs text-[#A0AEC0]">Required field</label>
                </div>
              </div>
            ))}

            {formData.data_field_definitions?.length === 0 && (
              <div className="text-center py-8 text-[#4A5568]">
                <p className="text-sm">No data fields defined</p>
                <p className="text-xs mt-1">Add fields to collect data during task execution</p>
              </div>
            )}
          </div>
        )}

        {/* Conditions Tab - Only show when in Logic Stage */}
        {isLogicStage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#A0AEC0]">
                <GitBranch className="w-5 h-5" />
                <p className="text-sm">
                  Define task outcomes and workflow paths
                </p>
              </div>
              <Button
                size="sm"
                onClick={addOutcome}
                className="bg-[#00E5FF] text-[#121212]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Outcome
              </Button>
            </div>

            <p className="text-xs text-[#4A5568]">
              Define possible outcomes (e.g., "Meeting Booked", "Not Interested") and what happens to the workflow for each
            </p>

            {formData.conditions?.outcomes?.map((outcome, idx) => (
              <div key={idx} className="neumorphic-pressed rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-2">
                    <label className="block text-xs text-[#A0AEC0] mb-1">Outcome Name</label>
                    <Input
                      value={outcome.outcome_name}
                      onChange={(e) => updateOutcome(idx, { outcome_name: e.target.value })}
                      placeholder="e.g., Meeting Booked, Approved, Not Interested"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm font-medium"
                    />
                  </div>
                  <button
                    onClick={() => removeOutcome(idx)}
                    className="p-2 rounded hover:bg-[#3a3d44] mt-5"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-[#A0AEC0] mb-1">When User Selects This Outcome</label>
                  <Select 
                    value={outcome.action} 
                    onValueChange={(v) => updateOutcome(idx, { action: v })}
                  >
                    <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2E33]">
                      <SelectItem value="continue">Continue to Next Task</SelectItem>
                      <SelectItem value="skip_to_stage">Skip to Stage</SelectItem>
                      <SelectItem value="skip_to_deliverable">Skip to Deliverable</SelectItem>
                      <SelectItem value="skip_to_task">Skip to Task</SelectItem>
                      <SelectItem value="start_workflow">Start New Workflow</SelectItem>
                      <SelectItem value="end_workflow">End Workflow</SelectItem>
                      <SelectItem value="block_workflow">Block Workflow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {outcome.action === 'skip_to_stage' && allStages && (
                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Target Stage</label>
                    <Select 
                      value={outcome.target_stage_index?.toString() || ''} 
                      onValueChange={(v) => updateOutcome(idx, { target_stage_index: parseInt(v), target_stage_name: allStages[parseInt(v)]?.name })}
                    >
                      <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                        <SelectValue placeholder="Select stage..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2E33]">
                        {allStages.map((stage, sIdx) => (
                          <SelectItem key={sIdx} value={sIdx.toString()}>
                            Stage {sIdx + 1}: {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[#4A5568] mt-1">Workflow will jump to this stage</p>
                  </div>
                )}

                {outcome.action === 'skip_to_deliverable' && allDeliverables && (
                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Target Deliverable</label>
                    <Select 
                      value={outcome.target_deliverable_key || ''} 
                      onValueChange={(v) => {
                        const [, stageIdx, , delIdx] = v.split('_');
                        const deliverable = allDeliverables[v]?.[parseInt(delIdx)];
                        updateOutcome(idx, { 
                          target_deliverable_key: v,
                          target_deliverable_name: deliverable?.name 
                        });
                      }}
                    >
                      <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                        <SelectValue placeholder="Select deliverable..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2E33]">
                        {Object.keys(allDeliverables).map((key) => {
                          const [, stageIdx] = key.split('_');
                          const stageName = allStages?.[parseInt(stageIdx)]?.name;
                          return allDeliverables[key].map((del, delIdx) => (
                            <SelectItem key={`${key}_${delIdx}`} value={`stage_${stageIdx}`}>
                              {stageName} → {del.name}
                            </SelectItem>
                          ));
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[#4A5568] mt-1">Workflow will jump to this deliverable and start its tasks</p>
                  </div>
                )}

                {outcome.action === 'skip_to_task' && allTasks && (
                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Target Task</label>
                    <Select 
                      value={outcome.target_task_key || ''} 
                      onValueChange={(v) => {
                        const parts = v.split('_');
                        const taskIdx = parseInt(parts[parts.length - 1]);
                        const task = allTasks[v.substring(0, v.lastIndexOf('_'))]?.[taskIdx];
                        updateOutcome(idx, { 
                          target_task_key: v,
                          target_task_name: task?.name 
                        });
                      }}
                    >
                      <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                        <SelectValue placeholder="Select task..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2C2E33]">
                        {Object.keys(allTasks).map((key) => {
                          const [, stageIdx, , delIdx] = key.split('_');
                          const stageName = allStages?.[parseInt(stageIdx)]?.name;
                          const delName = allDeliverables?.[`stage_${stageIdx}`]?.[parseInt(delIdx)]?.name;
                          return allTasks[key].map((task, taskIdx) => (
                            <SelectItem key={`${key}_${taskIdx}`} value={`${key}_${taskIdx}`}>
                              {stageName} → {delName} → {task.name}
                            </SelectItem>
                          ));
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[#4A5568] mt-1">Workflow will jump to this specific task</p>
                  </div>
                )}

                {outcome.action === 'start_workflow' && (
                  <div>
                    <label className="block text-xs text-[#A0AEC0] mb-1">Workflow Template</label>
                    <Input
                      value={outcome.target_workflow_template_id}
                      onChange={(e) => updateOutcome(idx, { target_workflow_template_id: e.target.value })}
                      placeholder="Enter workflow template ID"
                      className="bg-[#1A1B1E] border-[#2C2E33] text-sm"
                    />
                    <p className="text-xs text-[#4A5568] mt-1">A new workflow instance will be started for this client</p>
                  </div>
                )}
              </div>
            ))}

            {(!formData.conditions?.outcomes || formData.conditions.outcomes.length === 0) && (
              <div className="text-center py-8 text-[#4A5568]">
                <p className="text-sm">No outcomes defined</p>
                <p className="text-xs mt-1">Add outcomes to create branching logic (e.g., "Meeting Booked" → Continue, "Not Interested" → End Workflow)</p>
              </div>
            )}
          </div>
        )}

        {/* Assignment Tab */}
        {!isLogicStage && activeTab === 'assignment' && (
          <div className="space-y-4">
            <p className="text-sm text-[#A0AEC0]">
              Configure task assignment and permissions
            </p>

            {/* Assign To */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#A0AEC0]">Assign To</label>
              
              <div>
                <label className="block text-xs text-[#A0AEC0] mb-1">Assignment Type</label>
                <Select 
                  value={formData.owner_type || ''} 
                  onValueChange={(v) => setFormData({ ...formData, owner_type: v, owner_id: '' })}
                >
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                    <SelectValue placeholder="Select assignment type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33]">
                    <SelectItem value="user">Specific User</SelectItem>
                    <SelectItem value="team">Team (routed to team lead)</SelectItem>
                    <SelectItem value="department">Department (routed to dept head)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.owner_type === 'user' && (
                <AssignmentUserSelector
                  value={formData.owner_id || ''}
                  onChange={(v) => setFormData({ ...formData, owner_id: v })}
                />
              )}

              {formData.owner_type === 'team' && (
                <AssignmentTeamSelector
                  value={formData.owner_id || ''}
                  onChange={(v) => setFormData({ ...formData, owner_id: v })}
                />
              )}

              {formData.owner_type === 'department' && (
                <AssignmentDepartmentSelector
                  value={formData.owner_id || ''}
                  onChange={(v) => setFormData({ ...formData, owner_id: v })}
                />
              )}
            </div>

            <div className="border-t border-[#2C2E33] pt-4 space-y-3">
              <label className="block text-sm font-medium text-[#A0AEC0]">Assignment Settings</label>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.assignment_config?.auto_assign_to_lead}
                  onChange={(e) => setFormData({
                    ...formData,
                    assignment_config: {
                      ...formData.assignment_config,
                      auto_assign_to_lead: e.target.checked
                    }
                  })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-[#A0AEC0]">
                  Auto-assign to team/department lead
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.assignment_config?.allow_reassignment}
                  onChange={(e) => setFormData({
                    ...formData,
                    assignment_config: {
                      ...formData.assignment_config,
                      allow_reassignment: e.target.checked
                    }
                  })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-[#A0AEC0]">
                  Allow reassignment after release
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Who can reassign?
              </label>
              <div className="space-y-2">
                {['team_lead', 'department_head', 'admin'].map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.assignment_config?.reassignment_allowed_by?.includes(role)}
                      onChange={(e) => {
                        const current = formData.assignment_config?.reassignment_allowed_by || [];
                        const updated = e.target.checked
                          ? [...current, role]
                          : current.filter(r => r !== role);
                        setFormData({
                          ...formData,
                          assignment_config: {
                            ...formData.assignment_config,
                            reassignment_allowed_by: updated
                          }
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <label className="text-sm text-[#A0AEC0] capitalize">
                      {role.replace('_', ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(formData)}
          disabled={!formData.name}
          className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
        >
          Save Task
        </Button>
      </div>
    </div>
  );
}