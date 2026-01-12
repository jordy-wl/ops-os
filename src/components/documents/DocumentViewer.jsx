import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Download, CheckCircle, Send, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function DocumentViewer({ document, isOpen, onClose }) {
  const queryClient = useQueryClient();

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

  const markSentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.DocumentInstance.update(document.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Document marked as sent');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
  });

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
          {document.status === 'generated' && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Document
            </Button>
          )}
          {document.status === 'approved' && (
            <Button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
            >
              <Send className="w-4 h-4 mr-2" />
              Mark as Sent
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
      </div>
    </div>
  );
}