import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Package, DollarSign, Users, BookOpen, TrendingUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPageUrl } from '../utils';
import { Link } from 'react-router-dom';

export default function OfferingDetail() {
  const params = new URLSearchParams(window.location.search);
  const offeringId = params.get('id');
  const offeringType = params.get('type');

  const { data: offering, isLoading } = useQuery({
    queryKey: ['offering', offeringId, offeringType],
    queryFn: async () => {
      if (offeringType === 'product') {
        const products = await base44.entities.Product.filter({ id: offeringId });
        return products[0];
      } else {
        const services = await base44.entities.Service.filter({ id: offeringId });
        return services[0];
      }
    },
    enabled: !!offeringId && !!offeringType
  });

  const { data: clientOfferings = [] } = useQuery({
    queryKey: ['client-offerings', offeringId],
    queryFn: () => base44.entities.ClientOffering.filter({ offering_id: offeringId }),
    enabled: !!offeringId
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['offering-clients', offeringId],
    queryFn: async () => {
      const clientIds = clientOfferings.map(co => co.client_id);
      if (clientIds.length === 0) return [];
      return base44.entities.Client.filter({ id: { $in: clientIds } });
    },
    enabled: clientOfferings.length > 0
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#2C2E33] rounded w-1/3" />
          <div className="h-40 bg-[#2C2E33] rounded" />
        </div>
      </div>
    );
  }

  if (!offering) {
    return (
      <div className="p-6">
        <p className="text-[#A0AEC0]">Offering not found</p>
      </div>
    );
  }

  const activeClients = clientOfferings.filter(co => co.status === 'active').length;
  const totalRevenue = clientOfferings.reduce((sum, co) => sum + (co.current_contract_value || 0), 0);
  const churnedClients = clientOfferings.filter(co => co.status === 'churned').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Offerings')}>
            <Button variant="ghost" size="icon" className="hover:bg-[#2C2E33]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{offering.name}</h1>
            <p className="text-sm text-[#A0AEC0] capitalize">{offeringType} • {offering.category || 'Uncategorized'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
            Edit
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="neumorphic-raised rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#00E5FF]" />
            <span className="text-xs text-[#A0AEC0]">Active Clients</span>
          </div>
          <p className="text-2xl font-bold">{activeClients}</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-[#A0AEC0]">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold">${(totalRevenue || 0).toLocaleString()}</p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#BD00FF]" />
            <span className="text-xs text-[#A0AEC0]">Churn Rate</span>
          </div>
          <p className="text-2xl font-bold">
            {clientOfferings.length > 0 ? ((churnedClients / clientOfferings.length) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="neumorphic-raised rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-[#A0AEC0]">Base Price</span>
          </div>
          <p className="text-2xl font-bold">${(offering.base_price || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-[#2C2E33]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing & Packaging</TabsTrigger>
          <TabsTrigger value="clients">Client Usage</TabsTrigger>
          <TabsTrigger value="assets">Related Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="neumorphic-raised rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3">Description</h3>
            <p className="text-[#A0AEC0] mb-4">{offering.short_description}</p>
            <p className="text-[#E0E0E0] leading-relaxed">{offering.description}</p>
          </div>

          {offering.features && offering.features.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-3">Key Features</h3>
              <ul className="space-y-2">
                {offering.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#00E5FF] mt-1">•</span>
                    <span className="text-[#E0E0E0]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offering.target_audience && offering.target_audience.length > 0 && (
            <div className="neumorphic-raised rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-3">Target Audience</h3>
              <div className="flex flex-wrap gap-2">
                {offering.target_audience.map((audience, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-full bg-[#2C2E33] text-sm text-[#00E5FF]">
                    {audience}
                  </span>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          <div className="neumorphic-raised rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3">Pricing Model</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#A0AEC0]">Base Price</span>
                <span className="text-xl font-bold">${(offering.base_price || 0).toLocaleString()} {offering.currency}</span>
              </div>
              {offering.pricing_model && (
                <div className="neumorphic-pressed rounded-lg p-4 mt-4">
                  <pre className="text-xs text-[#E0E0E0] overflow-x-auto">
                    {JSON.stringify(offering.pricing_model, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 mt-4">
          <div className="neumorphic-raised rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Clients Using This Offering</h3>
            {clientOfferings.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-[#4A5568] mx-auto mb-2" />
                <p className="text-[#A0AEC0]">No clients using this offering yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientOfferings.map((co) => {
                  const client = clients.find(c => c.id === co.client_id);
                  return (
                    <div key={co.id} className="neumorphic-pressed rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{client?.name || 'Unknown Client'}</p>
                        <p className="text-xs text-[#A0AEC0]">
                          Started: {co.start_date ? new Date(co.start_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          co.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          co.status === 'churned' ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {co.status}
                        </span>
                        <p className="text-sm font-bold mt-1">
                          ${(co.current_contract_value || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4 mt-4">
          <div className="neumorphic-raised rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Related Assets</h3>
            <div className="space-y-4">
              {offering.associated_workflows && offering.associated_workflows.length > 0 && (
                <div>
                  <p className="text-sm text-[#A0AEC0] mb-2">Associated Workflows</p>
                  <p className="text-xs text-[#4A5568]">{offering.associated_workflows.length} workflows linked</p>
                </div>
              )}
              {offering.related_documents && offering.related_documents.length > 0 && (
                <div>
                  <p className="text-sm text-[#A0AEC0] mb-2">Related Documents</p>
                  <p className="text-xs text-[#4A5568]">{offering.related_documents.length} documents linked</p>
                </div>
              )}
              {offering.upsell_opportunities && offering.upsell_opportunities.length > 0 && (
                <div>
                  <p className="text-sm text-[#A0AEC0] mb-2">Upsell Opportunities</p>
                  <p className="text-xs text-[#4A5568]">{offering.upsell_opportunities.length} offerings</p>
                </div>
              )}
              {(!offering.associated_workflows || offering.associated_workflows.length === 0) &&
               (!offering.related_documents || offering.related_documents.length === 0) &&
               (!offering.upsell_opportunities || offering.upsell_opportunities.length === 0) && (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-[#4A5568] mx-auto mb-2" />
                  <p className="text-[#A0AEC0]">No related assets configured</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}