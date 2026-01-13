import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function AddContactModal({ isOpen, onClose, clientId, contact }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(contact || {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    linkedin_url: '',
    notes: '',
    is_primary: false,
    role: 'other'
  });

  const createContactMutation = useMutation({
    mutationFn: async (data) => {
      // Create or update Contact
      let contactId = contact?.id;
      if (contact) {
        await base44.entities.Contact.update(contact.id, {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          job_title: data.job_title,
          linkedin_url: data.linkedin_url,
          notes: data.notes
        });
      } else {
        const newContact = await base44.entities.Contact.create({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          job_title: data.job_title,
          linkedin_url: data.linkedin_url,
          notes: data.notes
        });
        contactId = newContact.id;
      }

      // Create or update ClientContact link
      if (!contact) {
        await base44.entities.ClientContact.create({
          client_id: clientId,
          contact_id: contactId,
          role: data.role,
          is_primary: data.is_primary
        });
      } else {
        // Find existing ClientContact and update it
        const clientContacts = await base44.entities.ClientContact.filter({ 
          client_id: clientId, 
          contact_id: contactId 
        });
        if (clientContacts.length > 0) {
          await base44.entities.ClientContact.update(clientContacts[0].id, {
            role: data.role,
            is_primary: data.is_primary
          });
        }
      }

      return contactId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast.success(contact ? 'Contact updated' : 'Contact added');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }
    createContactMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl w-full max-w-2xl relative z-10 shadow-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#00E5FF]" />
            {contact ? 'Edit Contact' : 'Add New Contact'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">First Name</label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="John"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Last Name</label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Smith"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.smith@company.com"
                className="bg-[#1A1B1E] border-[#2C2E33]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Job Title</label>
              <Input
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="CEO"
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Role</label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="decision_maker">Decision Maker</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">LinkedIn URL</label>
            <Input
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/johnsmith"
              className="bg-[#1A1B1E] border-[#2C2E33]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this contact..."
              className="bg-[#1A1B1E] border-[#2C2E33] h-20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
              className="w-4 h-4 rounded border-[#2C2E33] bg-[#1A1B1E]"
            />
            <label htmlFor="is_primary" className="text-sm text-[#A0AEC0]">
              Set as primary contact
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-[#2C2E33] text-[#F5F5F5]">
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createContactMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
            >
              {createContactMutation.isPending ? 'Saving...' : contact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}