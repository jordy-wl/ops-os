import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CreateFormTemplateModal from '@/components/forms/CreateFormTemplateModal';
import { ClipboardList, Plus, Search, Edit, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

function FormTemplateCard({ template, onEdit }) {
  return (
    <div 
      onClick={onEdit}
      className="neumorphic-raised rounded-xl p-5 group cursor-pointer transition-all duration-200 hover:translate-y-[-2px]"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate mb-1">{template.name}</h3>
          <p className="text-xs text-[#A0AEC0]">Form Template</p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-2 rounded-lg hover:bg-[#3a3d44] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit className="w-4 h-4 text-[#A0AEC0]" />
        </button>
      </div>

      <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-4">
        {template.description || 'No description'}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-[#4A5568]">
          <span>{template.form_schema?.length || 0} fields</span>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${
          template.is_active 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-500/20 text-gray-400'
        }`}>
          {template.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

export default function FormTemplates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['form-templates'],
    queryFn: () => base44.entities.FormTemplate.list('-created_date', 50),
  });

  const filteredTemplates = templates.filter(t => 
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Form Templates</h1>
          <p className="text-[#A0AEC0]">{templates.length} form templates</p>
        </div>
        
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Form Template
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#A0AEC0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search form templates..."
            className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">No Form Templates Found</h3>
          <p className="text-[#A0AEC0] mb-4">
            {searchQuery ? 'Try a different search term.' : 'Create your first form template to collect data from clients.'}
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
            >
              Create Form Template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <FormTemplateCard 
              key={template.id} 
              template={template} 
              onEdit={() => setEditingTemplate(template)}
            />
          ))}
        </div>
      )}

      <CreateFormTemplateModal 
        isOpen={showCreateModal || !!editingTemplate} 
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />
    </div>
  );
}