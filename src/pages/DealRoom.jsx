import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download,
  Send,
  Users,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function DealRoom() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [activeTab, setActiveTab] = useState('document');

  // Fetch deal and quote by token
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['deal-room', token],
    queryFn: async () => {
      const deals = await base44.entities.Deal.filter({ deal_room_token: token });
      return deals[0];
    },
    enabled: !!token
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['deal-quotes', deal?.id],
    queryFn: () => base44.entities.Quote.filter({ deal_id: deal.id }, '-version_number'),
    enabled: !!deal?.id
  });

  const { data: client } = useQuery({
    queryKey: ['deal-room-client', deal?.client_id],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: deal.client_id });
      return clients[0];
    },
    enabled: !!deal?.client_id
  });

  const latestQuote = quotes[0];

  // Track view
  useEffect(() => {
    if (latestQuote?.id && latestQuote.status === 'sent' && !latestQuote.viewed_at) {
      base44.entities.Quote.update(latestQuote.id, {
        status: 'viewed',
        viewed_at: new Date().toISOString()
      });
    }
  }, [latestQuote?.id]);

  const addCommentMutation = useMutation({
    mutationFn: async ({ quoteId, comment }) => {
      const existingComments = latestQuote.comments || [];
      const newCommentObj = {
        id: crypto.randomUUID(),
        user_id: 'external',
        user_name: 'Client User',
        user_type: 'client',
        comment: comment,
        section: selectedSection || 'general',
        created_at: new Date().toISOString()
      };

      return base44.entities.Quote.update(quoteId, {
        comments: [...existingComments, newCommentObj],
        status: 'negotiating'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-quotes', deal?.id] });
      setNewComment('');
      toast.success('Comment added');
    }
  });

  const updateQuoteStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }) => {
      const updates = { status };
      if (status === 'accepted') {
        updates.accepted_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updates.rejected_at = new Date().toISOString();
      }
      return base44.entities.Quote.update(quoteId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-quotes', deal?.id] });
      toast.success('Quote status updated');
    }
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Access</h1>
          <p className="text-[#A0AEC0]">No access token provided</p>
        </div>
      </div>
    );
  }

  if (dealLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="animate-pulse text-[#A0AEC0]">Loading deal room...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-6">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Deal Not Found</h1>
          <p className="text-[#A0AEC0]">Invalid or expired access token</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-400',
    sent: 'bg-blue-500/20 text-blue-400',
    viewed: 'bg-cyan-500/20 text-cyan-400',
    negotiating: 'bg-yellow-500/20 text-yellow-400',
    accepted: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400'
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#F5F5F5]">
      {/* Header */}
      <div className="border-b border-[#2C2E33] bg-[#1A1B1E] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{deal.name}</h1>
              <p className="text-sm text-[#A0AEC0]">{client?.name}</p>
            </div>
            <div className="flex items-center gap-4">
              {latestQuote && (
                <>
                  <Badge className={statusColors[latestQuote.status]}>
                    {latestQuote.status}
                  </Badge>
                  <span className="text-sm text-[#4A5568]">
                    Version {latestQuote.version_number}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Document Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="neumorphic-pressed rounded-lg p-1 flex w-fit">
              <button
                onClick={() => setActiveTab('document')}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  activeTab === 'document' 
                    ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                    : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Document
              </button>
              <button
                onClick={() => setActiveTab('versions')}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  activeTab === 'versions' 
                    ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                    : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Versions ({quotes.length})
              </button>
            </div>

            {/* Document Content */}
            {activeTab === 'document' && latestQuote && (
              <div className="neumorphic-raised rounded-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Quote Document</h2>
                  <a 
                    href={latestQuote.quote_document_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="bg-[#2C2E33] hover:bg-[#3a3d44]">
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </a>
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{latestQuote.content || 'No content available'}</ReactMarkdown>
                </div>

                {/* Actions */}
                {latestQuote.status !== 'accepted' && latestQuote.status !== 'rejected' && (
                  <div className="flex gap-4 mt-8 pt-6 border-t border-[#2C2E33]">
                    <Button
                      onClick={() => updateQuoteStatusMutation.mutate({ 
                        quoteId: latestQuote.id, 
                        status: 'accepted' 
                      })}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept Quote
                    </Button>
                    <Button
                      onClick={() => updateQuoteStatusMutation.mutate({ 
                        quoteId: latestQuote.id, 
                        status: 'rejected' 
                      })}
                      variant="outline"
                      className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Quote
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Version History */}
            {activeTab === 'versions' && (
              <div className="space-y-4">
                {quotes.map((quote) => (
                  <div key={quote.id} className="neumorphic-raised rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold">Version {quote.version_number}</span>
                          <Badge className={statusColors[quote.status]}>
                            {quote.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#A0AEC0]">
                          Generated {new Date(quote.generated_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-[#4A5568]">
                          Total: ${quote.total_quoted_value.toLocaleString()}
                        </p>
                      </div>
                      <a 
                        href={quote.quote_document_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar - Comments & Activity */}
          <div className="space-y-6">
            {/* Add Comment */}
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#00E5FF]" />
                Add Comment
              </h3>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ask a question or provide feedback..."
                className="mb-3 bg-[#1A1B1E] border-[#2C2E33]"
              />
              <Button
                onClick={() => addCommentMutation.mutate({ 
                  quoteId: latestQuote.id, 
                  comment: newComment 
                })}
                disabled={!newComment.trim() || !latestQuote}
                className="w-full bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                <Send className="w-4 h-4 mr-2" />
                Post Comment
              </Button>
            </div>

            {/* Comments Feed */}
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="font-semibold mb-4">Comments & Discussion</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {latestQuote?.comments?.length > 0 ? (
                  latestQuote.comments.map((comment) => (
                    <div key={comment.id} className="neumorphic-pressed rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00E5FF] to-[#0099ff] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#121212]">
                            {comment.user_name[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{comment.user_name}</span>
                            <Badge className="text-xs bg-[#2C2E33]">
                              {comment.user_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-[#A0AEC0] mb-1">{comment.comment}</p>
                          <p className="text-xs text-[#4A5568]">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#4A5568] text-center py-8">
                    No comments yet
                  </p>
                )}
              </div>
            </div>

            {/* Deal Info */}
            <div className="neumorphic-raised rounded-xl p-4">
              <h3 className="font-semibold mb-4">Deal Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[#4A5568]">Stage</p>
                  <p className="capitalize">{deal.stage.replace('_', ' ')}</p>
                </div>
                {deal.expected_close_date && (
                  <div>
                    <p className="text-[#4A5568]">Expected Close</p>
                    <p>{new Date(deal.expected_close_date).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-[#4A5568]">Total Value</p>
                  <p className="text-lg font-bold text-[#00E5FF]">
                    ${deal.total_expected_value?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}