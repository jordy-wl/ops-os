import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AIInsightCard from '@/components/AIInsightCard';
import ProactiveInsightsWidget from '@/components/ai/ProactiveInsightsWidget';
import OfferingRecommendations from './OfferingRecommendations';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      {/* Proactive AI Insights */}
      <ProactiveInsightsWidget clientId={clientId} />

      {/* Next Best Action */}
      {client.next_best_action && (
        <AIInsightCard
          type="recommendation"
          title="Next Best Action"
          content={client.next_best_action}
          severity="opportunity"
        />
      )}

      {/* Health Indicators */}
      {((client.risk_score !== null && client.risk_score !== undefined) || client.sentiment_score) && (
        <div className="neumorphic-raised rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#A0AEC0] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Health Indicators
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(client.risk_score !== null && client.risk_score !== undefined) && (
              <div className="neumorphic-pressed rounded-lg p-3 text-center">
                <p className="text-xs text-[#4A5568] mb-1">Risk Score</p>
                <p className={`text-2xl font-bold ${
                  client.risk_score > 70 ? 'text-red-400' : 
                  client.risk_score > 40 ? 'text-yellow-400' : 
                  'text-green-400'
                }`}>
                  {client.risk_score}
                </p>
              </div>
            )}
            {client.sentiment_score && (
              <div className="neumorphic-pressed rounded-lg p-3 text-center">
                <p className="text-xs text-[#4A5568] mb-1">Sentiment</p>
                <p className={`text-lg font-semibold capitalize ${
                  client.sentiment_score === 'positive' ? 'text-green-400' :
                  client.sentiment_score === 'negative' ? 'text-red-400' : 
                  'text-yellow-400'
                }`}>
                  {client.sentiment_score}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offering Recommendations */}
      <OfferingRecommendations 
        clientId={clientId}
        clientName={client.name}
        insights={client.insights}
      />

      {/* Historical Summaries */}
      {client.summary_history && client.summary_history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[#A0AEC0] flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Historical Summaries
          </h3>
          {client.summary_history.slice(-3).reverse().map((summary, idx) => (
            <AIInsightCard
              key={idx}
              type="summary"
              title={`${summary.workflow_name} - ${summary.stage_name}`}
              content={summary.summary_text}
              severity="info"
            />
          ))}
        </div>
      )}
    </div>
  );
}