import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function WorkflowStructurePanel({ stages, onUpdateStages }) {
  const addStage = () => {
    onUpdateStages([...stages, { name: '', description: '' }]);
  };

  const removeStage = (index) => {
    onUpdateStages(stages.filter((_, i) => i !== index));
  };

  const updateStage = (index, field, value) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };
    onUpdateStages(newStages);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Define Stages</h2>
          <p className="text-sm text-[#A0AEC0] mt-1">Create the high-level phases of your workflow</p>
        </div>
        <Button onClick={addStage} className="bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30">
          <Plus className="w-4 h-4 mr-2" />
          Add Stage
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <p className="text-[#A0AEC0] mb-4">No stages defined yet</p>
          <Button onClick={addStage} className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]">
            <Plus className="w-4 h-4 mr-2" />
            Add First Stage
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {stages.map((stage, idx) => (
            <div key={idx} className="neumorphic-pressed rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[#4A5568] cursor-move" />
                  <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/20 flex items-center justify-center text-sm font-medium text-[#00E5FF]">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <Input
                    value={stage.name}
                    onChange={(e) => updateStage(idx, 'name', e.target.value)}
                    placeholder="Stage name (e.g., Discovery)"
                    className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
                  />
                  <Textarea
                    value={stage.description}
                    onChange={(e) => updateStage(idx, 'description', e.target.value)}
                    placeholder="Describe this stage..."
                    className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] h-20"
                  />
                </div>
                <button
                  onClick={() => removeStage(idx)}
                  className="p-2 rounded-lg hover:bg-[#2C2E33] text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}