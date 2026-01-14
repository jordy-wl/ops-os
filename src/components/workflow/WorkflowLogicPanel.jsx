import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WorkflowLogicPanel({ stages, deliverables, tasks, onUpdateTasks }) {
  const [expandedTasks, setExpandedTasks] = useState({});

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.filter({ is_active: true })
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.filter({ is_active: true })
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const toggleTask = (key) => {
    setExpandedTasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addOutcome = (stageIdx, delIdx, taskIdx) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    const task = existing[taskIdx];
    
    const outcomes = task.outcomes || [];
    outcomes.push({
      outcome_name: '',
      action: 'continue',
      target_id: null
    });
    
    existing[taskIdx] = { ...task, outcomes };
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  const updateOutcome = (stageIdx, delIdx, taskIdx, outcomeIdx, field, value) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    const task = existing[taskIdx];
    const outcomes = [...(task.outcomes || [])];
    
    outcomes[outcomeIdx] = { ...outcomes[outcomeIdx], [field]: value };
    existing[taskIdx] = { ...task, outcomes };
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  const removeOutcome = (stageIdx, delIdx, taskIdx, outcomeIdx) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    const task = existing[taskIdx];
    const outcomes = (task.outcomes || []).filter((_, i) => i !== outcomeIdx);
    
    existing[taskIdx] = { ...task, outcomes };
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  const updateTaskAssignment = (stageIdx, delIdx, taskIdx, field, value) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    const task = existing[taskIdx];
    
    existing[taskIdx] = { ...task, [field]: value };
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  // Build a flat list of all tasks with their paths
  const allTasks = [];
  stages.forEach((stage, stageIdx) => {
    const stageDels = deliverables[`stage_${stageIdx}`] || [];
    stageDels.forEach((del, delIdx) => {
      const delTasks = tasks[`stage_${stageIdx}_del_${delIdx}`] || [];
      delTasks.forEach((task, taskIdx) => {
        allTasks.push({
          stageIdx,
          delIdx,
          taskIdx,
          stageName: stage.name,
          delName: del.name,
          task,
          key: `${stageIdx}-${delIdx}-${taskIdx}`
        });
      });
    });
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Configure Logic & Assignments</h2>
        <p className="text-sm text-[#A0AEC0] mt-1">Define outcomes, routing logic, and task assignments</p>
      </div>

      <div className="space-y-3">
        {allTasks.map(({ stageIdx, delIdx, taskIdx, stageName, delName, task, key }) => {
          const isExpanded = expandedTasks[key];
          const taskKey = `stage_${stageIdx}_del_${delIdx}`;

          return (
            <div key={key} className="neumorphic-raised rounded-xl overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#2C2E33] transition-colors"
                onClick={() => toggleTask(key)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-[#A0AEC0]" /> : <ChevronRight className="w-4 h-4 text-[#A0AEC0]" />}
                  <div>
                    <p className="font-medium">{task.name || 'Untitled Task'}</p>
                    <p className="text-xs text-[#4A5568] mt-0.5">
                      {stageName} → {delName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#A0AEC0]">
                  {task.outcomes?.length > 0 && (
                    <span>{task.outcomes.length} outcome{task.outcomes.length !== 1 ? 's' : ''}</span>
                  )}
                  {task.owner_type && (
                    <span className="capitalize">• {task.owner_type}</span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-6 border-t border-[#2C2E33] pt-4">
                  {/* Assignment Configuration */}
                  <div>
                    <h4 className="text-sm font-medium text-[#A0AEC0] mb-3">Assignment</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#4A5568] mb-2">Assign To</label>
                        <Select 
                          value={task.owner_type || 'user'} 
                          onValueChange={(v) => {
                            updateTaskAssignment(stageIdx, delIdx, taskIdx, 'owner_type', v);
                            updateTaskAssignment(stageIdx, delIdx, taskIdx, 'owner_id', null);
                          }}
                        >
                          <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2C2E33]">
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-xs text-[#4A5568] mb-2">
                          {task.owner_type === 'department' ? 'Department' : task.owner_type === 'team' ? 'Team' : 'User'}
                        </label>
                        <Select 
                          value={task.owner_id || ''} 
                          onValueChange={(v) => updateTaskAssignment(stageIdx, delIdx, taskIdx, 'owner_id', v)}
                        >
                          <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2C2E33]">
                            {task.owner_type === 'department' && departments.map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                            {task.owner_type === 'team' && teams.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                            {task.owner_type === 'user' && users.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Outcomes & Routing */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-[#A0AEC0]">Outcomes & Routing</h4>
                      <button
                        onClick={() => addOutcome(stageIdx, delIdx, taskIdx)}
                        className="text-xs text-[#00E5FF] hover:text-[#00E5FF]/80 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Outcome
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(task.outcomes || []).map((outcome, outcomeIdx) => (
                        <div key={outcomeIdx} className="bg-[#1A1B1E] rounded-lg p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <Input
                              value={outcome.outcome_name}
                              onChange={(e) => updateOutcome(stageIdx, delIdx, taskIdx, outcomeIdx, 'outcome_name', e.target.value)}
                              placeholder="Outcome name (e.g., Approved, Rejected)"
                              className="flex-1 bg-[#121212] border-[#2C2E33] text-sm h-8"
                            />
                            <button
                              onClick={() => removeOutcome(stageIdx, delIdx, taskIdx, outcomeIdx)}
                              className="p-1.5 rounded hover:bg-[#2C2E33] text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-[#4A5568] mb-1">Action</label>
                              <Select 
                                value={outcome.action || 'continue'} 
                                onValueChange={(v) => {
                                  updateOutcome(stageIdx, delIdx, taskIdx, outcomeIdx, 'action', v);
                                  if (v === 'continue' || v === 'end_workflow' || v === 'block_workflow') {
                                    updateOutcome(stageIdx, delIdx, taskIdx, outcomeIdx, 'target_id', null);
                                  }
                                }}
                              >
                                <SelectTrigger className="bg-[#121212] border-[#2C2E33] text-xs h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2C2E33]">
                                  <SelectItem value="continue">Continue to Next</SelectItem>
                                  <SelectItem value="skip_to_stage">Skip to Stage</SelectItem>
                                  <SelectItem value="skip_to_deliverable">Skip to Deliverable</SelectItem>
                                  <SelectItem value="skip_to_task">Skip to Task</SelectItem>
                                  <SelectItem value="end_workflow">End Workflow</SelectItem>
                                  <SelectItem value="block_workflow">Block Workflow</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {(outcome.action?.startsWith('skip_to')) && (
                              <div>
                                <label className="block text-xs text-[#4A5568] mb-1">Target</label>
                                <Select 
                                  value={outcome.target_id || ''} 
                                  onValueChange={(v) => updateOutcome(stageIdx, delIdx, taskIdx, outcomeIdx, 'target_id', v)}
                                >
                                  <SelectTrigger className="bg-[#121212] border-[#2C2E33] text-xs h-7">
                                    <SelectValue placeholder="Select target..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#2C2E33]">
                                    {outcome.action === 'skip_to_stage' && stages.map((s, i) => (
                                      <SelectItem key={i} value={`stage_${i}`}>
                                        {s.name || `Stage ${i + 1}`}
                                      </SelectItem>
                                    ))}
                                    {outcome.action === 'skip_to_deliverable' && stages.map((s, si) => 
                                      (deliverables[`stage_${si}`] || []).map((d, di) => (
                                        <SelectItem key={`${si}-${di}`} value={`del_${si}_${di}`}>
                                          {s.name} → {d.name}
                                        </SelectItem>
                                      ))
                                    )}
                                    {outcome.action === 'skip_to_task' && allTasks.map((t, i) => (
                                      <SelectItem key={i} value={`task_${t.stageIdx}_${t.delIdx}_${t.taskIdx}`}>
                                        {t.task.name || `Task ${i + 1}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {(!task.outcomes || task.outcomes.length === 0) && (
                        <p className="text-xs text-[#4A5568] text-center py-4">
                          No outcomes defined - task will proceed linearly
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {allTasks.length === 0 && (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <p className="text-[#A0AEC0]">No tasks to configure. Go back and add tasks first.</p>
          </div>
        )}
      </div>
    </div>
  );
}