import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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
  Link as LinkIcon,
  ClipboardList,
  Lightbulb,
  Filter,
  Palette,
  Trash
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('documents'); // documents, forms, sops, assets, knowledge, brandkits
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showBrandKitModal, setShowBrandKitModal] = useState(false);
  const [editingBrandKit, setEditingBrandKit] = useState(null);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => base44.entities.DocumentTemplate.list('-created_date', 50),
  });

  const { data: knowledgeAssets = [], isLoading: knowledgeLoading } = useQuery({
    queryKey: ['knowledge-assets'],
    queryFn: () => base44.entities.KnowledgeAsset.filter({ is_active: true }, '-created_date', 50)
  });

  const { data: documentInstances = [], isLoading: instancesLoading } = useQuery({
    queryKey: ['document-instances'],
    queryFn: () => base44.entities.DocumentInstance.list('-created_date', 100),
    enabled: activeTab === 'documents',
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 100),
    enabled: activeTab === 'documents',
  });

  const { data: brandKits = [], isLoading: brandKitsLoading } = useQuery({
    queryKey: ['brand-kits'],
    queryFn: () => base44.entities.BrandKit.list('-created_date', 50),
    enabled: activeTab === 'brandkits',
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredDocumentInstances = documentInstances.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClient = clientFilter === 'all' || d.client_id === clientFilter;
    return matchesSearch && matchesClient;
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
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'forms' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <ClipboardList className="w-4 h-4 inline mr-2" />
            Forms
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
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'knowledge' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Lightbulb className="w-4 h-4 inline mr-2" />
            Knowledge
          </button>
          <button
            onClick={() => setActiveTab('brandkits')}
            className={`px-4 py-2 rounded-md text-sm transition-all ${
              activeTab === 'brandkits' 
                ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
            }`}
          >
            <Palette className="w-4 h-4 inline mr-2" />
            Brand Kits
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

      {/* Filters */}
      {activeTab === 'documents' && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
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
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-56 bg-[#1A1B1E] border-[#2C2E33]">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {activeTab === 'documents' && (
        <div className="space-y-8">
          {/* Templates Section */}
          <div>
            <h3 className="text-sm font-semibold text-[#A0AEC0] mb-4">Document Templates</h3>
            {templatesLoading ? (
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
            )}
          </div>

          {/* Generated Documents Section */}
          <div>
            <h3 className="text-sm font-semibold text-[#A0AEC0] mb-4">Generated Documents</h3>
            {instancesLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3].map(i => (
                  <div key={i} className="h-32 bg-[#2C2E33] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredDocumentInstances.length === 0 ? (
              <div className="neumorphic-pressed rounded-xl p-8 text-center">
                <p className="text-[#A0AEC0] text-sm">No documents generated yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredDocumentInstances.map(doc => {
                  const client = clients.find(c => c.id === doc.client_id);
                  return (
                    <div key={doc.id} className="neumorphic-raised rounded-xl p-4 hover:translate-y-[-2px] transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <FileText className="w-5 h-5 text-[#00E5FF]" />
                        <span className="text-xs px-2 py-1 rounded bg-[#00E5FF]/20 text-[#00E5FF] capitalize">
                          {doc.status}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm mb-1 line-clamp-2">{doc.name}</h4>
                      {client && (
                        <p className="text-xs text-[#A0AEC0] mb-2">Client: {client.name}</p>
                      )}
                      <p className="text-xs text-[#4A5568]">
                        {new Date(doc.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <CreateTemplateModal 
        isOpen={showCreateModal || !!editingTemplate} 
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />

      {activeTab === 'forms' && (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Client-Facing Forms</h3>
          <p className="text-[#A0AEC0] mb-4">Create forms to collect data from clients automatically.</p>
          <button 
            onClick={() => navigate(createPageUrl('FormTemplates'))}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white font-medium text-sm"
          >
            Manage Forms
          </button>
        </div>
      )}

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

      {activeTab === 'knowledge' && (
        knowledgeLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : knowledgeAssets.length === 0 ? (
          <div className="neumorphic-pressed rounded-xl p-12 text-center">
            <Lightbulb className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Knowledge Assets</h3>
            <p className="text-[#A0AEC0] mb-4">Save conversations from Strategy to build your knowledge base.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {knowledgeAssets.map(asset => {
              const typeConfig = {
                sop: { label: 'SOP', color: 'from-blue-500 to-blue-600', icon: BookOpen },
                strategic_plan: { label: 'Strategic Plan', color: 'from-purple-500 to-purple-600', icon: Lightbulb },
                meeting_notes: { label: 'Meeting Notes', color: 'from-green-500 to-green-600', icon: FileText },
                decision_log: { label: 'Decision Log', color: 'from-orange-500 to-orange-600', icon: FileText },
                ai_strategy: { label: 'AI Strategy', color: 'from-pink-500 to-pink-600', icon: Lightbulb },
                best_practice: { label: 'Best Practice', color: 'from-cyan-500 to-cyan-600', icon: BookOpen },
                template: { label: 'Template', color: 'from-indigo-500 to-indigo-600', icon: FileText },
                other: { label: 'Other', color: 'from-gray-500 to-gray-600', icon: FileText }
              };
              const config = typeConfig[asset.type] || typeConfig.other;
              const Icon = config.icon;

              return (
                <div key={asset.id} className="neumorphic-raised rounded-xl p-5 cursor-pointer hover:translate-y-[-2px] transition-all duration-200">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1 truncate">{asset.title}</h3>
                      <p className="text-xs text-[#A0AEC0]">{config.label}</p>
                    </div>
                  </div>
                  {asset.ai_summary && (
                    <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">{asset.ai_summary}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {asset.tags?.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-full bg-[#2C2E33] text-xs text-[#A0AEC0]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'brandkits' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-[#A0AEC0]">Brand Kits</h3>
            <button 
              onClick={() => setShowBrandKitModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium text-sm hover:shadow-lg hover:shadow-[#00E5FF]/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Brand Kit
            </button>
          </div>

          {brandKitsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : brandKits.length === 0 ? (
            <div className="neumorphic-pressed rounded-xl p-12 text-center">
              <Palette className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Brand Kits</h3>
              <p className="text-[#A0AEC0] mb-4">Create a brand kit to apply consistent styling to your documents.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {brandKits.map(kit => (
                <BrandKitCard 
                  key={kit.id} 
                  kit={kit} 
                  onEdit={() => setEditingBrandKit(kit)}
                  queryClient={queryClient}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showBrandKitModal && (
        <BrandKitModal 
          isOpen={showBrandKitModal}
          onClose={() => {
            setShowBrandKitModal(false);
            setEditingBrandKit(null);
          }}
          brandKit={editingBrandKit}
        />
      )}
    </div>
  );
}

function BrandKitCard({ kit, onEdit, queryClient }) {
  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.BrandKit.delete(kit.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
    }
  });

  return (
    <div className="neumorphic-raised rounded-xl p-5 group relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          {kit.logo_url && (
            <img src={kit.logo_url} alt={kit.name} className="w-10 h-10 object-contain rounded" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{kit.name}</h3>
            {kit.is_default && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF]">Default</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-[#3a3d44]"
          >
            <Edit className="w-4 h-4 text-[#A0AEC0]" />
          </button>
          <button 
            onClick={() => deleteMutation.mutate()}
            className="p-1.5 rounded-lg hover:bg-red-500/20"
          >
            <Trash className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-4">
        {kit.description || 'No description'}
      </p>

      <div className="flex items-center gap-2">
        <div 
          className="w-6 h-6 rounded-full border-2 border-white/20" 
          style={{ backgroundColor: kit.primary_color }}
        />
        <div 
          className="w-6 h-6 rounded-full border-2 border-white/20" 
          style={{ backgroundColor: kit.secondary_color }}
        />
        <div 
          className="w-6 h-6 rounded-full border-2 border-white/20" 
          style={{ backgroundColor: kit.accent_color }}
        />
        <span className="text-xs text-[#4A5568] ml-auto">{kit.font_family?.split(',')[0]}</span>
      </div>
    </div>
  );
}

function BrandKitModal({ isOpen, onClose, brandKit }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(brandKit || {
    name: '',
    description: '',
    logo_url: '',
    primary_color: '#00E5FF',
    secondary_color: '#BD00FF',
    accent_color: '#F5F5F5',
    font_family: 'Inter, sans-serif',
    font_family_heading: 'Poppins, sans-serif',
    is_default: false
  });

  const mutation = useMutation({
    mutationFn: (data) => brandKit
      ? base44.entities.BrandKit.update(brandKit.id, data)
      : base44.entities.BrandKit.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      onClose();
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-2xl relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#00E5FF]" />
            {brandKit ? 'Edit' : 'Create'} Brand Kit
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Company Brand Kit"
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description..."
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Logo URL</label>
            <Input
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://..."
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Primary Color</label>
              <input
                type="color"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Secondary Color</label>
              <input
                type="color"
                value={formData.secondary_color}
                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Accent Color</label>
              <input
                type="color"
                value={formData.accent_color}
                onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Body Font</label>
              <Input
                value={formData.font_family}
                onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                placeholder="Inter, sans-serif"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Heading Font</label>
              <Input
                value={formData.font_family_heading}
                onChange={(e) => setFormData({ ...formData, font_family_heading: e.target.value })}
                placeholder="Poppins, sans-serif"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={() => mutation.mutate(formData)}
            disabled={!formData.name || mutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
          >
            {mutation.isPending ? 'Saving...' : brandKit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}