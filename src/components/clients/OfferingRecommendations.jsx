import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, Package, ShoppingBag, Lightbulb, Loader2, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OfferingRecommendations({ clientId, clientName, insights }) {
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('aiMatchOfferings', { 
        client_id: clientId 
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('AI recommendations generated');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate recommendations');
    },
  });

  const recommendations = insights?.offering_recommendations || [];
  const lastAnalyzed = insights?.offering_analysis_date;

  const getOfferingIcon = (type) => {
    switch (type) {
      case 'concept': return Lightbulb;
      case 'product': return Package;
      case 'service': return ShoppingBag;
      default: return Package;
    }
  };

  const priorityConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
    low: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#BD00FF]" />
            AI Offering Recommendations
          </h3>
          {lastAnalyzed && (
            <p className="text-xs text-[#A0AEC0] mt-1">
              Last analyzed: {new Date(lastAnalyzed).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          size="sm"
          className="bg-gradient-to-r from-[#BD00FF] to-[#9000cc] text-white"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Recommendations
            </>
          )}
        </Button>
      </div>

      {insights?.offering_summary && (
        <div className="glass rounded-xl p-4 border border-[#BD00FF]/20">
          <p className="text-sm text-[#E0E0E0]">{insights.offering_summary}</p>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-[#A0AEC0]">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No recommendations yet</p>
          <p className="text-xs mt-1">Click "Generate Recommendations" to analyze offerings for {clientName}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations
            .sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0))
            .map((rec, idx) => {
              const Icon = getOfferingIcon(rec.offering_type);
              const priorityStyle = priorityConfig[rec.priority] || priorityConfig.medium;
              
              return (
                <div
                  key={idx}
                  className={`glass rounded-xl p-4 border ${priorityStyle.border} hover:bg-[#2C2E33]/50 transition-colors`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${priorityStyle.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${priorityStyle.color}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#F5F5F5]">{rec.offering_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.color}`}>
                            {rec.offering_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.color}`}>
                            {rec.priority} priority
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#00E5FF]" />
                      <span className="text-sm font-semibold text-[#00E5FF]">
                        {rec.fit_score}% fit
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-[#E0E0E0] mb-3">{rec.reasoning}</p>
                  
                  {rec.recommended_action && (
                    <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-[#1A1B1E]">
                      <Clock className="w-4 h-4 text-[#BD00FF] mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-[#BD00FF]">Recommended Action:</p>
                        <p className="text-xs text-[#A0AEC0] mt-0.5">{rec.recommended_action}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}