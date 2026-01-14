import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Video, CheckSquare, FileSpreadsheet, X, Sparkles } from 'lucide-react';

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
    meeting_config: {},
    data_mapping: {}
  });

  const { data: documentTemplates = [] } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => base44.entities.DocumentTemplate.filter({ is_active: true }),
  });

  const OutputIcon = outputTypeIcons[formData.output_type] || FileText;

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

            {formData.document_template_ids?.[0] && (
              <div className="neumorphic-pressed rounded-lg p-3 border-l-2 border-[#00E5FF]">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-[#00E5FF] mt-0.5" />
                  <div>
                    <p className="text-sm text-[#F5F5F5] font-medium">AI Document Generation Enabled</p>
                    <p className="text-xs text-[#A0AEC0] mt-1">
                      When all tasks are completed, the AI will automatically generate this document using the collected workflow data and the template's generation settings.
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