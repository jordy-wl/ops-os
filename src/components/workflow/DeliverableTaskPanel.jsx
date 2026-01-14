import React, { useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DeliverableTaskPanel({ stages, deliverables, tasks, onUpdateDeliverables, onUpdateTasks }) {
  const [expandedStages, setExpandedStages] = useState(stages.map((_, i) => i));

  const addDeliverable = (stageIdx) => {
    const key = `stage_${stageIdx}`;
    const existing = [...(deliverables[key] || [])];
    existing.push({ name: '', description: '', output_type: 'document' });
    onUpdateDeliverables({ ...deliverables, [key]: existing });
  };

  const removeDeliverable = (stageIdx, delIdx) => {
    const key = `stage_${stageIdx}`;
    const existing = deliverables[key] || [];
    onUpdateDeliverables({
      ...deliverables,
      [key]: existing.filter((_, i) => i !== delIdx)
    });
    
    // Also remove associated tasks
    const taskKey = `stage_${stageIdx}_del_${delIdx}`;
    const newTasks = { ...tasks };
    delete newTasks[taskKey];
    onUpdateTasks(newTasks);
  };

  const updateDeliverable = (stageIdx, delIdx, field, value) => {
    const key = `stage_${stageIdx}`;
    const existing = [...(deliverables[key] || [])];
    existing[delIdx] = { ...existing[delIdx], [field]: value };
    onUpdateDeliverables({ ...deliverables, [key]: existing });
  };

  const addTask = (stageIdx, delIdx) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    existing.push({ 
      name: '', 
      description: '', 
      priority: 'normal',
      owner_type: 'user'
    });
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  const removeTask = (stageIdx, delIdx, taskIdx) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = tasks[key] || [];
    onUpdateTasks({
      ...tasks,
      [key]: existing.filter((_, i) => i !== taskIdx)
    });
  };

  const updateTask = (stageIdx, delIdx, taskIdx, field, value) => {
    const key = `stage_${stageIdx}_del_${delIdx}`;
    const existing = [...(tasks[key] || [])];
    existing[taskIdx] = { ...existing[taskIdx], [field]: value };
    onUpdateTasks({ ...tasks, [key]: existing });
  };

  const toggleStage = (idx) => {
    setExpandedStages(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Define Deliverables & Tasks</h2>
        <p className="text-sm text-[#A0AEC0] mt-1">Add deliverables and tasks to each stage</p>
      </div>

      <div className="space-y-4">
        {stages.map((stage, stageIdx) => {
          const isExpanded = expandedStages.includes(stageIdx);
          const stageDels = deliverables[`stage_${stageIdx}`] || [];

          return (
            <div key={stageIdx} className="neumorphic-pressed rounded-xl overflow-hidden">
              <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#2C2E33] transition-colors"
                onClick={() => toggleStage(stageIdx)}
              >
                <div>
                  <h3 className="font-medium">Stage {stageIdx + 1}: {stage.name}</h3>
                  <p className="text-xs text-[#4A5568] mt-1">
                    {stageDels.length} deliverable{stageDels.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    addDeliverable(stageIdx);
                  }}
                  size="sm"
                  className="bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Deliverable
                </Button>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {stageDels.map((del, delIdx) => {
                    const delTasks = tasks[`stage_${stageIdx}_del_${delIdx}`] || [];
                    
                    return (
                      <div key={delIdx} className="neumorphic-raised rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-7 h-7 rounded bg-[#2C2E33] flex items-center justify-center text-xs font-medium text-[#A0AEC0]">
                            D{delIdx + 1}
                          </div>
                          <div className="flex-1 space-y-3">
                            <Input
                              value={del.name}
                              onChange={(e) => updateDeliverable(stageIdx, delIdx, 'name', e.target.value)}
                              placeholder="Deliverable name (e.g., Proposal Document)"
                              className="bg-[#1A1B1E] border-[#2C2E33]"
                            />
                            <Textarea
                              value={del.description}
                              onChange={(e) => updateDeliverable(stageIdx, delIdx, 'description', e.target.value)}
                              placeholder="Description..."
                              className="bg-[#1A1B1E] border-[#2C2E33] h-16"
                            />
                            <Select 
                              value={del.output_type || 'document'} 
                              onValueChange={(v) => updateDeliverable(stageIdx, delIdx, 'output_type', v)}
                            >
                              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#2C2E33]">
                                <SelectItem value="document">Document</SelectItem>
                                <SelectItem value="meeting">Meeting</SelectItem>
                                <SelectItem value="approval">Approval</SelectItem>
                                <SelectItem value="report">Report</SelectItem>
                                <SelectItem value="form">Form</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button
                            onClick={() => removeDeliverable(stageIdx, delIdx)}
                            className="p-2 rounded-lg hover:bg-[#3a3d44] text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Tasks for this deliverable */}
                        <div className="ml-10 mt-4 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-[#A0AEC0]">Tasks ({delTasks.length})</p>
                            <button
                              onClick={() => addTask(stageIdx, delIdx)}
                              className="text-xs text-[#00E5FF] hover:text-[#00E5FF]/80 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Task
                            </button>
                          </div>

                          {delTasks.map((task, taskIdx) => (
                            <div key={taskIdx} className="bg-[#1A1B1E] rounded-lg p-3 flex items-start gap-3">
                              <div className="w-6 h-6 rounded bg-[#2C2E33] flex items-center justify-center text-xs">
                                {taskIdx + 1}
                              </div>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={task.name}
                                  onChange={(e) => updateTask(stageIdx, delIdx, taskIdx, 'name', e.target.value)}
                                  placeholder="Task name"
                                  className="bg-[#121212] border-[#2C2E33] text-sm h-8"
                                />
                                <Input
                                  value={task.description}
                                  onChange={(e) => updateTask(stageIdx, delIdx, taskIdx, 'description', e.target.value)}
                                  placeholder="Brief description..."
                                  className="bg-[#121212] border-[#2C2E33] text-xs h-7"
                                />
                              </div>
                              <button
                                onClick={() => removeTask(stageIdx, delIdx, taskIdx)}
                                className="p-1.5 rounded hover:bg-[#2C2E33] text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {delTasks.length === 0 && (
                            <p className="text-xs text-[#4A5568] text-center py-3">No tasks yet</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {stageDels.length === 0 && (
                    <p className="text-sm text-[#4A5568] text-center py-6">No deliverables yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}