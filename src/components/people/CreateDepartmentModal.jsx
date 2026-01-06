import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function CreateDepartmentModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    lead_user_id: '',
    color: '#BD00FF',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Department.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created successfully');
      onClose();
      setFormData({ name: '', code: '', description: '', lead_user_id: '', color: '#BD00FF' });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create department');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Department name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="glass rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#BD00FF] to-[#8B00CC] flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Create Department</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#2C2E33]">
            <X className="w-5 h-5 text-[#A0AEC0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Department Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Engineering"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Department Code
            </label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., ENG"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Department Lead
            </label>
            <Select 
              value={formData.lead_user_id} 
              onValueChange={(v) => setFormData({ ...formData, lead_user_id: v })}
            >
              <SelectTrigger className="bg-[#1A1B1E] border-[#2C2E33]">
                <SelectValue placeholder="Select department lead" />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2E33] border-[#3a3d44]">
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this department responsible for?"
              className="bg-[#1A1B1E] border-[#2C2E33] focus:border-[#00E5FF] h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A0AEC0] mb-2">
              Department Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-12 h-12 rounded-lg cursor-pointer bg-[#1A1B1E] border-2 border-[#2C2E33]"
              />
              <span className="text-sm text-[#A0AEC0] font-mono">{formData.color}</span>
            </div>
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
              disabled={createMutation.isPending}
              className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Department'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}