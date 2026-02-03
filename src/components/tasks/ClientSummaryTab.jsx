import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Mail, Phone, TrendingUp, Briefcase, User } from 'lucide-react';

export default function ClientSummaryTab({ clientId }) {
  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client-summary', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const [clients, clientContacts, deals] = await Promise.all([
        base44.entities.Client.filter({ id: clientId }),
        base44.entities.ClientContact.filter({ client_id: clientId }),
        base44.entities.Deal.filter({ client_id: clientId }),
      ]);

      const client = clients[0];
      if (!client) return null;

      const contactIds = clientContacts.map(cc => cc.contact_id);
      const contacts = contactIds.length > 0 
        ? await Promise.all(contactIds.map(id => base44.entities.Contact.filter({ id })))
        : [];

      return {
        client,
        contacts: contacts.flat(),
        clientContacts,
        deals,
      };
    },
    enabled: !!clientId,
  });

  if (!clientId) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <Building2 className="w-12 h-12 mx-auto mb-3 text-[#4A5568]" />
          <p className="text-[#A0AEC0]">No client associated with this task</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-20 bg-[#2C2E33] rounded-lg animate-pulse" />
        <div className="h-32 bg-[#2C2E33] rounded-lg animate-pulse" />
        <div className="h-24 bg-[#2C2E33] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!clientData?.client) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <Building2 className="w-12 h-12 mx-auto mb-3 text-[#4A5568]" />
          <p className="text-[#A0AEC0]">Client not found</p>
        </div>
      </div>
    );
  }

  const { client, contacts, clientContacts, deals } = clientData;
  const primaryContact = contacts.find(c => 
    clientContacts.find(cc => cc.contact_id === c.id && cc.is_primary)
  );

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* Client Overview */}
      <div className="neumorphic-pressed rounded-lg p-4">
        <div className="flex items-start gap-3 mb-3">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2C2E33] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#A0AEC0]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1">{client.name}</h3>
            <div className="flex items-center gap-3 text-sm text-[#A0AEC0]">
              {client.industry && (
                <span className="capitalize">{client.industry}</span>
              )}
              {client.region && (
                <span>{client.region}</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Lifecycle Stage */}
        <div className="flex items-center gap-2 mt-3">
          <TrendingUp className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-sm">Stage:</span>
          <span className={`text-sm font-medium capitalize px-2 py-0.5 rounded ${
            client.lifecycle_stage === 'active' ? 'bg-green-500/20 text-green-400' :
            client.lifecycle_stage === 'prospect' ? 'bg-blue-500/20 text-blue-400' :
            client.lifecycle_stage === 'qualified' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' :
            'bg-[#2C2E33] text-[#A0AEC0]'
          }`}>
            {client.lifecycle_stage || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Primary Contact */}
      {primaryContact && (
        <div className="neumorphic-pressed rounded-lg p-4">
          <h4 className="text-sm font-medium text-[#A0AEC0] mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Primary Contact
          </h4>
          <div className="space-y-2">
            <div>
              <div className="font-medium">
                {primaryContact.first_name} {primaryContact.last_name}
              </div>
              {primaryContact.job_title && (
                <div className="text-sm text-[#A0AEC0]">{primaryContact.job_title}</div>
              )}
            </div>
            {primaryContact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-[#4A5568]" />
                <a href={`mailto:${primaryContact.email}`} className="text-[#00E5FF] hover:underline">
                  {primaryContact.email}
                </a>
              </div>
            )}
            {primaryContact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-[#4A5568]" />
                <a href={`tel:${primaryContact.phone}`} className="text-[#00E5FF] hover:underline">
                  {primaryContact.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Contacts */}
      {contacts.length > 0 && (
        <div className="neumorphic-pressed rounded-lg p-4">
          <h4 className="text-sm font-medium text-[#A0AEC0] mb-3">
            All Contacts ({contacts.length})
          </h4>
          <div className="space-y-2">
            {contacts.map(contact => (
              <div key={contact.id} className="text-sm flex items-center justify-between py-1">
                <div>
                  <div className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </div>
                  {contact.job_title && (
                    <div className="text-xs text-[#A0AEC0]">{contact.job_title}</div>
                  )}
                </div>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="text-[#00E5FF] hover:underline">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Deals */}
      {deals.length > 0 && (
        <div className="neumorphic-pressed rounded-lg p-4">
          <h4 className="text-sm font-medium text-[#A0AEC0] mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Active Deals ({deals.length})
          </h4>
          <div className="space-y-3">
            {deals.map(deal => (
              <div key={deal.id} className="bg-[#1A1B1E] rounded-lg p-3">
                <div className="font-medium mb-1">{deal.name}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize text-[#A0AEC0]">{deal.stage?.replace('_', ' ')}</span>
                  {deal.expected_close_date && (
                    <span className="text-[#4A5568]">
                      Close: {new Date(deal.expected_close_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {deal.total_expected_value && (
                  <div className="text-[#00E5FF] font-medium mt-1">
                    ${deal.total_expected_value.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {client.website && (
        <div className="text-center">
          <a
            href={client.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#00E5FF] hover:underline"
          >
            Visit Website →
          </a>
        </div>
      )}
    </div>
  );
}