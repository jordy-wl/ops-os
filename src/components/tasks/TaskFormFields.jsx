import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function TaskFormFields({ taskTemplateId, initialValues = {}, onChange }) {
  const [fieldValues, setFieldValues] = useState(initialValues);

  const { data: taskTemplate } = useQuery({
    queryKey: ['task-template', taskTemplateId],
    queryFn: () => base44.entities.TaskTemplate.filter({ id: taskTemplateId }),
    enabled: !!taskTemplateId,
    select: (data) => data[0],
  });

  const dataFieldDefinitions = taskTemplate?.data_field_definitions || [];

  useEffect(() => {
    if (onChange) {
      onChange(fieldValues);
    }
  }, [fieldValues, onChange]);

  const handleFieldChange = (fieldCode, value) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldCode]: value
    }));
  };

  const renderField = (fieldDef) => {
    const { field_code, field_name, field_type, is_required, options, description } = fieldDef;
    const value = fieldValues[field_code] || '';

    switch (field_type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'multiline_text':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            rows={4}
          />
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field_code, parseFloat(e.target.value) || 0)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field_code}
              checked={value === true}
              onCheckedChange={(checked) => handleFieldChange(field_code, checked)}
              className="border-[#2C2E33] data-[state=checked]:bg-[#00E5FF]"
            />
            <Label htmlFor={field_code} className="text-sm text-[#A0AEC0]">
              {description || field_name}
            </Label>
          </div>
        );

      case 'single_select':
        return (
          <Select
            value={value}
            onValueChange={(v) => handleFieldChange(field_code, v)}
          >
            <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
              <SelectValue placeholder={`Select ${field_name}`} />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              {options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {options?.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field_code}-${opt}`}
                  checked={Array.isArray(value) && value.includes(opt)}
                  onCheckedChange={(checked) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = checked
                      ? [...currentValues, opt]
                      : currentValues.filter(v => v !== opt);
                    handleFieldChange(field_code, newValues);
                  }}
                  className="border-[#2C2E33] data-[state=checked]:bg-[#00E5FF]"
                />
                <Label htmlFor={`${field_code}-${opt}`} className="text-sm text-[#A0AEC0]">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field_code, e.target.value)}
            placeholder={description || `Enter ${field_name}`}
            className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
          />
        );
    }
  };

  if (dataFieldDefinitions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#A0AEC0] text-sm">No fields to complete for this task.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dataFieldDefinitions.map((fieldDef) => (
        <div key={fieldDef.field_code}>
          <Label className="block text-sm font-medium text-[#A0AEC0] mb-2">
            {fieldDef.field_name}
            {fieldDef.is_required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {fieldDef.description && fieldDef.field_type !== 'boolean' && (
            <p className="text-xs text-[#4A5568] mb-2">{fieldDef.description}</p>
          )}
          {renderField(fieldDef)}
        </div>
      ))}
    </div>
  );
}