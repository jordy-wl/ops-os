import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import ClientFirmographics from '@/components/clients/ClientFirmographics';
import ClientActivityFeed from '@/components/clients/ClientActivityFeed';
import ClientDataAndAssets from '@/components/clients/ClientDataAndAssets';
import ClientCommunicationPanel from '@/components/clients/ClientCommunicationPanel';
import InsightsPanel from '@/components/analytics/InsightsPanel';
import ProactiveInsightsWidget from '@/components/ai/ProactiveInsightsWidget';

export default function ClientDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0];
    },
    enabled: !!clientId,
  });

  const { data: workflowInstances = [] } = useQuery({
    queryKey: ['workflow-instances', clientId],
    queryFn: () => base44.entities.WorkflowInstance.filter({ client_id: clientId }, '-created_date', 50),
    enabled: !!clientId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', clientId],
    queryFn: () => base44.entities.DocumentInstance.filter({ client_id: clientId }, '-created_date', 50),
    enabled: !!clientId,
  });

  const { data: communications = [] } = useQuery({
    queryKey: ['communications', clientId],
    queryFn: () => base44.entities.CommunicationLog.filter({ client_id: clientId }, '-created_date', 50),
    enabled: !!clientId,
  });

  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      const links = await base44.entities.ClientContact.filter({ client_id: clientId });
      const contactIds = links.map(link => link.contact_id);
      if (contactIds.length === 0) return [];
      const contacts = await Promise.all(
        contactIds.map(async (id) => {
          const result = await base44.entities.Contact.filter({ id });
          const contact = result[0];
          const link = links.find(l => l.contact_id === id);
          return { ...contact, role: link?.role, is_primary: link?.is_primary };
        })
      );
      return contacts;
    },
    enabled: !!clientId,
  });

  const { data: workflowTemplates = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.filter({ is_active: true }, '-created_date', 50),
  });

  const pushWorkflowMutation = useMutation({
    mutationFn: async (templateId) => {
      const workflowInstance = await base44.entities.WorkflowInstance.create({
        workflow_template_id: templateId,
        client_id: clientId,
        status: 'not_started',
        progress_percentage: 0
      });
      return workflowInstance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances', clientId] });
      setSelectedWorkflow(null);
    }
  });

  if (!clientId) {
    return (
      <div className="p-6">
        <p className="text-[#A0AEC0]">No client ID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#2C2E33] rounded w-1/3" />
          <div className="h-64 bg-[#2C2E33] rounded" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-[#A0AEC0]">Client not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <button
        onClick={() => navigate(createPageUrl('Clients'))}
        className="mb-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">{client.name}</h1>
        <p className="text-[#A0AEC0] capitalize">{client.industry?.replace('_', ' ') || 'No industry'}</p>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Firmographics */}
        <div className="col-span-3">
          <ClientFirmographics client={client} contacts={clientContacts} />
        </div>

        {/* Middle Column - Activity & Insights */}
        <div className="col-span-5 space-y-6">
          <ProactiveInsightsWidget clientId={clientId} />
          <ClientActivityFeed 
            client={client}
            workflowInstances={workflowInstances}
            communications={communications}
          />
          <div className="neumorphic-raised rounded-xl p-4">
            <h3 className="font-semibold mb-4">AI-Powered Insights</h3>
            <InsightsPanel clientId={clientId} />
          </div>
        </div>

        {/* Right Column - Data & Assets */}
        <div className="col-span-4 space-y-6">
          <ClientDataAndAssets 
            client={client}
            documents={documents}
          />
          
          {/* Workflows Card */}
          <div className="neumorphic-raised rounded-xl p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#00E5FF]" />
              Push to Workflow
            </h3>
            <div className="space-y-2">
              {workflowTemplates.length === 0 ? (
                <p className="text-sm text-[#A0AEC0]">No workflows available</p>
              ) : (
                workflowTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => pushWorkflowMutation.mutate(template.id)}
                    disabled={pushWorkflowMutation.isPending}
                    className="w-full text-left p-3 rounded-lg bg-[#1A1B1E] hover:bg-[#2C2E33] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#F5F5F5]">{template.name}</p>
                        <p className="text-xs text-[#A0AEC0]">{template.category || 'custom'}</p>
                      </div>
                      {pushWorkflowMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                      ) : (
                        <Play className="w-4 h-4 text-[#A0AEC0]" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          
          {clientContacts.length > 0 && (
            <ClientCommunicationPanel 
              client={client}
              contacts={clientContacts}
            />
          )}
        </div>
      </div>
    </div>
  );
}