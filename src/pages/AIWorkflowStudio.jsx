import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sparkles, 
  Send, 
  Upload, 
  Plus, 
  Check, 
  X, 
  Edit2,
  Loader2,
  ChevronRight,
  FileText,
  Layers,
  Target,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

const MessageBubble = ({ message, isUser }) => (
  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
    <div className={`max-w-[95%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2 md:py-3 ${
      isUser 
        ? 'bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]' 
        : 'glass border border-white/10'
    }`}>
      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
    </div>
  </div>
);

const WorkflowSuggestionCard = ({ suggestion, onApprove, onEdit, onReject }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(suggestion);

  const handleSave = () => {
    onEdit(editedData);
    setIsEditing(false);
  };

  return (
    <div className="neumorphic-raised rounded-xl p-3 md:p-4 mb-3">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          {suggestion.type === 'workflow' && <Layers className="w-4 h-4 md:w-5 md:h-5 text-[#00E5FF] flex-shrink-0" />}
          {suggestion.type === 'stage' && <Target className="w-4 h-4 md:w-5 md:h-5 text-[#BD00FF] flex-shrink-0" />}
          {suggestion.type === 'deliverable' && <FileText className="w-4 h-4 md:w-5 md:h-5 text-[#00E5FF] flex-shrink-0" />}
          {suggestion.type === 'task' && <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-[#BD00FF] flex-shrink-0" />}
          <span className="text-xs uppercase font-medium text-[#A0AEC0] truncate">{suggestion.type}</span>
        </div>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1 rounded hover:bg-[#2C2E33] text-[#A0AEC0] hover:text-[#F5F5F5] flex-shrink-0"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3 w-full">
          <Input
            value={editedData.name}
            onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
            placeholder="Name"
            className="bg-[#1A1B1E] border-[#2C2E33]"
          />
          <Textarea
            value={editedData.description || ''}
            onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
            placeholder="Description"
            className="bg-[#1A1B1E] border-[#2C2E33] min-h-[80px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} size="sm" className="bg-[#00E5FF] text-[#121212] flex-1 md:flex-none">
              Save
            </Button>
            <Button onClick={() => setIsEditing(false)} size="sm" variant="outline" className="flex-1 md:flex-none text-[#F5F5F5]">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h4 className="font-semibold mb-2 text-sm md:text-base break-words">{suggestion.name}</h4>
          {suggestion.description && (
            <p className="text-xs md:text-sm text-[#A0AEC0] mb-3 break-words">{suggestion.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => onApprove(suggestion)} 
              size="sm" 
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 flex-1 md:flex-none"
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
            <Button 
              onClick={() => onReject(suggestion)} 
              size="sm" 
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/20 flex-1 md:flex-none"
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default function AIWorkflowStudio() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Hi! I\'m your AI Workflow Architect. I can help you design workflows tailored to your organization.\n\nTell me about the workflow you want to create, or upload documents that describe your process.'
  }]);
  const [input, setInput] = useState('');
  const [workflowContext, setWorkflowContext] = useState(null);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingSuggestions]);

  const buildWorkflowMutation = useMutation({
    mutationFn: async ({ message, context, files }) => {
      const response = await base44.functions.invoke('aiBuildWorkflow', {
        user_message: message,
        workflow_context: context,
        uploaded_file_urls: files,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.assistant_message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.assistant_message }]);
      }
      if (data.suggestions && data.suggestions.length > 0) {
        setPendingSuggestions(data.suggestions);
      }
      if (data.workflow_context) {
        setWorkflowContext(data.workflow_context);
      }
    },
    onError: (error) => {
      toast.error('Failed to process request');
      console.error(error);
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (suggestion) => {
      const response = await base44.functions.invoke('aiBuildWorkflow', {
        action: 'approve',
        suggestion,
        workflow_context: workflowContext,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Approved and created');
      setPendingSuggestions(prev => prev.filter(s => s.id !== data.approved_id));
      if (data.workflow_context) {
        setWorkflowContext(data.workflow_context);
      }
      if (data.assistant_message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.assistant_message }]);
      }
    },
  });

  const handleSend = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const userMessage = input.trim();
    if (userMessage) {
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    }

    setInput('');
    buildWorkflowMutation.mutate({
      message: userMessage,
      context: workflowContext,
      files: uploadedFiles.map(f => f.url),
    });
    setUploadedFiles([]);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploadedFiles(prev => [...prev, { name: file.name, url: file_url }]);
        toast.success(`${file.name} uploaded`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleApprove = (suggestion) => {
    approveMutation.mutate(suggestion);
  };

  const handleEdit = (editedSuggestion) => {
    setPendingSuggestions(prev => 
      prev.map(s => s.id === editedSuggestion.id ? editedSuggestion : s)
    );
  };

  const handleReject = (suggestion) => {
    setPendingSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    toast.info('Suggestion rejected');
  };

  return (
    <div className="h-screen flex flex-col bg-[#121212]">
      {/* Header */}
      <div className="glass border-b border-white/5 px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#BD00FF] to-[#00E5FF] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold">AI Workflow Studio</h1>
            <p className="text-xs md:text-sm text-[#A0AEC0]">Build workflows with AI assistance</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-dark">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} isUser={msg.role === 'user'} />
            ))}
            
            {pendingSuggestions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[#A0AEC0] mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Suggestions
                </h3>
                {pendingSuggestions.map((suggestion) => (
                  <WorkflowSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApprove={handleApprove}
                    onEdit={handleEdit}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}

            {buildWorkflowMutation.isPending && (
              <div className="flex justify-start mb-4">
                <div className="glass rounded-2xl px-4 py-3 border border-white/10 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                  <span className="text-sm text-[#A0AEC0]">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="glass border-t border-white/5 p-3 md:p-4">
            {uploadedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="neumorphic-pressed px-2 md:px-3 py-1 rounded-lg flex items-center gap-2 text-xs md:text-sm max-w-full">
                    <FileText className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
                    <span className="text-[#A0AEC0] truncate">{file.name}</span>
                    <button 
                      onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-[#4A5568] hover:text-[#F5F5F5]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2 items-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="neumorphic-raised p-2 md:p-3 rounded-lg hover:bg-[#2C2E33] transition-colors flex-shrink-0"
              >
                <Upload className="w-4 h-4 md:w-5 md:h-5 text-[#A0AEC0]" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md"
              />
              
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your workflow..."
                className="flex-1 bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] resize-none text-sm min-w-0"
                rows={2}
              />
              
              <Button
                onClick={handleSend}
                disabled={buildWorkflowMutation.isPending || (!input.trim() && uploadedFiles.length === 0)}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30 flex-shrink-0 p-2 md:px-4"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Context Panel */}
        {workflowContext && (
          <div className="w-full md:w-80 glass border-t md:border-t-0 md:border-l border-white/5 p-4 overflow-y-auto scrollbar-dark max-h-64 md:max-h-none">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm md:text-base">
              <Layers className="w-4 h-4 md:w-5 md:h-5 text-[#00E5FF]" />
              Workflow Progress
            </h3>
            
            {workflowContext.workflow && (
              <div className="mb-4">
                <div className="text-xs text-[#A0AEC0] mb-1">Workflow</div>
                <div className="neumorphic-pressed rounded-lg p-2 md:p-3">
                  <p className="font-medium text-xs md:text-sm break-words">{workflowContext.workflow.name}</p>
                  {workflowContext.workflow.description && (
                    <p className="text-xs text-[#A0AEC0] mt-1 break-words">{workflowContext.workflow.description}</p>
                  )}
                </div>
              </div>
            )}

            {workflowContext.stages && workflowContext.stages.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[#A0AEC0] mb-2">Stages ({workflowContext.stages.length})</div>
                <div className="space-y-2">
                  {workflowContext.stages.map((stage, idx) => (
                    <div key={idx} className="neumorphic-pressed rounded-lg p-2 text-xs md:text-sm break-words">
                      {stage.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workflowContext.deliverables && workflowContext.deliverables.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-[#A0AEC0] mb-2">Deliverables ({workflowContext.deliverables.length})</div>
                <div className="space-y-2">
                  {workflowContext.deliverables.map((deliverable, idx) => (
                    <div key={idx} className="neumorphic-pressed rounded-lg p-2 text-xs md:text-sm break-words">
                      {deliverable.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {workflowContext.tasks && workflowContext.tasks.length > 0 && (
              <div>
                <div className="text-xs text-[#A0AEC0] mb-2">Tasks ({workflowContext.tasks.length})</div>
                <div className="space-y-2">
                  {workflowContext.tasks.map((task, idx) => (
                    <div key={idx} className="neumorphic-pressed rounded-lg p-2 text-xs md:text-sm break-words">
                      {task.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}