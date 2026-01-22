import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Database } from 'lucide-react';
import MultiSelectField from './MultiSelectField';

export default function ChartTableConfig({ 
  section, 
  updateSection, 
  getFieldOptionsForEntity,
  workflowTemplates,
  products,
  services
}) {
  const isChart = section.type === 'chart';
  const dataSource = isChart ? section.chart_data_source : section.table_data_source;
  const dataSources = dataSource?.sources || [];

  const updateDataSources = (sources) => {
    const field = isChart ? 'chart_data_source' : 'table_data_source';
    updateSection(field, { ...dataSource, sources });
  };

  const addDataSource = () => {
    const newSource = {
      id: `source_${Date.now()}`,
      entity_type: 'Client',
      field_paths: [],
      entity_id: null,
      aggregation: 'none',
      label: ''
    };
    updateDataSources([...dataSources, newSource]);
  };

  const updateDataSource = (index, field, value) => {
    const updated = [...dataSources];
    updated[index] = { ...updated[index], [field]: value };
    updateDataSources(updated);
  };

  const removeDataSource = (index) => {
    const updated = [...dataSources];
    updated.splice(index, 1);
    updateDataSources(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#00E5FF]">Data Sources</label>
        <button
          onClick={addDataSource}
          className="text-xs text-[#00E5FF] hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Source
        </button>
      </div>

      {dataSources.length === 0 ? (
        <div className="neumorphic-pressed p-4 rounded-lg text-center">
          <Database className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
          <p className="text-xs text-[#A0AEC0]">No data sources configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dataSources.map((source, idx) => (
            <div key={source.id} className="bg-[#1A1B1E] rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={source.label || ''}
                  onChange={(e) => updateDataSource(idx, 'label', e.target.value)}
                  placeholder="Label (e.g., Revenue)"
                  className="flex-1 bg-[#2C2E33] border-[#3a3d44] text-xs h-7"
                />
                <button
                  onClick={() => removeDataSource(idx)}
                  className="p-1 hover:bg-[#3a3d44] rounded"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select 
                  value={source.entity_type} 
                  onValueChange={(v) => updateDataSource(idx, 'entity_type', v)}
                >
                  <SelectTrigger className="bg-[#2C2E33] border-[#3a3d44] text-xs h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Workflow">Workflow</SelectItem>
                    <SelectItem value="Product">Product</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={source.aggregation || 'none'} 
                  onValueChange={(v) => updateDataSource(idx, 'aggregation', v)}
                >
                  <SelectTrigger className="bg-[#2C2E33] border-[#3a3d44] text-xs h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                    <SelectItem value="none">No Aggregation</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="max">Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {source.entity_type !== 'Client' && (
                <Select 
                  value={source.entity_id || ''} 
                  onValueChange={(v) => updateDataSource(idx, 'entity_id', v)}
                >
                  <SelectTrigger className="bg-[#2C2E33] border-[#3a3d44] text-xs h-7">
                    <SelectValue placeholder={`Select ${source.entity_type.toLowerCase()}...`} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                    {source.entity_type === 'Workflow' && workflowTemplates.map(wf => (
                      <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                    ))}
                    {source.entity_type === 'Product' && products.map(prod => (
                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                    ))}
                    {source.entity_type === 'Service' && services.map(serv => (
                      <SelectItem key={serv.id} value={serv.id}>{serv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <MultiSelectField
                options={getFieldOptionsForEntity(source.entity_type)}
                value={source.field_paths || []}
                onChange={(v) => updateDataSource(idx, 'field_paths', v)}
                placeholder="Select fields..."
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}