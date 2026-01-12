import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, Search, Filter, FileText, Lightbulb, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

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

function KnowledgeAssetCard({ asset, onView }) {
  const config = typeConfig[asset.type] || typeConfig.other;
  const Icon = config.icon;

  return (
    <div 
      onClick={() => onView(asset)}
      className="neumorphic-raised rounded-xl p-5 cursor-pointer hover:translate-y-[-2px] transition-all duration-200"
    >
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
        <p className="text-sm text-[#A0AEC0] line-clamp-2 mb-3">
          {asset.ai_summary}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {asset.tags?.slice(0, 3).map((tag, idx) => (
          <span key={idx} className="px-2 py-1 rounded-full bg-[#2C2E33] text-xs text-[#A0AEC0]">
            {tag}
          </span>
        ))}
        {asset.source && (
          <span className="ml-auto text-xs text-[#4A5568] capitalize">
            {asset.source.replace('_', ' ')}
          </span>
        )}
      </div>
    </div>
  );
}

function KnowledgeAssetViewer({ asset, onClose }) {
  if (!asset) return null;

  const config = typeConfig[asset.type] || typeConfig.other;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-4xl max-h-[90vh] relative z-10 shadow-2xl border border-white/10 flex flex-col">
        <div className="p-6 border-b border-[#2C2E33]">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center`}>
              <config.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{asset.title}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A0AEC0]">{config.label}</span>
                <span className="text-xs text-[#4A5568]">•</span>
                <span className="text-xs text-[#4A5568] capitalize">
                  {asset.source?.replace('_', ' ')}
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={onClose} className="border-[#2C2E33]">
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {asset.ai_summary && (
            <div className="neumorphic-pressed rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">AI Summary</h3>
              <p className="text-sm text-[#E0E0E0]">{asset.ai_summary}</p>
            </div>
          )}

          {asset.ai_insights && (
            <div className="neumorphic-pressed rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Key Insights</h3>
              <div className="text-sm text-[#E0E0E0] whitespace-pre-line">
                {asset.ai_insights}
              </div>
            </div>
          )}

          {asset.content && (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{asset.content}</ReactMarkdown>
            </div>
          )}

          {asset.tags && asset.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-full bg-[#2C2E33] text-sm text-[#A0AEC0]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewingAsset, setViewingAsset] = useState(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['knowledge-assets'],
    queryFn: () => base44.entities.KnowledgeAsset.filter({ is_active: true }, '-created_date', 50)
  });

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery || 
      asset.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Knowledge Library</h1>
          <p className="text-[#A0AEC0]">{assets.length} knowledge assets</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#A0AEC0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge assets..."
            className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="neumorphic-pressed rounded-lg px-4 py-2 bg-transparent text-sm focus:outline-none"
        >
          <option value="all">All Types</option>
          {Object.entries(typeConfig).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-[#2C2E33] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">No Knowledge Assets Found</h3>
          <p className="text-[#A0AEC0]">
            {searchQuery ? 'Try a different search term.' : 'Save conversations from Strategy to build your knowledge base.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredAssets.map(asset => (
            <KnowledgeAssetCard 
              key={asset.id} 
              asset={asset}
              onView={setViewingAsset}
            />
          ))}
        </div>
      )}

      <KnowledgeAssetViewer 
        asset={viewingAsset} 
        onClose={() => setViewingAsset(null)} 
      />
    </div>
  );
}