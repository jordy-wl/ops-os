import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, GripVertical, Plus, X } from 'lucide-react';

export default function SectionEditor({ section, onUpdate, onDelete }) {
  const [dataRefInput, setDataRefInput] = useState({ entity: '', fields: '', prompt: '' });

  const addDataReference = () => {
    if (!dataRefInput.entity || !dataRefInput.fields) return;
    
    const newRef = {
      entity_type: dataRefInput.entity,
      field_paths: dataRefInput.fields.split(',').map(f => f.trim()),
      usage_prompt: dataRefInput.prompt
    };
    
    onUpdate({
      ...section,
      data_references: [...(section.data_references || []), newRef]
    });
    
    setDataRefInput({ entity: '', fields: '', prompt: '' });
  };

  const removeDataReference = (index) => {
    const updated = section.data_references.filter((_, i) => i !== index);
    onUpdate({ ...section, data_references: updated });
  };

  return (
    <Card className="bg-[#1A1B1E] border-[#2C2E33]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3 flex-1">
          <GripVertical className="w-5 h-5 text-[#4A5568] cursor-move" />
          <CardTitle className="text-base text-[#F5F5F5]">
            {section.type === 'text' && '📄'}
            {section.type === 'chart' && '📊'}
            {section.type === 'table' && '📋'}
            {section.type === 'glossary' && '📖'}
            {section.type === 'appendix' && '📎'}
            {' '}{section.title || 'Untitled Section'}
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Section Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#A0AEC0] mb-1">Section Title</label>
            <Input
              value={section.title || ''}
              onChange={(e) => onUpdate({ ...section, title: e.target.value })}
              placeholder="e.g., Executive Summary"
              className="bg-[#121212] border-[#2C2E33] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#A0AEC0] mb-1">Section Type</label>
            <Select
              value={section.type}
              onValueChange={(value) => onUpdate({ ...section, type: value })}
            >
              <SelectTrigger className="bg-[#121212] border-[#2C2E33] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Content</SelectItem>
                <SelectItem value="chart">Chart/Visualization</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="glossary">Glossary</SelectItem>
                <SelectItem value="appendix">Appendix</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* AI Prompt */}
        <div>
          <label className="block text-xs font-medium text-[#A0AEC0] mb-1">AI Generation Prompt</label>
          <Textarea
            value={section.ai_prompt || ''}
            onChange={(e) => onUpdate({ ...section, ai_prompt: e.target.value })}
            placeholder="Describe what the AI should generate for this section..."
            className="bg-[#121212] border-[#2C2E33] text-sm min-h-[80px]"
          />
        </div>

        {/* Chart Configuration (if type is chart) */}
        {section.type === 'chart' && (
          <div className="space-y-3 p-3 bg-[#121212] rounded-lg border border-[#2C2E33]">
            <h4 className="text-xs font-medium text-[#00E5FF]">Chart Configuration</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A0AEC0] mb-1">Chart Type</label>
                <Select
                  value={section.chart_type || 'bar'}
                  onValueChange={(value) => onUpdate({ ...section, chart_type: value })}
                >
                  <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                    <SelectItem value="scatter">Scatter Plot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Data References */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#A0AEC0]">Data References</label>
          
          {/* Existing References */}
          {section.data_references?.length > 0 && (
            <div className="space-y-2">
              {section.data_references.map((ref, index) => (
                <div key={index} className="flex items-center gap-2 text-xs bg-[#121212] p-2 rounded border border-[#2C2E33]">
                  <div className="flex-1">
                    <span className="text-[#00E5FF]">{ref.entity_type}</span>
                    <span className="text-[#4A5568]"> → </span>
                    <span className="text-[#A0AEC0]">{ref.field_paths?.join(', ')}</span>
                    {ref.usage_prompt && (
                      <p className="text-[#4A5568] mt-1">{ref.usage_prompt}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDataReference(index)}
                    className="h-6 w-6 text-red-400 hover:text-red-300"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Reference */}
          <div className="grid grid-cols-3 gap-2">
            <Input
              value={dataRefInput.entity}
              onChange={(e) => setDataRefInput({ ...dataRefInput, entity: e.target.value })}
              placeholder="Entity (e.g., Client)"
              className="bg-[#121212] border-[#2C2E33] text-xs"
            />
            <Input
              value={dataRefInput.fields}
              onChange={(e) => setDataRefInput({ ...dataRefInput, fields: e.target.value })}
              placeholder="Fields (comma-separated)"
              className="bg-[#121212] border-[#2C2E33] text-xs"
            />
            <Input
              value={dataRefInput.prompt}
              onChange={(e) => setDataRefInput({ ...dataRefInput, prompt: e.target.value })}
              placeholder="Usage instructions"
              className="bg-[#121212] border-[#2C2E33] text-xs"
            />
          </div>
          <Button
            onClick={addDataReference}
            variant="outline"
            size="sm"
            className="w-full bg-[#121212] border-[#2C2E33] text-[#00E5FF] hover:bg-[#2C2E33]"
          >
            <Plus className="w-3 h-3 mr-2" />
            Add Data Reference
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}