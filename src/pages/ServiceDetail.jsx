import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Wrench, Edit, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ServiceDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('id');

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => base44.entities.Service.list().then(services => services.find(s => s.id === serviceId)),
    enabled: !!serviceId,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#2C2E33] rounded w-1/4" />
          <div className="h-64 bg-[#2C2E33] rounded" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6">
        <div className="neumorphic-pressed rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-[#4A5568] mx-auto mb-4" />
          <h3 className="font-medium mb-2">Service Not Found</h3>
          <Button onClick={() => navigate(createPageUrl('Offerings'))} className="mt-4">
            Back to Offerings
          </Button>
        </div>
      </div>
    );
  }

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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold mb-2">{service.name}</h1>
              <p className="text-sm text-[#A0AEC0] capitalize">
                {service.category?.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
              <Archive className="w-4 h-4 mr-2" />
              {service.is_active ? 'Archive' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="neumorphic-pressed rounded-xl p-5 text-center">
              <p className="text-[#A0AEC0] text-xs mb-1">Pricing Model</p>
              <p className="capitalize font-medium">
                {service.pricing_model?.replace('_', ' ') || '—'}
              </p>
            </div>
            <div className="neumorphic-pressed rounded-xl p-5 text-center">
              <p className="text-[#A0AEC0] text-xs mb-1">Base Price</p>
              <p className="font-mono font-semibold text-lg">
                {service.base_price ? `$${service.base_price.toLocaleString()} ${service.currency || 'USD'}` : '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          {service.description && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Description</h3>
              <p className="text-[#F5F5F5]">{service.description}</p>
            </div>
          )}

          {/* Features Included */}
          {service.features_included && service.features_included.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Features Included</h3>
              <ul className="space-y-2">
                {service.features_included.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] mt-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deliverables */}
          {service.deliverables && service.deliverables.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Deliverables</h3>
              <ul className="space-y-2">
                {service.deliverables.map((deliverable, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] mt-2" />
                    <span>{deliverable}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Target Audience */}
          {service.target_audience && service.target_audience.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Target Audience</h3>
              <div className="flex flex-wrap gap-2">
                {service.target_audience.map((audience, idx) => (
                  <span key={idx} className="px-3 py-1 bg-[#2C2E33] rounded-full text-sm">
                    {audience}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}