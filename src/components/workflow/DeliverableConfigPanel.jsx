import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Video, CheckSquare, FileSpreadsheet, X, Sparkles, Database } from 'lucide-react';

const outputTypeIcons = {
  document: FileText,
  meeting: Video,
  approval: CheckSquare,
  report: FileSpreadsheet,
  form: FileText,
  contract: FileText,
  other: FileText
};

export default function DeliverableConfigPanel({ deliverable, onSave, onClose }) {
  const [formData, setFormData] = useState(deliverable || {
    name: '',
    description: '',
    output_type: 'document',
    is_required: true,
    estimated_duration_hours: 0,
    document_template_ids: [],
    auto_generate_ai_document: true,
    meeting_config: {},
    data_mapping: {},
    trigger_entity_update_enabled: false,
    target_entity_name: 'Deal',
    critical_fields: []
  });

  const [availableFields, setAvailableFields] = useState([]);

  const { data: documentTemplates = [] } = useQuery({
    queryKey: ['document-templates-user'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.DocumentTemplate.filter({ is_active: true, created_by: user.email });
    },
  });

  // Get the selected template to check if it has AI instructions
  const selectedTemplate = documentTemplates.find(t => t.id === formData.document_template_ids?.[0]);
  const isAITemplate = selectedTemplate?.ai_prompt_instructions;

  const OutputIcon = outputTypeIcons[formData.output_type] || FileText;

  // Fetch entity schema when target entity changes
  useEffect(() => {
    if (formData.trigger_entity_update_enabled && formData.target_entity_name) {
      fetchEntityFields(formData.target_entity_name);
    }
  }, [formData.trigger_entity_update_enabled, formData.target_entity_name]);

  const fetchEntityFields = async (entityName) => {
    try {
      const schema = await base44.entities[entityName].schema();
      const fields = Object.keys(schema.properties || {});
      setAvailableFields(fields);
    } catch (error) {
      console.error('Failed to fetch entity schema:', error);
      setAvailableFields([]);
    }
  };

  const toggleCriticalField = (fieldName) => {
    const current = formData.critical_fields || [];
    const updated = current.includes(fieldName)
      ? current.filter(f => f !== fieldName)
      : [...current, fieldName];
    setFormData({ ...formData, critical_fields: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Configure Deliverable</h3>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
            Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Requirements Document"
            className={`bg-[#1A1B1E] border-[#2C2E33] ${!formData.name ? 'border-red-400/50' : ''}`}
          />
          {!formData.name && (
            <p className="text-xs text-red-400 mt-1">Deliverable name is required</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this deliverable?"
            className="bg-[#1A1B1E] border-[#2C2E33] h-20"
          />
        </div>

        {/* Output Type */}
        <div>
          <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
            Output Type <span className="text-red-400">*</span>
          </label>
          <Select 
            value={formData.output_type} 
            onValueChange={(v) => setFormData({ ...formData, output_type: v })}
          >
            <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              <SelectItem value="document">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Document
                </div>
              </SelectItem>
              <SelectItem value="meeting">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Meeting
                </div>
              </SelectItem>
              <SelectItem value="approval">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Approval
                </div>
              </SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="form">Form</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Document Template Selection (if output type is document) */}
        {formData.output_type === 'document' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                Document Template
              </label>
              <Select 
                value={formData.document_template_ids?.[0] || ''} 
                onValueChange={(v) => setFormData({ 
                  ...formData, 
                  document_template_ids: v ? [v] : [],
                  auto_generate_ai_document: v ? true : false
                })}
              >
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  {documentTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.ai_prompt_instructions && (
                        <span className="ml-2 text-xs text-[#BD00FF]">✨ AI</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.document_template_ids?.[0] && isAITemplate && (
              <div className="neumorphic-pressed rounded-lg p-3 border-l-2 border-[#BD00FF]">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#BD00FF] mt-0.5" />
                  <div>
                    <p className="text-sm text-[#BD00FF] font-medium">AI Document Generation Active</p>
                    <p className="text-xs text-[#A0AEC0] mt-1">
                      When tasks are completed, AI will automatically generate this document using workflow data and your template's prompt.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {formData.document_template_ids?.[0] && !isAITemplate && (
              <div className="neumorphic-pressed rounded-lg p-3 border-l-2 border-[#4A5568]">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
                  <div>
                    <p className="text-sm text-[#A0AEC0] font-medium">Standard Template</p>
                    <p className="text-xs text-[#4A5568] mt-1">
                      This template doesn't have AI generation configured. Add an AI prompt to the template for automatic generation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meeting Config (if output type is meeting) */}
        {formData.output_type === 'meeting' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Meeting Link</label>
              <Input
                value={formData.meeting_config?.link || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  meeting_config: { ...formData.meeting_config, link: e.target.value } 
                })}
                placeholder="https://zoom.us/..."
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Duration (minutes)</label>
              <Input
                type="number"
                value={formData.meeting_config?.duration_minutes || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  meeting_config: { ...formData.meeting_config, duration_minutes: parseInt(e.target.value) } 
                })}
                placeholder="60"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
          </div>
        )}

        {/* Estimated Duration */}
        <div>
          <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Estimated Duration (hours)</label>
          <Input
            type="number"
            value={formData.estimated_duration_hours}
            onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseFloat(e.target.value) })}
            className="bg-[#1A1B1E] border-[#2C2E33]"
          />
        </div>

        {/* Required Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.is_required}
            onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
            className="w-4 h-4"
          />
          <label className="text-sm text-[#A0AEC0]">Required deliverable</label>
        </div>

        {/* Entity Update Trigger Section */}
        <div className="border-t border-[#2C2E33] pt-6 mt-6">
          <div className="flex items-start gap-3 mb-4">
            <Database className="w-5 h-5 text-[#00E5FF] mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-1">Entity Update Trigger</h4>
              <p className="text-xs text-[#4A5568]">
                Automatically create or update an entity record when this deliverable completes
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A1B1E] border border-[#2C2E33]">
              <label className="text-sm text-[#A0AEC0]">Enable entity update on completion</label>
              <Switch
                checked={formData.trigger_entity_update_enabled}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  trigger_entity_update_enabled: checked,
                  critical_fields: checked ? formData.critical_fields : []
                })}
              />
            </div>

            {/* Target Entity Selection */}
            {formData.trigger_entity_update_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                    Target Entity <span className="text-red-400">*</span>
                  </label>
                  <Select 
                    value={formData.target_entity_name} 
                    onValueChange={(v) => setFormData({ ...formData, target_entity_name: v, critical_fields: [] })}
                  >
                    <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                      <SelectItem value="Deal">Deal</SelectItem>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Contact">Contact</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[#4A5568] mt-1">
                    Which entity should be created/updated with task data
                  </p>
                </div>

                {/* Critical Fields Selection */}
                <div>
                  <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
                    Critical Fields
                  </label>
                  <div className="neumorphic-pressed rounded-lg p-4 max-h-64 overflow-y-auto">
                    {availableFields.length === 0 ? (
                      <p className="text-xs text-[#4A5568] text-center py-4">
                        Loading fields...
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableFields.map((field) => (
                          <div 
                            key={field}
                            className="flex items-center gap-2 p-2 rounded hover:bg-[#2C2E33] cursor-pointer"
                            onClick={() => toggleCriticalField(field)}
                          >
                            <Checkbox 
                              checked={formData.critical_fields?.includes(field)}
                              onCheckedChange={() => toggleCriticalField(field)}
                            />
                            <label className="text-sm text-[#F5F5F5] cursor-pointer flex-1">
                              {field}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#4A5568] mt-2">
                    Select fields that must be populated for the entity to be considered complete. 
                    Missing critical fields will be tracked in the entity's <code className="text-[#00E5FF]">missing_data_fields</code> array.
                  </p>
                </div>

                {/* Info Banner */}
                <div className="neumorphic-pressed rounded-lg p-3 border-l-2 border-[#00E5FF]">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#00E5FF] mt-0.5" />
                    <div>
                      <p className="text-sm text-[#00E5FF] font-medium">Auto-Update Active</p>
                      <p className="text-xs text-[#A0AEC0] mt-1">
                        When tasks within this deliverable are completed, their data will automatically populate the {formData.target_entity_name} entity.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
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
          Save Deliverable
        </Button>
      </div>
    </div>
  );
}