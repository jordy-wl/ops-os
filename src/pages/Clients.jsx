import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AIInsightCard from '@/components/AIInsightCard';
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Building2,
  Globe,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  X,
  Sparkles
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const lifecycleColors = {
  prospect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  qualified: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  proposal: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  onboarding: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  churned: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const sentimentColors = {
  positive: 'bg-green-500',
  neutral: 'bg-yellow-500',
  negative: 'bg-red-500',
};

function ClientRow({ client, onClick }) {
  return (
    <tr 
      onClick={onClick}
      className="hover:bg-[#2C2E33] cursor-pointer transition-colors border-b border-[#2C2E33]"
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2C2E33] to-[#1A1B1E] flex items-center justify-center">
            {client.logo_url ? (
              <img src={client.logo_url} alt="" className="w-8 h-8 rounded" />
            ) : (
              <Building2 className="w-5 h-5 text-[#A0AEC0]" />
            )}
          </div>
          <div>
            <p className="font-medium">{client.name}</p>
            <p className="text-xs text-[#4A5568] capitalize">{client.industry?.replace('_', ' ') || 'No industry'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className={`w-3 h-3 rounded-full ${sentimentColors[client.sentiment_score] || 'bg-[#4A5568]'}`} />
      </td>
      <td className="px-4 py-4">
        <span className={`px-2 py-1 rounded-full text-xs border ${lifecycleColors[client.lifecycle_stage] || lifecycleColors.prospect}`}>
          {client.lifecycle_stage?.replace('_', ' ') || 'Prospect'}
        </span>
      </td>
      <td className="px-4 py-4 text-[#A0AEC0]">
        {client.region || '—'}
      </td>
      <td className="px-4 py-4 font-mono text-sm">
        {client.value ? `$${client.value.toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-4 text-xs font-mono text-[#4A5568]">
        {client.updated_date ? new Date(client.updated_date).toLocaleDateString() : '—'}
      </td>
    </tr>
  );
}

function CreateClientModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    region: '',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
      setFormData({ name: '', industry: '', region: '' });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">New Client</h2>
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
              placeholder="Company name"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Industry</label>
            <Select value={formData.industry} onValueChange={(v) => setFormData({ ...formData, industry: v })}>
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                <SelectItem value="fintech">Fintech</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="professional_services">Professional Services</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Region</label>
            <Input
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              placeholder="e.g., North America"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
            Cancel
          </Button>
          <Button 
            onClick={() => createMutation.mutate(formData)}
            disabled={!formData.name || createMutation.isPending}
            className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowCreate = urlParams.get('action') === 'create';

  React.useEffect(() => {
    if (shouldShowCreate) {
      setShowCreateModal(true);
    }
  }, [shouldShowCreate]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 100),
  });

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Clients</h1>
          <p className="text-[#A0AEC0]">{clients.length} clients in registry</p>
        </div>
        
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Client
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md neumorphic-pressed rounded-lg px-4 py-2 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#A0AEC0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="bg-transparent flex-1 focus:outline-none placeholder-[#4A5568]"
          />
        </div>
        <button className="neumorphic-pressed px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-[#A0AEC0] hover:text-[#F5F5F5]">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="neumorphic-raised rounded-xl overflow-hidden">
          <div className="space-y-2 p-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-[#2C2E33] rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">No Clients Found</h3>
          <p className="text-[#A0AEC0] mb-4">
            {searchQuery ? 'Try a different search term.' : 'Add your first client to get started.'}
          </p>
          {!searchQuery && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="neumorphic-raised rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="neumorphic-pressed">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Sentiment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Region</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <ClientRow 
                  key={client.id} 
                  client={client} 
                  onClick={() => setSelectedClient(client)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateClientModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Client Dossier Drawer */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedClient(null)}
          />
          <div className="w-[600px] glass h-full overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="glass sticky top-0 z-10 p-6 border-b border-[#2C2E33]">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#2C2E33] to-[#1A1B1E] flex items-center justify-center">
                  {selectedClient.logo_url ? (
                    <img src={selectedClient.logo_url} alt="" className="w-14 h-14 rounded-lg" />
                  ) : (
                    <Building2 className="w-8 h-8 text-[#A0AEC0]" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-1">{selectedClient.name}</h2>
                  <p className="text-sm text-[#A0AEC0] capitalize">{selectedClient.industry?.replace('_', ' ')}</p>
                </div>
                <button 
                  onClick={() => setSelectedClient(null)}
                  className="p-2 rounded-lg hover:bg-[#2C2E33]"
                >
                  <X className="w-5 h-5 text-[#A0AEC0]" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="neumorphic-pressed rounded-xl p-4 text-center">
                  <p className="text-[#A0AEC0] text-xs mb-1">Value</p>
                  <p className="font-mono font-bold text-lg">
                    {selectedClient.value ? `$${selectedClient.value.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="neumorphic-pressed rounded-xl p-4 text-center">
                  <p className="text-[#A0AEC0] text-xs mb-1">Stage</p>
                  <p className="font-medium capitalize">
                    {selectedClient.lifecycle_stage?.replace('_', ' ') || 'Prospect'}
                  </p>
                </div>
                <div className="neumorphic-pressed rounded-xl p-4 text-center">
                  <p className="text-[#A0AEC0] text-xs mb-1">Risk Score</p>
                  <p className="font-mono font-bold text-lg">
                    {selectedClient.risk_score ?? '—'}
                  </p>
                </div>
              </div>

              {/* AI Insights */}
              {selectedClient.next_best_action && (
                <AIInsightCard
                  type="recommendation"
                  title="Next Best Action"
                  content={selectedClient.next_best_action}
                  severity="opportunity"
                />
              )}

              {selectedClient.insights?.stage_summaries?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#A0AEC0]">Workflow Summaries</h3>
                  {selectedClient.insights.stage_summaries.slice(-2).map((summary, idx) => (
                    <AIInsightCard
                      key={idx}
                      type="summary"
                      title={`${summary.workflow_name} - ${summary.stage_name}`}
                      content={summary.summary}
                      severity="info"
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]">
                  Start Workflow
                </Button>
                <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}