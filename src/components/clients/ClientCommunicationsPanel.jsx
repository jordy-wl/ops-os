import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mail, Phone, Calendar, MessageSquare, FileText } from 'lucide-react';

const communicationIcons = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  message: MessageSquare,
  note: FileText,
};

export default function ClientCommunicationsPanel({ clientId }) {
  const { data: communications = [] } = useQuery({
    queryKey: ['communications', clientId],
    queryFn: () => base44.entities.CommunicationLog.filter({ client_id: clientId }, '-occurred_at', 100),
    enabled: !!clientId,
  });

  if (communications.length === 0) {
    return (
      <div className="neumorphic-pressed rounded-lg p-8 text-center">
        <MessageSquare className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
        <p className="text-sm text-[#A0AEC0]">No communications logged</p>
        <p className="text-xs text-[#4A5568] mt-1">Communications will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {communications.map((comm) => {
        const Icon = communicationIcons[comm.communication_type] || FileText;
        return (
          <div key={comm.id} className="neumorphic-pressed rounded-lg p-4 hover:bg-[#2C2E33] transition-colors">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                comm.communication_type === 'email' ? 'bg-blue-500/20' :
                comm.communication_type === 'call' ? 'bg-green-500/20' :
                comm.communication_type === 'meeting' ? 'bg-purple-500/20' :
                'bg-[#2C2E33]'
              }`}>
                <Icon className={`w-4 h-4 ${
                  comm.communication_type === 'email' ? 'text-blue-400' :
                  comm.communication_type === 'call' ? 'text-green-400' :
                  comm.communication_type === 'meeting' ? 'text-purple-400' :
                  'text-[#A0AEC0]'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                {comm.subject && (
                  <p className="text-sm font-medium truncate">{comm.subject}</p>
                )}
                {comm.content && (
                  <p className="text-xs text-[#A0AEC0] mt-1 line-clamp-2">{comm.content}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#2C2E33] text-[#A0AEC0] capitalize">
                    {comm.communication_type}
                  </span>
                  {comm.direction && (
                    <span className="text-xs text-[#4A5568] capitalize">{comm.direction}</span>
                  )}
                  {comm.occurred_at && (
                    <>
                      <span className="text-xs text-[#4A5568]">•</span>
                      <span className="text-xs text-[#4A5568]">
                        {new Date(comm.occurred_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}