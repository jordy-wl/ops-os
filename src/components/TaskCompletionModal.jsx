import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function TaskCompletionModal({ task, onClose, onSuccess }) {
  const [fieldValues, setFieldValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: fieldMappings = [] } = useQuery({
    queryKey: ['task-fields', task?.task_template_id],
    queryFn: async () => {
      if (!task?.task_template_id) return [];
      const mappings = await base44.entities.TaskFieldMapping.filter({
        task_template_id: task.task_template_id
      }, 'sequence_order');

      const enriched = [];
      for (const mapping of mappings) {
        const fieldDefs = await base44.entities.FieldDefinition.filter({
          id: mapping.field_definition_id
        });
        if (fieldDefs.length > 0) {
          enriched.push({
            ...mapping,
            field_definition: fieldDefs[0]
          });
        }
      }
      return enriched;
    },
    enabled: !!task?.task_template_id
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await base44.functions.invoke('completeTask', {
        task_instance_id: task.id,
        field_values: fieldValues
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldInput = (mapping) => {
    const fieldDef = mapping.field_definition;
    const fieldCode = fieldDef.code;

    switch (fieldDef.data_type) {
      case 'text':
        return (
          <Textarea
            key={fieldCode}
            value={fieldValues[fieldCode] || ''}
            onChange={(e) => setFieldValues({ ...fieldValues, [fieldCode]: e.target.value })}
            placeholder={mapping.ui_prompt || `Enter ${fieldDef.name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            key={fieldCode}
            type="number"
            value={fieldValues[fieldCode] || ''}
            onChange={(e) => setFieldValues({ ...fieldValues, [fieldCode]: parseFloat(e.target.value) })}
            placeholder={mapping.ui_prompt || `Enter ${fieldDef.name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'date':
        return (
          <Input
            key={fieldCode}
            type="date"
            value={fieldValues[fieldCode] || ''}
            onChange={(e) => setFieldValues({ ...fieldValues, [fieldCode]: e.target.value })}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'enum':
        return (
          <Select
            key={fieldCode}
            value={fieldValues[fieldCode] || ''}
            onValueChange={(v) => setFieldValues({ ...fieldValues, [fieldCode]: v })}
          >
            <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
              <SelectValue placeholder={`Select ${fieldDef.name}`} />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              {fieldDef.enum_values?.map((val) => (
                <SelectItem key={val} value={val}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            key={fieldCode}
            value={fieldValues[fieldCode] || ''}
            onChange={(e) => setFieldValues({ ...fieldValues, [fieldCode]: e.target.value })}
            placeholder={mapping.ui_prompt || `Enter ${fieldDef.name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );
    }
  };

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-2xl relative z-10 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Complete Task</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="mb-6 pb-4 border-b border-[#2C2E33]">
          <h3 className="font-medium text-lg mb-2">{task.name}</h3>
          {task.instructions && (
            <div className="neumorphic-pressed rounded-lg p-4 text-sm text-[#A0AEC0] mb-4">
              <p className="font-medium text-[#F5F5F5] mb-2">Instructions:</p>
              {task.instructions}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {fieldMappings.length > 0 ? (
            <div className="space-y-4 mb-6">
              {fieldMappings.map((mapping) => (
                <div key={mapping.field_definition_id}>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                    {mapping.field_definition.name}
                    {mapping.is_required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {renderFieldInput(mapping)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#A0AEC0] text-sm mb-6">No fields to collect for this task.</p>
          )}

          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete Task'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}