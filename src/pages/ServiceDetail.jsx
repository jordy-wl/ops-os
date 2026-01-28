import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Wrench, 
  Edit, 
  Trash2, 
  DollarSign, 
  Calendar, 
  Tag,
  CheckCircle,
  Users,
  GitMerge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import CreateServiceModal from '@/components/offerings/CreateServiceModal';
import PricingOptionsManager from '@/components/offerings/PricingOptionsManager';

export default function ServiceDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('id');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => base44.entities.Service.list().then(services => services.find(s => s.id === serviceId)),
    enabled: !!serviceId
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list(),
    enabled: !!service?.associated_workflows?.length
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Service.delete(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted');
      navigate(createPageUrl('Offerings') + '?tab=services');
    }
  });

  const associatedWorkflows = workflows.filter(w => service?.associated_workflows?.includes(w.id));

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-32 bg-[#2C2E33] rounded animate-pulse mb-6" />
          <div className="h-64 bg-[#2C2E33] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4">Service Not Found</h1>
          <Button onClick={() => navigate(createPageUrl('Offerings'))}>
            Back to Offerings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('Offerings') + '?tab=services')}
            className="text-[#A0AEC0] hover:text-[#F5F5F5]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
            className="border-[#2C2E33] text-[#F5F5F5]"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Main Content */}
        <div className="neumorphic-raised rounded-2xl p-8 mb-6">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-semibold mb-2">{service.name}</h1>
              {service.short_description && (
                <p className="text-lg text-[#A0AEC0] mb-4">{service.short_description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {service.category && (
                  <Badge className="bg-orange-500/20 text-orange-400">
                    <Tag className="w-3 h-3 mr-1" />
                    {service.category.replace('_', ' ')}
                  </Badge>
                )}
                {service.calculation_method && (
                  <Badge className="bg-[#2C2E33] text-[#A0AEC0]">
                    {service.calculation_method.replace('_', ' ')}
                  </Badge>
                )}
                {service.frequency && (
                  <Badge className="bg-[#2C2E33] text-[#A0AEC0]">
                    <Calendar className="w-3 h-3 mr-1" />
                    {service.frequency.replace('_', ' ')}
                  </Badge>
                )}
                {service.is_active !== undefined && (
                  <Badge className={service.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Pricing Options */}
          <div className="col-span-2 neumorphic-raised rounded-xl p-6">
            <PricingOptionsManager serviceId={serviceId} isEditing={false} />
          </div>

          {/* Description */}
          {service.description && (
            <div className="col-span-2 neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Description</h2>
              <p className="text-[#A0AEC0] whitespace-pre-wrap">{service.description}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="neumorphic-raised rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-400" />
              Pricing
            </h2>
            <div className="space-y-3">
              {service.base_price && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Base Price</span>
                  <span className="font-mono">${service.base_price.toLocaleString()} {service.currency}</span>
                </div>
              )}
              {service.fee_value && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Fee Value</span>
                  <span className="font-mono">{service.fee_value}</span>
                </div>
              )}
              {service.minimum_fee && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Minimum Fee</span>
                  <span className="font-mono">${service.minimum_fee.toLocaleString()}</span>
                </div>
              )}
              {service.maximum_fee && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Maximum Fee</span>
                  <span className="font-mono">${service.maximum_fee.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {service.features?.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-400" />
                Features
              </h2>
              <ul className="space-y-2">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[#A0AEC0]">
                    <CheckCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Target Audience */}
          {service.target_audience?.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-400" />
                Target Audience
              </h2>
              <div className="flex flex-wrap gap-2">
                {service.target_audience.map((audience, idx) => (
                  <Badge key={idx} className="bg-[#2C2E33] text-[#A0AEC0]">
                    {audience}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Associated Workflows */}
          {associatedWorkflows.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-orange-400" />
                Associated Workflows
              </h2>
              <div className="space-y-2">
                {associatedWorkflows.map(workflow => (
                  <div key={workflow.id} className="flex items-center gap-2 text-sm text-[#A0AEC0]">
                    <GitMerge className="w-4 h-4" />
                    <span>{workflow.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateServiceModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editingService={service}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#2C2E33] border-[#3a3d44]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0AEC0]">
              This will permanently delete "{service.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}