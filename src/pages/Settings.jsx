import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon,
  Building2,
  CreditCard,
  Users,
  Plug,
  Bot,
  FileText,
  Shield,
  Globe,
  Bell,
  Palette,
  ChevronRight,
  Check,
  X
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const tabs = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'ai', label: 'AI Agents', icon: Bot },
  { id: 'audit', label: 'Audit Log', icon: FileText },
];

const integrations = [
  { name: 'Slack', description: 'Send notifications to Slack channels', connected: false, icon: '💬' },
  { name: 'HubSpot', description: 'Sync client data with HubSpot CRM', connected: false, icon: '🔶' },
  { name: 'Stripe', description: 'Process payments and invoices', connected: false, icon: '💳' },
  { name: 'Google Drive', description: 'Store and sync documents', connected: false, icon: '📁' },
  { name: 'Zapier', description: 'Connect to 5000+ apps', connected: false, icon: '⚡' },
];

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Organization</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Company Name</label>
            <Input 
              placeholder="Your Company" 
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] max-w-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Logo</label>
            <div className="neumorphic-pressed rounded-xl p-8 max-w-md text-center cursor-pointer hover:bg-[#232529]">
              <Building2 className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
              <p className="text-sm text-[#A0AEC0]">Click to upload logo</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Timezone</label>
            <select className="px-4 py-2 rounded-lg bg-[#1A1B1E] border border-[#2C2E33] focus:border-[#00E5FF] focus:outline-none max-w-md w-full">
              <option>UTC</option>
              <option>America/New_York</option>
              <option>America/Los_Angeles</option>
              <option>Europe/London</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-[#2C2E33] pt-6">
        <h3 className="text-lg font-medium mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between max-w-md">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-[#A0AEC0]">Receive email updates</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between max-w-md">
            <div>
              <p className="font-medium">Task Reminders</p>
              <p className="text-sm text-[#A0AEC0]">Get reminded of upcoming tasks</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationsSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium mb-4">Connected Services</h3>
      {integrations.map(integration => (
        <div 
          key={integration.name}
          className="neumorphic-raised rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#2C2E33] flex items-center justify-center text-2xl">
              {integration.icon}
            </div>
            <div>
              <h4 className="font-medium">{integration.name}</h4>
              <p className="text-sm text-[#A0AEC0]">{integration.description}</p>
            </div>
          </div>
          <Button 
            variant={integration.connected ? 'outline' : 'default'}
            className={integration.connected 
              ? 'bg-transparent border-green-500/30 text-green-400' 
              : 'bg-[#2C2E33] hover:bg-[#3a3d44]'
            }
          >
            {integration.connected ? 'Connected' : 'Connect'}
          </Button>
        </div>
      ))}
    </div>
  );
}

function AIAgentsSettings() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => base44.entities.AIAgentConfig.list('-created_date', 20),
  });

  const defaultAgents = [
    { name: 'Strategy Orchestrator', role: 'strategy_orchestrator', description: 'Powers the Strategy chat interface', is_enabled: true },
    { name: 'Workflow Designer', role: 'workflow_designer', description: 'Auto-generates workflow structures', is_enabled: true },
    { name: 'Report Builder', role: 'report_builder', description: 'Creates analytical reports', is_enabled: true },
    { name: 'Document Generator', role: 'deliverable_generator', description: 'Populates document templates', is_enabled: true },
  ];

  const displayAgents = agents.length > 0 ? agents : defaultAgents;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">AI Agents</h3>
          <p className="text-sm text-[#A0AEC0]">Configure AI capabilities and permissions</p>
        </div>
        <Button className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white">
          Add Agent
        </Button>
      </div>

      <div className="space-y-3">
        {displayAgents.map((agent, idx) => (
          <div 
            key={agent.id || idx}
            className="neumorphic-raised rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#BD00FF]/20 to-[#BD00FF]/5 flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#BD00FF]" />
              </div>
              <div>
                <h4 className="font-medium">{agent.name}</h4>
                <p className="text-sm text-[#A0AEC0]">{agent.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Switch checked={agent.is_enabled !== false} />
              <Button variant="ghost" size="sm">
                Configure
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="neumorphic-pressed rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-orange-400" />
          <h4 className="font-medium">Security Notice</h4>
        </div>
        <p className="text-sm text-[#A0AEC0]">
          AI agents operate within defined permission scopes. They cannot modify permissions, 
          delete templates, or access data outside their configured scope. All AI actions are logged in the audit trail.
        </p>
      </div>
    </div>
  );
}

function AuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.Event.list('-created_date', 50),
  });

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">System Audit Log</h3>
      
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-[#2C2E33] rounded animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="neumorphic-pressed rounded-xl p-8 text-center">
          <FileText className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
          <p className="text-[#A0AEC0]">No events logged yet</p>
        </div>
      ) : (
        <div className="neumorphic-raised rounded-xl overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto font-mono text-sm">
            {logs.map((log, idx) => (
              <div 
                key={log.id || idx}
                className={`px-4 py-3 flex items-center gap-4 ${
                  log.actor_type === 'ai' ? 'bg-[#BD00FF]/5' : ''
                } ${idx % 2 === 0 ? 'bg-[#1A1B1E]' : 'bg-[#232529]'}`}
              >
                <span className="text-[#4A5568] w-40 shrink-0">
                  {log.occurred_at 
                    ? new Date(log.occurred_at).toLocaleString() 
                    : new Date(log.created_date).toLocaleString()
                  }
                </span>
                <span className={`w-16 shrink-0 ${
                  log.actor_type === 'ai' ? 'text-[#BD00FF]' : 
                  log.actor_type === 'system' ? 'text-orange-400' : 'text-[#00E5FF]'
                }`}>
                  {log.actor_type?.toUpperCase() || 'USER'}
                </span>
                <span className="flex-1 text-[#A0AEC0]">
                  {log.event_type?.replace(/_/g, ' ')}
                </span>
                <span className="text-[#4A5568]">
                  {log.source_entity_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  const renderContent = () => {
    switch(activeTab) {
      case 'general': return <GeneralSettings />;
      case 'integrations': return <IntegrationsSettings />;
      case 'ai': return <AIAgentsSettings />;
      case 'audit': return <AuditLog />;
      default: return (
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <p className="text-[#A0AEC0]">Coming soon</p>
        </div>
      );
    }
  };

  return (
    <div className="p-6">
      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeTab === tab.id
                      ? 'neumorphic-pressed text-[#00E5FF]'
                      : 'hover:bg-[#2C2E33] text-[#A0AEC0]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}