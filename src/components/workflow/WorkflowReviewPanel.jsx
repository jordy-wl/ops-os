import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function WorkflowReviewPanel({ formData, stages, deliverables, tasks }) {
  const totalDeliverables = Object.values(deliverables).reduce((sum, dels) => sum + dels.length, 0);
  const totalTasks = Object.values(tasks).reduce((sum, taskList) => sum + taskList.length, 0);

  const tasksWithOutcomes = Object.values(tasks)
    .flat()
    .filter(t => t.outcomes && t.outcomes.length > 0).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Review & Create</h2>
        <p className="text-sm text-[#A0AEC0] mt-1">Review your workflow template before creating</p>
      </div>
      
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="neumorphic-pressed rounded-xl p-6">
          <h3 className="font-semibold text-lg mb-2">{formData.name}</h3>
          <p className="text-sm text-[#A0AEC0] mb-4">{formData.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-[#4A5568]">
            <span className="capitalize">Type: {formData.type}</span>
            <span>•</span>
            <span className="capitalize">Category: {formData.category}</span>
            <span>•</span>
            <span>{stages.length} stage{stages.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{totalDeliverables} deliverable{totalDeliverables !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="neumorphic-raised rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-xs text-[#A0AEC0]">Tasks with Logic</p>
            </div>
            <p className="text-2xl font-semibold">{tasksWithOutcomes}</p>
          </div>
          
          <div className="neumorphic-raised rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-[#A0AEC0]">Linear Tasks</p>
            </div>
            <p className="text-2xl font-semibold">{totalTasks - tasksWithOutcomes}</p>
          </div>

          <div className="neumorphic-raised rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-[#00E5FF]" />
              <p className="text-xs text-[#A0AEC0]">Total Outcomes</p>
            </div>
            <p className="text-2xl font-semibold">
              {Object.values(tasks).flat().reduce((sum, t) => sum + (t.outcomes?.length || 0), 0)}
            </p>
          </div>
        </div>

        {/* Detailed Structure */}
        <div className="space-y-3">
          {stages.map((stage, stageIdx) => {
            const stageDels = deliverables[`stage_${stageIdx}`] || [];
            return (
              <div key={stageIdx} className="neumorphic-raised rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/20 flex items-center justify-center text-sm font-medium text-[#00E5FF]">
                    {stageIdx + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{stage.name}</h4>
                    <p className="text-xs text-[#4A5568]">{stage.description}</p>
                  </div>
                </div>

                <div className="ml-11 space-y-3">
                  {stageDels.map((del, delIdx) => {
                    const delTasks = tasks[`stage_${stageIdx}_del_${delIdx}`] || [];
                    return (
                      <div key={delIdx} className="bg-[#1A1B1E] rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-[#2C2E33] flex items-center justify-center text-xs text-[#A0AEC0]">
                            D{delIdx + 1}
                          </div>
                          <p className="text-sm font-medium">{del.name}</p>
                          <span className="text-xs text-[#4A5568] capitalize">({del.output_type})</span>
                        </div>
                        
                        <div className="ml-8 space-y-1.5">
                          {delTasks.map((task, taskIdx) => (
                            <div key={taskIdx} className="flex items-start gap-2 text-xs">
                              <span className="text-[#4A5568]">{taskIdx + 1}.</span>
                              <div className="flex-1">
                                <p className="text-[#F5F5F5]">{task.name}</p>
                                {task.outcomes && task.outcomes.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {task.outcomes.map((outcome, oi) => (
                                      <p key={oi} className="text-[#00E5FF] text-xs">
                                        → "{outcome.outcome_name}" → {outcome.action.replace(/_/g, ' ')}
                                        {outcome.target_id && ` (${outcome.target_id})`}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}