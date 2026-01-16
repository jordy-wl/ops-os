import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { DollarSign, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stageColors = {
  prospecting: 'bg-[#2C2E33] text-[#A0AEC0] border-[#3a3d44]',
  qualified: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  proposal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  negotiation: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ClientDealsPanel({ clientId }) {
  const { data: deals = [] } = useQuery({
    queryKey: ['client-deals', clientId],
    queryFn: () => base44.entities.Deal.filter({ client_id: clientId }, '-created_date', 50),
    enabled: !!clientId,
  });

  const { data: clientOfferings = [] } = useQuery({
    queryKey: ['client-offerings', clientId],
    queryFn: () => base44.entities.ClientOffering.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const closedDeals = deals.filter(d => ['closed_won', 'closed_lost'].includes(d.stage));

  return (
    <div className="space-y-4">
      {/* Create New Deal Button */}
      <Link to={createPageUrl('DealBuilder') + `?client=${clientId}`}>
        <Button className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-500/30">
          <Plus className="w-4 h-4 mr-2" />
          Create New Deal
        </Button>
      </Link>

      {/* Active Purchases/Offerings */}
      {clientOfferings.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[#A0AEC0] mb-2 uppercase tracking-wide">Active Purchases</h4>
          <div className="space-y-2">
            {clientOfferings.filter(co => co.status === 'active').map((offering) => (
              <div key={offering.id} className="neumorphic-pressed rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {offering.offering_type === 'product' ? '📦' : '🔧'} Offering
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 capitalize">
                        {offering.status}
                      </span>
                      {offering.current_contract_value && (
                        <span className="text-xs text-[#A0AEC0]">
                          ${offering.current_contract_value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Deals */}
      {activeDeals.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[#A0AEC0] mb-2 uppercase tracking-wide">Active Deals</h4>
          <div className="space-y-2">
            {activeDeals.map((deal) => (
              <Link
                key={deal.id}
                to={createPageUrl('DealBuilder') + `?id=${deal.id}`}
                className="block neumorphic-pressed rounded-lg p-3 hover:bg-[#2C2E33] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deal.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${stageColors[deal.stage] || stageColors.prospecting}`}>
                        {deal.stage?.replace('_', ' ')}
                      </span>
                      {deal.probability !== null && deal.probability !== undefined && (
                        <span className="text-xs text-[#4A5568]">{deal.probability}%</span>
                      )}
                    </div>
                    {deal.total_expected_value && (
                      <p className="text-xs text-[#A0AEC0] mt-1">
                        ${deal.total_expected_value.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Closed Deals */}
      {closedDeals.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[#A0AEC0] mb-2 uppercase tracking-wide">Closed Deals</h4>
          <div className="space-y-2">
            {closedDeals.slice(0, 3).map((deal) => (
              <Link
                key={deal.id}
                to={createPageUrl('DealBuilder') + `?id=${deal.id}`}
                className="block neumorphic-pressed rounded-lg p-3 hover:bg-[#2C2E33] transition-colors opacity-75"
              >
                <div className="flex items-start gap-3">
                  <DollarSign className={`w-4 h-4 mt-0.5 flex-shrink-0 ${deal.stage === 'closed_won' ? 'text-green-400' : 'text-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deal.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${stageColors[deal.stage]}`}>
                        {deal.stage?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {deals.length === 0 && clientOfferings.length === 0 && (
        <div className="neumorphic-pressed rounded-lg p-8 text-center">
          <TrendingUp className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
          <p className="text-sm text-[#A0AEC0]">No deals yet</p>
          <p className="text-xs text-[#4A5568] mt-1">Create a deal to start tracking revenue</p>
        </div>
      )}
    </div>
  );
}