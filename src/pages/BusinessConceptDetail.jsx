import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Lightbulb, Edit, Package, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BusinessConceptDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const conceptId = urlParams.get('id');

  const { data: concept, isLoading: conceptLoading } = useQuery({
    queryKey: ['business-concept', conceptId],
    queryFn: () => base44.entities.BusinessConcept.list().then(concepts => concepts.find(c => c.id === conceptId)),
    enabled: !!conceptId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: !!concept?.associated_product_ids?.length,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
    enabled: !!concept?.associated_service_ids?.length,
  });

  if (conceptLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#2C2E33] rounded w-1/4" />
          <div className="h-64 bg-[#2C2E33] rounded" />
        </div>
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="p-6">
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <Lightbulb className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Concept Not Found</h3>
          <Button onClick={() => navigate(createPageUrl('Offerings'))} className="mt-4">
            Back to Offerings
          </Button>
        </div>
      </div>
    );
  }

  const associatedProducts = products.filter(p => concept.associated_product_ids?.includes(p.id));
  const associatedServices = services.filter(s => concept.associated_service_ids?.includes(s.id));

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(createPageUrl('Offerings'))}
        className="mb-6 text-[#A0AEC0] hover:text-[#F5F5F5] text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Offerings
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold mb-2">{concept.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[#A0AEC0]">
                <span className="capitalize">{concept.type?.replace('_', ' ')}</span>
                {concept.version && (
                  <>
                    <span>•</span>
                    <span>Version {concept.version}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Description */}
          {concept.description && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Description</h3>
              <p className="text-[#F5F5F5]">{concept.description}</p>
            </div>
          )}

          {/* Associated Products */}
          {associatedProducts.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Associated Products</h3>
              <div className="space-y-3">
                {associatedProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => navigate(createPageUrl('ProductDetail') + `?id=${product.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#1A1B1E] hover:bg-[#2C2E33] cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-[#A0AEC0]">{product.sku}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Associated Services */}
          {associatedServices.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Associated Services</h3>
              <div className="space-y-3">
                {associatedServices.map(service => (
                  <div
                    key={service.id}
                    onClick={() => navigate(createPageUrl('ServiceDetail') + `?id=${service.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#1A1B1E] hover:bg-[#2C2E33] cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-[#A0AEC0] capitalize">
                        {service.category?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Info */}
          {concept.last_reviewed_date && (
            <div className="neumorphic-pressed rounded-xl p-4 text-sm text-[#A0AEC0]">
              Last reviewed: {new Date(concept.last_reviewed_date).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}