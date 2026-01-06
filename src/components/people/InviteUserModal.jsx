import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Mail, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function InviteUserModal({ isOpen, onClose, currentUserRole }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email: '',
    role: 'operator',
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      console.log('Inviting user:', email, 'with role:', role);
      try {
        const result = await base44.users.inviteUser(email, role);
        console.log('Invite successful:', result);
        return { email, role };
      } catch (error) {
        console.error('Invite error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Invitation email sent to ${data.email}. They will receive an email to join the app.`);
      onClose();
      setFormData({ email: '', role: 'operator' });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error(error.message || 'Failed to send invitation. Please try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }
    inviteMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#0099ff] flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[#121212]" />
            </div>
            <h2 className="text-xl font-bold">Invite User</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0]" />
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Role *
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0] z-10" />
              <Select 
                value={formData.role} 
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] pl-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem 
                    value="admin"
                    disabled={currentUserRole !== 'admin'}
                  >
                    Admin - Full System Access {currentUserRole !== 'admin' && '(Admins Only)'}
                  </SelectItem>
                  <SelectItem 
                    value="workflow_designer"
                    disabled={currentUserRole !== 'admin'}
                  >
                    Workflow Designer - Create & Edit Templates {currentUserRole !== 'admin' && '(Admins Only)'}
                  </SelectItem>
                  <SelectItem 
                    value="manager"
                    disabled={currentUserRole !== 'admin'}
                  >
                    Manager - Assign Workflows & Edit Instances {currentUserRole !== 'admin' && '(Admins Only)'}
                  </SelectItem>
                  <SelectItem value="operator">
                    Operator - Complete Tasks & Edit Fields
                  </SelectItem>
                  <SelectItem value="viewer">
                    Viewer - Read-Only Access
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {currentUserRole !== 'admin' && (
              <p className="text-xs text-[#4A5568] mt-2">
                Only administrators can assign Admin, Workflow Designer, or Manager roles
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={inviteMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}