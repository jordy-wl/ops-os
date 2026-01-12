import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SendFormPanel({ clientId, contacts }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedContact, setSelectedContact] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['form-templates-active'],
    queryFn: () => base44.entities.FormTemplate.filter({ is_active: true }),
  });

  const sendFormMutation = useMutation({
    mutationFn: ({ template_id, recipient_email }) => 
      base44.functions.invoke('createClientFormLink', {
        form_template_id: template_id,
        client_id: clientId,
        recipient_email
      }),
    onSuccess: () => {
      toast.success('Form sent successfully');
      queryClient.invalidateQueries({ queryKey: ['client-communications', clientId] });
      setSelectedTemplate('');
      setSelectedContact('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send form');
    }
  });

  const handleSend = () => {
    if (!selectedTemplate || !selectedContact) {
      toast.error('Please select a form template and contact');
      return;
    }

    const contact = contacts.find(c => c.id === selectedContact);
    sendFormMutation.mutate({
      template_id: selectedTemplate,
      recipient_email: contact.email
    });
  };

  return (
    <div className="neumorphic-raised rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-[#BD00FF]" />
        <h3 className="text-sm font-medium text-[#A0AEC0]">Send Client Form</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[#4A5568] mb-2">Form Template</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
              <SelectValue placeholder="Select form template" />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs text-[#4A5568] mb-2">Recipient</label>
          <Select value={selectedContact} onValueChange={setSelectedContact}>
            <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] text-sm">
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name} ({contact.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSend}
          disabled={!selectedTemplate || !selectedContact || sendFormMutation.isPending}
          className="w-full bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white text-sm"
        >
          {sendFormMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Form
            </>
          )}
        </Button>
      </div>
    </div>
  );
}