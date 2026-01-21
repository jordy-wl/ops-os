import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AIInsightCard from '@/components/AIInsightCard';
import ProactiveInsightsWidget from '@/components/ai/ProactiveInsightsWidget';
import OfferingRecommendations from './OfferingRecommendations';
import { Sparkles, TrendingUp, AlertTriangle, Package, Zap, Activity, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const InsightCard = ({ title, icon: Icon, children, defaultOpen = false, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="neumorphic-raised rounded-xl overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-[#2C2E33]/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00E5FF]/10">
              <Icon className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold">{title}</h3>
              {count !== undefined && (
                <p className="text-xs text-[#4A5568]">{count} {count === 1 ? 'insight' : 'insights'}</p>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-[#A0AEC0]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#A0AEC0]" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 border-t border-[#2C2E33]/50">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default function ClientInsightsPanel({ clientId }) {
  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0];
    },
    enabled: !!clientId,
  });

  if (!client) return null;

  const hasHealthData = (client.risk_score !== null && client.risk_score !== undefined) || client.sentiment_score;
  const historicalSummaries = client.summary_history?.slice(-3).reverse() || [];

  return (
    <div className="space-y-3">
      {/* AI Offering Recommendations */}
      <InsightCard
        title="AI Offering Recommendations"
        icon={Package}
        defaultOpen={true}
        count={client.insights?.offering_recommendations?.length}
      >
        <OfferingRecommendations 
          clientId={clientId}
          clientName={client.name}
          insights={client.insights}
        />
      </InsightCard>

      {/* Proactive AI Insights */}
      <InsightCard
        title="Proactive AI Insights"
        icon={Zap}
        defaultOpen={false}
      >
        <ProactiveInsightsWidget clientId={clientId} />
      </InsightCard>

      {/* Next Best Action */}
      {client.next_best_action && (
        <InsightCard
          title="Next Best Action"
          icon={Sparkles}
          defaultOpen={false}
        >
          <AIInsightCard
            type="recommendation"
            title="Recommended Action"
            content={client.next_best_action}
            severity="opportunity"
          />
        </InsightCard>
      )}

      {/* Client Health Summary */}
      {hasHealthData && (
        <InsightCard
          title="Client Health Summary"
          icon={Activity}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-3">
            {(client.risk_score !== null && client.risk_score !== undefined) && (
              <div className="neumorphic-pressed rounded-lg p-4 text-center">
                <p className="text-xs text-[#4A5568] mb-2">Risk Score</p>
                <p className={`text-3xl font-bold ${
                  client.risk_score > 70 ? 'text-red-400' : 
                  client.risk_score > 40 ? 'text-yellow-400' : 
                  'text-green-400'
                }`}>
                  {client.risk_score}
                </p>
                <p className="text-xs text-[#A0AEC0] mt-1">
                  {client.risk_score > 70 ? 'High Risk' : 
                   client.risk_score > 40 ? 'Medium Risk' : 
                   'Low Risk'}
                </p>
              </div>
            )}
            {client.sentiment_score && (
              <div className="neumorphic-pressed rounded-lg p-4 text-center">
                <p className="text-xs text-[#4A5568] mb-2">Sentiment</p>
                <p className={`text-2xl font-semibold capitalize ${
                  client.sentiment_score === 'positive' ? 'text-green-400' :
                  client.sentiment_score === 'negative' ? 'text-red-400' : 
                  'text-yellow-400'
                }`}>
                  {client.sentiment_score}
                </p>
              </div>
            )}
          </div>
        </InsightCard>
      )}

      {/* Historical Summaries */}
      {historicalSummaries.length > 0 && (
        <InsightCard
          title="Historical Summaries"
          icon={History}
          defaultOpen={false}
          count={historicalSummaries.length}
        >
          <div className="space-y-3">
            {historicalSummaries.map((summary, idx) => (
              <AIInsightCard
                key={idx}
                type="summary"
                title={`${summary.workflow_name} - ${summary.stage_name}`}
                content={summary.summary_text}
                severity="info"
              />
            ))}
          </div>
        </InsightCard>
      )}

      {/* Empty State */}
      {!client.insights?.offering_recommendations?.length && 
       !client.next_best_action && 
       !hasHealthData && 
       historicalSummaries.length === 0 && (
        <div className="neumorphic-raised rounded-xl p-8 text-center">
          <Sparkles className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
          <p className="text-[#A0AEC0] mb-2">No insights available yet</p>
          <p className="text-xs text-[#4A5568]">AI insights will appear here as the system analyzes client data</p>
        </div>
      )}
    </div>
  );
}