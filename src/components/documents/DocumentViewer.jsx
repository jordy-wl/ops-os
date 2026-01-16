import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Download, CheckCircle, Send, FileText, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function DocumentViewer({ document, isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTo, setSendTo] = useState('client');
  const [customEmail, setCustomEmail] = useState('');

  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts', document?.client_id],
    queryFn: async () => {
      if (!document?.client_id) return [];
      const clientContacts = await base44.entities.ClientContact.filter({ client_id: document.client_id });
      const contactIds = clientContacts.map(cc => cc.contact_id);
      if (contactIds.length === 0) return [];
      const contacts = await base44.entities.Contact.filter({ id: { $in: contactIds } });
      return contacts;
    },
    enabled: isOpen && !!document?.client_id
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.DocumentInstance.update(document.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: (await base44.auth.me()).id,
      });
    },
    onSuccess: () => {
      toast.success('Document approved');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: async ({ email }) => {
      const response = await base44.functions.invoke('sendDocument', {
        document_id: document.id,
        recipient_email: email
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Document sent successfully');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowSendModal(false);
    },
    onError: (error) => {
      toast.error('Failed to send document: ' + error.message);
    }
  });

  const handleDownload = () => {
    if (document.file_url) {
      window.open(document.file_url, '_blank');
    }
  };

  const handleSend = () => {
    let emailToSend = '';
    
    if (sendTo === 'client') {
      const primaryContact = contacts.find(c => c.is_primary);
      emailToSend = primaryContact?.email || contacts[0]?.email;
    } else if (sendTo === 'custom') {
      emailToSend = customEmail;
    }

    if (!emailToSend) {
      toast.error('Please provide a valid email address');
      return;
    }

    sendDocumentMutation.mutate({ email: emailToSend });
  };

  if (!isOpen || !document) return null;

  const statusConfig = {
    draft: { color: 'text-[#A0AEC0]', bg: 'bg-[#2C2E33]', icon: Clock },
    generated: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: FileText },
    approved: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
    sent: { color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Send },
  };

  const config = statusConfig[document.status] || statusConfig.draft;
  const StatusIcon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-4xl max-h-[90vh] relative z-10 shadow-2xl border border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#2C2E33] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{document.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`}>
                <StatusIcon className={`w-3 h-3 ${config.color}`} />
                <span className={`text-xs font-medium ${config.color}`}>
                  {document.status.replace('_', ' ')}
                </span>
              </div>
              <span className="text-xs text-[#A0AEC0]">
                Generated {new Date(document.generated_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-[#F5F5F5]">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-[#F5F5F5]">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-medium mb-2 text-[#F5F5F5]">{children}</h3>,
              p: ({ children }) => <p className="mb-3 text-[#E0E0E0] leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc ml-6 mb-3 text-[#E0E0E0]">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal ml-6 mb-3 text-[#E0E0E0]">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-[#F5F5F5]">{children}</strong>,
              em: ({ children }) => <em className="italic text-[#A0AEC0]">{children}</em>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-[#BD00FF] pl-4 italic text-[#A0AEC0] my-3">
                  {children}
                </blockquote>
              ),
              code: ({ inline, children }) =>
                inline ? (
                  <code className="bg-[#1A1B1E] px-1.5 py-0.5 rounded text-sm text-[#00E5FF]">
                    {children}
                  </code>
                ) : (
                  <pre className="bg-[#1A1B1E] p-4 rounded-lg overflow-x-auto my-3">
                    <code className="text-sm text-[#E0E0E0]">{children}</code>
                  </pre>
                ),
            }}
          >
            {document.generated_content || document.content}
          </ReactMarkdown>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[#2C2E33] flex gap-3">
          {document.file_url && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
          
          {(document.status === 'generated' || document.status === 'approved') && (
            <Button
              onClick={() => setShowSendModal(true)}
              className="bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30 border border-[#00E5FF]/30"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Document
            </Button>
          )}

          {document.status === 'generated' && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          )}
          
          <Button
            variant="outline"
            className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33] ml-auto"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        {/* Send Modal */}
        {showSendModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
            <div className="bg-[#2C2E33] rounded-xl p-6 w-full max-w-md m-4">
              <h3 className="text-lg font-semibold mb-4">Send Document</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#A0AEC0] mb-2 block">Send to:</label>
                  <Select value={sendTo} onValueChange={setSendTo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client Contact</SelectItem>
                      <SelectItem value="custom">Custom Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sendTo === 'client' && contacts.length > 0 && (
                  <div className="text-sm text-[#A0AEC0]">
                    Sending to: {contacts.find(c => c.is_primary)?.email || contacts[0]?.email}
                  </div>
                )}

                {sendTo === 'client' && contacts.length === 0 && (
                  <div className="text-sm text-red-400">
                    No contacts found for this client
                  </div>
                )}

                {sendTo === 'custom' && (
                  <div>
                    <label className="text-sm text-[#A0AEC0] mb-2 block">Email Address:</label>
                    <Input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="recipient@example.com"
                      className="bg-[#1A1B1E] border-[#2C2E33]"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sendDocumentMutation.isPending || (sendTo === 'client' && contacts.length === 0)}
                  className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
                >
                  {sendDocumentMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}