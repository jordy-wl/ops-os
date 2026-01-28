import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Package, 
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
import CreateProductModal from '@/components/offerings/CreateProductModal';

export default function ProductDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.list().then(products => products.find(p => p.id === productId)),
    enabled: !!productId
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => base44.entities.WorkflowTemplate.list(),
    enabled: !!product?.associated_workflows?.length
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Product.delete(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
      navigate(createPageUrl('Offerings') + '?tab=products');
    }
  });

  const associatedWorkflows = workflows.filter(w => product?.associated_workflows?.includes(w.id));

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

  if (!product) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4">Product Not Found</h1>
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
            onClick={() => navigate(createPageUrl('Offerings') + '?tab=products')}
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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#0099ff] flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-semibold mb-2">{product.name}</h1>
              {product.short_description && (
                <p className="text-lg text-[#A0AEC0] mb-4">{product.short_description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {product.category && (
                  <Badge className="bg-[#00E5FF]/20 text-[#00E5FF]">
                    <Tag className="w-3 h-3 mr-1" />
                    {product.category.replace('_', ' ')}
                  </Badge>
                )}
                {product.calculation_method && (
                  <Badge className="bg-[#2C2E33] text-[#A0AEC0]">
                    {product.calculation_method.replace('_', ' ')}
                  </Badge>
                )}
                {product.frequency && (
                  <Badge className="bg-[#2C2E33] text-[#A0AEC0]">
                    <Calendar className="w-3 h-3 mr-1" />
                    {product.frequency.replace('_', ' ')}
                  </Badge>
                )}
                {product.is_active !== undefined && (
                  <Badge className={product.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Description */}
          {product.description && (
            <div className="col-span-2 neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-3">Description</h2>
              <p className="text-[#A0AEC0] whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="neumorphic-raised rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#00E5FF]" />
              Pricing
            </h2>
            <div className="space-y-3">
              {product.base_price && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Base Price</span>
                  <span className="font-mono">${product.base_price.toLocaleString()} {product.currency}</span>
                </div>
              )}
              {product.fee_value && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Fee Value</span>
                  <span className="font-mono">{product.fee_value}</span>
                </div>
              )}
              {product.minimum_fee && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Minimum Fee</span>
                  <span className="font-mono">${product.minimum_fee.toLocaleString()}</span>
                </div>
              )}
              {product.maximum_fee && (
                <div className="flex justify-between">
                  <span className="text-[#A0AEC0]">Maximum Fee</span>
                  <span className="font-mono">${product.maximum_fee.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          {product.features?.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#00E5FF]" />
                Features
              </h2>
              <ul className="space-y-2">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[#A0AEC0]">
                    <CheckCircle className="w-4 h-4 text-[#00E5FF] mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Target Audience */}
          {product.target_audience?.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00E5FF]" />
                Target Audience
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.target_audience.map((audience, idx) => (
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
                <GitMerge className="w-5 h-5 text-[#00E5FF]" />
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
      <CreateProductModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editingProduct={product}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#2C2E33] border-[#3a3d44]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A0AEC0]">
              This will permanently delete "{product.name}". This action cannot be undone.
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