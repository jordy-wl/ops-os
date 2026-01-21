import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, X, Mail, Phone, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function DealContactsPanel({ dealId, clientId, selectedContactIds = [], onUpdate }) {
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: ''
  });

  const queryClient = useQueryClient();

  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      const relations = await base44.entities.ClientContact.filter({ client_id: clientId });
      const contactIds = relations.map(r => r.contact_id);
      
      if (contactIds.length === 0) return [];
      
      const contacts = await Promise.all(
        contactIds.map(id => base44.entities.Contact.filter({ id }))
      );
      
      return contacts.flat();
    },
    enabled: !!clientId
  });

  const createContactMutation = useMutation({
    mutationFn: async (contactData) => {
      // Create the contact
      const contact = await base44.entities.Contact.create(contactData);
      
      // Link to client
      await base44.entities.ClientContact.create({
        client_id: clientId,
        contact_id: contact.id,
        role: 'other'
      });
      
      return contact;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      onUpdate({ deal_contacts: [...selectedContactIds, contact.id] });
      setIsAddingContact(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        job_title: ''
      });
      toast.success('Contact added');
    },
    onError: () => {
      toast.error('Failed to add contact');
    }
  });

  const selectedContacts = clientContacts.filter(contact => 
    selectedContactIds.includes(contact.id)
  );

  const toggleContact = (contactId) => {
    const newSelection = selectedContactIds.includes(contactId)
      ? selectedContactIds.filter(id => id !== contactId)
      : [...selectedContactIds, contactId];
    
    onUpdate({ deal_contacts: newSelection });
  };

  const handleCreateContact = () => {
    if (!newContact.email) {
      toast.error('Email is required');
      return;
    }
    createContactMutation.mutate(newContact);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Deal Contacts</h3>
        <Button
          onClick={() => setIsAddingContact(true)}
          size="sm"
          className="bg-[#2C2E33] hover:bg-[#3a3d44] text-[#00E5FF]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Selected Contacts */}
      {selectedContacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-[#A0AEC0]">Selected Contacts ({selectedContacts.length})</p>
          {selectedContacts.map(contact => (
            <div key={contact.id} className="neumorphic-pressed rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-xs text-[#A0AEC0]">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs text-[#A0AEC0]">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                    {contact.job_title && (
                      <div className="flex items-center gap-2 text-xs text-[#A0AEC0]">
                        <Briefcase className="w-3 h-3" />
                        {contact.job_title}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleContact(contact.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Contacts */}
      <div>
        <p className="text-sm text-[#A0AEC0] mb-2">Available Contacts</p>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {clientContacts
            .filter(contact => !selectedContactIds.includes(contact.id))
            .map(contact => (
              <div
                key={contact.id}
                onClick={() => toggleContact(contact.id)}
                className="neumorphic-raised rounded-lg p-3 cursor-pointer hover:bg-[#2C2E33] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      {contact.email && (
                        <span className="text-xs text-[#A0AEC0]">{contact.email}</span>
                      )}
                      {contact.job_title && (
                        <Badge className="bg-[#2C2E33] text-[#A0AEC0] text-xs">
                          {contact.job_title}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-[#00E5FF] flex-shrink-0" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Add Contact Modal */}
      <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
        <DialogContent className="bg-[#2C2E33] border-[#3a3d44]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#A0AEC0] mb-2 block">First Name</label>
                <Input
                  value={newContact.first_name}
                  onChange={(e) => setNewContact({...newContact, first_name: e.target.value})}
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>
              <div>
                <label className="text-sm text-[#A0AEC0] mb-2 block">Last Name</label>
                <Input
                  value={newContact.last_name}
                  onChange={(e) => setNewContact({...newContact, last_name: e.target.value})}
                  className="bg-[#1A1B1E] border-[#2C2E33]"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Email *</label>
              <Input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Phone</label>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A0AEC0] mb-2 block">Job Title</label>
              <Input
                value={newContact.job_title}
                onChange={(e) => setNewContact({...newContact, job_title: e.target.value})}
                className="bg-[#1A1B1E] border-[#2C2E33]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddingContact(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateContact}
                disabled={!newContact.email || createContactMutation.isPending}
                className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
              >
                Add Contact
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}