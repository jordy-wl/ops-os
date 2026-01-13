import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Sparkles,
  Plus,
  Send,
  MoreHorizontal,
  MessageSquare,
  Loader2,
  ChevronRight,
  Briefcase,
  GitMerge,
  FileText,
  CheckCircle,
  X,
  Trash2
} from 'lucide-react';

function SpaceItem({ space, isActive, onClick, onDelete }) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`
          w-full text-left px-4 py-3 rounded-xl transition-all
          ${isActive 
            ? 'neumorphic-pressed border border-[#BD00FF]/30 text-[#BD00FF]' 
            : 'hover:bg-[#2C2E33]'
          }
        `}
      >
        <h3 className="font-medium truncate mb-1 pr-8">{space.name}</h3>
        <p className="text-xs text-[#4A5568] truncate">{space.description || 'No description'}</p>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(space.id);
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

function MessageBubble({ message }) {
  const isAI = message.author_type === 'ai';
  
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-4`}>
      <div 
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${isAI 
            ? 'glass border border-[#BD00FF]/20 rounded-tl-none' 
            : 'neumorphic-raised rounded-tr-none'
          }
        `}
      >
        {isAI && (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#BD00FF]" />
            <span className="text-xs text-[#BD00FF] font-medium">AI Assistant</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs text-[#4A5568] mt-2">
          {new Date(message.created_date).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function ActionCard({ action, onExecute, onReject }) {
  const statusColors = {
    pending: 'border-orange-500/30 bg-orange-500/10',
    approved: 'border-green-500/30 bg-green-500/10',
    executed: 'border-green-500/30 bg-green-500/10',
    rejected: 'border-red-500/30 bg-red-500/10',
    failed: 'border-red-500/30 bg-red-500/10',
  };

  const actionIcons = {
    CREATE_WORKFLOW: GitMerge,
    GENERATE_REPORT: FileText,
    UPDATE_CLIENT_FIELD: Briefcase,
    CREATE_TASK: CheckCircle,
    PROPOSE_TEMPLATE_CHANGE: GitMerge,
  };

  const Icon = actionIcons[action.action_type] || CheckCircle;

  return (
    <div className={`rounded-xl p-4 border ${statusColors[action.status] || statusColors.pending} mb-3`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#2C2E33] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#BD00FF]" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm mb-1 capitalize">
            {action.action_type?.replace(/_/g, ' ')}
          </h4>
          <p className="text-xs text-[#A0AEC0] mb-3">
            {action.description || 'No description'}
          </p>
          
          {action.status === 'pending' && (
            <div className="flex gap-2">
              <button 
                onClick={() => onExecute(action.id)}
                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors"
              >
                Execute
              </button>
              <button 
                onClick={() => onReject(action.id)}
                className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
          {action.status === 'executed' && (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              <span>Executed</span>
            </div>
          )}
          {action.status === 'rejected' && (
            <div className="text-xs text-red-400">Rejected</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="glass border border-[#BD00FF]/20 rounded-2xl rounded-tl-none px-4 py-3">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-[#BD00FF] animate-spin" />
          <div className="space-y-1">
            <p className="text-xs text-[#BD00FF] animate-pulse">Analyzing Current State...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Strategy() {
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showNewSpaceModal, setShowNewSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  const queryClient = useQueryClient();

  const { data: spaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ['strategy-spaces'],
    queryFn: () => base44.entities.StrategySpace.list('-created_date', 50),
  });

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  const { data: messages = [] } = useQuery({
    queryKey: ['strategy-messages', selectedSpaceId],
    queryFn: () => selectedSpaceId 
      ? base44.entities.StrategyMessage.filter({ strategy_space_id: selectedSpaceId }, 'created_date', 100)
      : [],
    enabled: !!selectedSpaceId,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['strategy-actions', selectedSpaceId],
    queryFn: () => selectedSpaceId 
      ? base44.entities.StrategyAction.filter({ strategy_space_id: selectedSpaceId }, '-created_date', 50)
      : [],
    enabled: !!selectedSpaceId,
  });

  const executeActionMutation = useMutation({
    mutationFn: (actionId) => base44.functions.invoke('executeStrategyAction', { actionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-actions', selectedSpaceId] });
    },
  });

  const rejectActionMutation = useMutation({
    mutationFn: (actionId) => base44.entities.StrategyAction.update(actionId, { status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-actions', selectedSpaceId] });
    },
  });

  const createSpaceMutation = useMutation({
    mutationFn: (data) => base44.entities.StrategySpace.create(data),
    onSuccess: (newSpace) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-spaces'] });
      setSelectedSpaceId(newSpace.id);
      setShowNewSpaceModal(false);
      setNewSpaceName('');
    },
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: (spaceId) => base44.entities.StrategySpace.delete(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-spaces'] });
      if (selectedSpaceId) {
        setSelectedSpaceId(null);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content) => {
      // Create user message
      await base44.entities.StrategyMessage.create({
        strategy_space_id: selectedSpaceId,
        author_type: 'user',
        content,
      });
      
      setIsThinking(true);
      
      // Call AI reasoning backend
      const response = await base44.functions.invoke('aiStrategistReasoning', {
        prompt: content,
        strategySpaceId: selectedSpaceId,
      });

      setIsThinking(false);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-messages', selectedSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['strategy-actions', selectedSpaceId] });
      setInputValue('');
    },
  });

  const handleSend = () => {
    if (!inputValue.trim() || !selectedSpaceId) return;
    sendMessageMutation.mutate(inputValue);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row">
      {/* Spaces Sidebar */}
      <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#2C2E33] p-4 flex flex-col md:max-h-none max-h-48 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Strategy</h2>
          <button 
            onClick={() => setShowNewSpaceModal(true)}
            className="p-2 rounded-lg hover:bg-[#2C2E33] text-[#BD00FF]"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {spacesLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-[#2C2E33] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
              <p className="text-sm text-[#A0AEC0]">No spaces yet</p>
            </div>
          ) : (
            spaces.map(space => (
              <SpaceItem 
                key={space.id} 
                space={space}
                isActive={space.id === selectedSpaceId}
                onClick={() => setSelectedSpaceId(space.id)}
                onDelete={(id) => {
                  if (confirm('Delete this strategy space and all its messages?')) {
                    deleteSpaceMutation.mutate(id);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedSpace ? (
          <>
            {/* Chat Header */}
            <div className="glass border-b border-[#2C2E33] px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">{selectedSpace.name}</h2>
                <p className="text-sm text-[#A0AEC0]">{selectedSpace.description || 'No description'}</p>
              </div>
              <button className="p-2 rounded-lg hover:bg-[#2C2E33]">
                <MoreHorizontal className="w-5 h-5 text-[#A0AEC0]" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 && !isThinking ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#BD00FF]/20 to-[#BD00FF]/5 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-[#BD00FF]" />
                    </div>
                    <h3 className="font-medium mb-2">Start a conversation</h3>
                    <p className="text-sm text-[#A0AEC0] max-w-md">
                      Ask questions about your operations, request reports, or get AI-powered insights.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(message => {
                    const messageActions = actions.filter(a => a.trigger_message_id === message.id);
                    return (
                      <div key={message.id}>
                        <MessageBubble message={message} />
                        {messageActions.length > 0 && (
                          <div className="ml-12 mb-4">
                            {messageActions.map(action => (
                              <ActionCard 
                                key={action.id} 
                                action={action}
                                onExecute={(id) => executeActionMutation.mutate(id)}
                                onReject={(id) => rejectActionMutation.mutate(id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isThinking && <ThinkingIndicator />}
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#2C2E33]">
              <div className="neumorphic-pressed rounded-xl px-4 py-3 flex items-center gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type '/' for commands or ask a question..."
                  className="flex-1 bg-transparent focus:outline-none placeholder-[#4A5568]"
                />
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sendMessageMutation.isPending}
                  className="p-2 rounded-lg bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white disabled:opacity-50 hover:shadow-lg hover:shadow-[#BD00FF]/30 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#BD00FF]/20 to-[#BD00FF]/5 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-[#BD00FF]" />
              </div>
              <h2 className="text-xl font-bold mb-2">Strategy Command Center</h2>
              <p className="text-[#A0AEC0] mb-6 max-w-md">
                Create a strategy space to deliberate with AI, analyze operations, and execute system-wide actions.
              </p>
              <button 
                onClick={() => setShowNewSpaceModal(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white font-medium hover:shadow-lg hover:shadow-[#BD00FF]/30 transition-all"
              >
                Create Strategy Space
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Space Modal */}
      {showNewSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowNewSpaceModal(false)} />
          <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Strategy Space</h2>
              <button onClick={() => setShowNewSpaceModal(false)} className="p-2 rounded-lg hover:bg-[#2C2E33]">
                <X className="w-5 h-5 text-[#A0AEC0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Name</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g., Q1 Growth Plan"
                  className="w-full px-4 py-3 rounded-xl bg-[#1A1B1E] border border-[#2C2E33] focus:border-[#BD00FF] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowNewSpaceModal(false)}
                className="flex-1 py-3 rounded-xl border border-[#2C2E33] hover:bg-[#2C2E33]"
              >
                Cancel
              </button>
              <button 
                onClick={() => createSpaceMutation.mutate({ name: newSpaceName })}
                disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white font-medium disabled:opacity-50 hover:shadow-lg hover:shadow-[#BD00FF]/30"
              >
                {createSpaceMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}