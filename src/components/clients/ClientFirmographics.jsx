import React from 'react';
import { Building2, Globe, MapPin, DollarSign, TrendingUp, User, Mail, Phone, Linkedin, Star } from 'lucide-react';

export default function ClientFirmographics({ client, contacts = [] }) {
  return (
    <div className="space-y-4">
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Company Information</h3>
        
        {/* Logo */}
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#2C2E33] to-[#1A1B1E] flex items-center justify-center mb-4 mx-auto">
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.name} className="w-18 h-18 rounded-lg object-cover" />
          ) : (
            <Building2 className="w-10 h-10 text-[#A0AEC0]" />
          )}
        </div>

        <div className="space-y-3">
          {/* Industry */}
          {client.industry && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-[#4A5568] mb-0.5">Industry</p>
                <p className="text-sm capitalize">{client.industry.replace('_', ' ')}</p>
              </div>
            </div>
          )}

          {/* Region */}
          {client.region && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-[#4A5568] mb-0.5">Region</p>
                <p className="text-sm">{client.region}</p>
              </div>
            </div>
          )}

          {/* Website */}
          {client.website && (
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-[#4A5568] mb-0.5">Website</p>
                <a 
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#00E5FF] hover:underline truncate block"
                >
                  {client.website.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </div>
            </div>
          )}

          {/* Value */}
          {client.value && (
            <div className="flex items-start gap-3">
              <DollarSign className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-[#4A5568] mb-0.5">Value</p>
                <p className="text-sm font-mono">${client.value.toLocaleString()} {client.currency || 'USD'}</p>
              </div>
            </div>
          )}

          {/* Lifecycle Stage */}
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-[#4A5568] mb-0.5">Lifecycle Stage</p>
              <span className="inline-block px-2 py-1 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">
                {client.lifecycle_stage?.replace('_', ' ') || 'prospect'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Contacts</h3>
        {contacts.length === 0 ? (
          <div className="text-center py-4">
            <User className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
            <p className="text-xs text-[#A0AEC0]">No contacts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="neumorphic-pressed rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2C2E33] to-[#1A1B1E] flex items-center justify-center flex-shrink-0">
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-[#A0AEC0]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.is_primary && (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    {contact.job_title && (
                      <p className="text-xs text-[#A0AEC0] truncate">{contact.job_title}</p>
                    )}
                    {contact.role && (
                      <p className="text-xs text-[#4A5568] capitalize mt-1">{contact.role.replace('_', ' ')}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-[#00E5FF] hover:text-[#00b8cc]">
                          <Mail className="w-3 h-3" />
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-[#00E5FF] hover:text-[#00b8cc]">
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] hover:text-[#00b8cc]">
                          <Linkedin className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Metadata */}
      {client.metadata && Object.keys(client.metadata).filter(key => !key.startsWith('_')).length > 0 && (
        <div className="neumorphic-raised rounded-xl p-6">
          <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Additional Details</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(client.metadata)
              .filter(([key]) => !key.startsWith('_'))
              .slice(0, 5)
              .map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-[#A0AEC0] capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-[#F5F5F5] truncate ml-2">{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}