import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Palette, Trash2, Edit } from 'lucide-react';

export default function BrandKits() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
    primary_color: '#00E5FF',
    secondary_color: '#BD00FF',
    accent_color: '#F5F5F5',
    font_family: 'Inter, sans-serif',
    font_family_heading: 'Poppins, sans-serif',
    is_default: false
  });

  const queryClient = useQueryClient();

  const { data: brandKits = [] } = useQuery({
    queryKey: ['brand-kits'],
    queryFn: () => base44.entities.BrandKit.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BrandKit.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BrandKit.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BrandKit.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logo_url: '',
      primary_color: '#00E5FF',
      secondary_color: '#BD00FF',
      accent_color: '#F5F5F5',
      font_family: 'Inter, sans-serif',
      font_family_heading: 'Poppins, sans-serif',
      is_default: false
    });
    setEditingKit(null);
    setIsModalOpen(false);
  };

  const handleEdit = (kit) => {
    setEditingKit(kit);
    setFormData({
      name: kit.name || '',
      description: kit.description || '',
      logo_url: kit.logo_url || '',
      primary_color: kit.primary_color || '#00E5FF',
      secondary_color: kit.secondary_color || '#BD00FF',
      accent_color: kit.accent_color || '#F5F5F5',
      font_family: kit.font_family || 'Inter, sans-serif',
      font_family_heading: kit.font_family_heading || 'Poppins, sans-serif',
      is_default: kit.is_default || false
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (editingKit) {
      updateMutation.mutate({ id: editingKit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#F5F5F5]">Brand Kits</h1>
          <p className="text-sm text-[#A0AEC0] mt-1">Manage branding for document generation</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Brand Kit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brandKits.map((kit) => (
          <Card key={kit.id} className="bg-[#1A1B1E] border-[#2C2E33]">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-[#00E5FF]" />
                  <CardTitle className="text-base">{kit.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(kit)}
                    className="h-7 w-7"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(kit.id)}
                    className="h-7 w-7 text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <div className="w-8 h-8 rounded" style={{ backgroundColor: kit.primary_color }} />
                <div className="w-8 h-8 rounded" style={{ backgroundColor: kit.secondary_color }} />
                <div className="w-8 h-8 rounded border border-[#2C2E33]" style={{ backgroundColor: kit.accent_color }} />
              </div>
              <p className="text-xs text-[#A0AEC0]">{kit.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-[#1A1B1E] border-[#2C2E33]">
          <DialogHeader>
            <DialogTitle>{editingKit ? 'Edit Brand Kit' : 'Create Brand Kit'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-[#121212] border-[#2C2E33]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#121212] border-[#2C2E33]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Logo URL</label>
              <Input
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://..."
                className="bg-[#121212] border-[#2C2E33]"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Primary Color</label>
                <Input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Secondary Color</label>
                <Input
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="h-10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A0AEC0] mb-2">Accent Color</label>
                <Input
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingKit ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}