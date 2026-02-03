import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function TaskChatbot({ task, taskTemplate, deliverableInstance, workflowInstance, client, deals }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your task assistant. I can help you with this task by answering questions about the client, workflow, or task requirements. What would you like to know?`
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage) => {
      // Build context from task and related entities
      const context = {
        task: {
          name: task.name,
          description: task.description,
          instructions: task.instructions,
          priority: task.priority,
          status: task.status,
          due_date: task.due_date,
        },
        taskTemplate: taskTemplate ? {
          name: taskTemplate.name,
          description: taskTemplate.description,
          instructions: taskTemplate.instructions,
          data_field_definitions: taskTemplate.data_field_definitions,
        } : null,
        deliverable: deliverableInstance ? {
          name: deliverableInstance.name,
          description: deliverableInstance.description,
        } : null,
        workflow: workflowInstance ? {
          name: workflowInstance.name,
          status: workflowInstance.status,
        } : null,
        client: client ? {
          name: client.name,
          industry: client.industry,
          lifecycle_stage: client.lifecycle_stage,
        } : null,
        deals: deals?.map(d => ({
          name: d.name,
          stage: d.stage,
          expected_close_date: d.expected_close_date,
        })) || []
      };

      const prompt = `You are a helpful task assistant. The user is working on a task and needs help.

Context:
${JSON.stringify(context, null, 2)}

User question: ${userMessage}

Provide a helpful, concise response that helps the user complete their task. If you reference specific information from the context, be clear about it. Keep your response focused and actionable.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      return response.data;
    },
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response
      }]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage
    }]);
    setInput('');
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-[#00E5FF]" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-[#00E5FF] text-[#121212]'
                  : 'bg-[#1A1B1E] text-[#F5F5F5]'
              }`}
            >
              {message.role === 'assistant' ? (
                <ReactMarkdown className="text-sm prose prose-invert prose-sm max-w-none">
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {sendMessageMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div className="bg-[#1A1B1E] rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#A0AEC0]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about this task..."
          className="flex-1 min-h-[60px] max-h-[120px] bg-[#1A1B1E] border-[#2C2E33] resize-none"
          disabled={sendMessageMutation.isPending}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sendMessageMutation.isPending}
          className="bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#121212] h-[60px] px-4"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}