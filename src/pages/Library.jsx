import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CreateTemplateModal from '@/components/library/CreateTemplateModal';
import {
  BookOpen,
  FileText,
  File,
  Image,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Link as LinkIcon
} from 'lucide-react';

const categoryIcons = {
  proposal: FileText,
  contract: File,
  welcome_pack: BookOpen,
  compliance: File,
  onboarding: BookOpen,
  report: FileText,
  other: File,
};

const categoryColors = {
  proposal: 'from-blue-500 to-blue-600',
  contract: 'from-purple-500 to-purple-600',
  welcome_pack: 'from-green-500 to-green-600',
  compliance: 'from-orange-500 to-orange-600',
  onboarding: 'from-cyan-500 to-cyan-600',
  report: 'from-pink-500 to-pink-600',
  other: 'from-gray-500 to-gray-600',
};

function TemplateCard({ template, onEdit }) {
  const Icon = categoryIcons[template.category] || File;
  const colorClass = categoryColors[template.category] || categoryColors.other;
  
  return (
    <div 
      onClick={onEdit}
      className="neumorphic-raised rounded-xl p-5 group cursor-pointer transition-all duration-200 hover:translate-y-[-2px]"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate mb-1">{template.name}</h3>
          <p className="text-xs text-[#A0AEC0] capitalize">{template.category?.replace('_', ' ') || 'Other'}</p>
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
          <span>v{template.version || 1}</span>
          <span>•</span>
          <span className="capitalize">{template.output_format || 'Markdown'}</span>
        </div>
        {template.placeholder_schema?.length > 0 && (
          <span className="text-xs text-[#00E5FF] flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            {template.placeholder_schema.length} fields
          </span>
        )}
      </div>
    </div>
  );
}

export default function Library() {
  const [activeTab, setActiveTab] = useState('documents'); // documents, sops, assets
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => base44.entities.DocumentTemplate.list('-created_date', 50),
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'proposal', 'contract', 'welcome_pack', 'compliance', 'onboarding', 'report', 'other'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Library</h1>
          <p className="text-[#A0AEC0]">{templates.length} templates and assets</p>
        </div>
        
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm hover:shadow-lg hover:shadow-[#00E5FF]/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="neumorphic-pressed rounded-lg p-1 flex">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'documents' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('sops')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'sops' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            SOPs
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'assets' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Image className="w-4 h-4 inline mr-2" />
            Assets
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#A0AEC0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
          />
        </div>
      </div>

      {/* Category Filter */}
      {activeTab === 'documents' && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30'
                  : 'bg-[#2C2E33] text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              {cat === 'all' ? 'All' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'documents' && (
        templatesLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Templates Found</h3>
            <p className="text-[#A0AEC0] mb-4">
              {searchQuery ? 'Try a different search term.' : 'Create your first document template.'}
            </p>
            {!searchQuery && (
              <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm">
                Create Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onEdit={() => setEditingTemplate(template)}
              />
            ))}
          </div>
        )
      )}

      <CreateTemplateModal 
        isOpen={showCreateModal || !!editingTemplate} 
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />

      {activeTab === 'sops' && (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Standard Operating Procedures</h3>
          <p className="text-[#A0AEC0] mb-4">Create SOPs to guide task execution.</p>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm">
            Create SOP
          </button>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <Image className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Media Assets</h3>
          <p className="text-[#A0AEC0] mb-4">Upload logos, images, and other assets.</p>
          <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm">
            Upload Asset
          </button>
        </div>
      )}
    </div>
  );
}