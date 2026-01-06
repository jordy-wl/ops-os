import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function EditUserRoleModal({ isOpen, onClose, user, currentUserRole }) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(user?.role || 'user');

  const updateRoleMutation = useMutation({
    mutationFn: async (role) => {
      await base44.entities.User.update(user.id, { role });
      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update user role');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentUserRole !== 'admin') {
      toast.error('Only admins can change user roles');
      return;
    }
    if (selectedRole === user.role) {
      toast.info('No changes made');
      onClose();
      return;
    }
    updateRoleMutation.mutate(selectedRole);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit User Role</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-[#A0AEC0] mb-1">User</p>
          <p className="font-medium">{user.full_name || user.email}</p>
          <p className="text-sm text-[#4A5568]">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Role
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0AEC0] z-10" />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33] pl-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                  <SelectItem value="user">User - Standard Access</SelectItem>
                  <SelectItem value="admin">Admin - Full Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
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
              disabled={updateRoleMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
            >
              {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}