import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AISuggestionFeedback from './AISuggestionFeedback';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

const riskColors = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: AlertTriangle },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertTriangle }
};

const priorityColors = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400'
};

export default function ProactiveInsightsWidget({ clientId, workflowInstanceId, compact = false }) {
  const [expanded, setExpanded] = useState(!compact);
  const [showFeedback, setShowFeedback] = useState(false);
  const queryClient = useQueryClient();

  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['proactive-insights', clientId, workflowInstanceId],
    queryFn: async () => {
      if (clientId) {
        const response = await base44.functions.invoke('aiGenerateNextBestAction', { client_id: clientId });
        return response.data;
      } else if (workflowInstanceId) {
        const response = await base44.functions.invoke('aiSuggestWorkflowAdjustment', { workflow_instance_id: workflowInstanceId });
        return response.data;
      }
      return null;
    },
    enabled: !!(clientId || workflowInstanceId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const refreshMutation = useMutation({
    mutationFn: () => refetch(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-insights'] });
    }
  });

  if (!clientId && !workflowInstanceId) return null;

  if (isLoading) {
    return (
      <div className="neumorphic-raised rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#BD00FF]" />
          <span className="text-sm text-[#A0AEC0]">Analyzing...</span>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  // Client insights
  if (insights.next_best_action) {
    const { risk_assessment, next_best_action, predictive_insights } = insights;
    const highestRisk = ['critical', 'high', 'medium', 'low'].find(level => 
      Object.values(risk_assessment || {}).includes(level)
    ) || 'low';
    const RiskIcon = riskColors[highestRisk].icon;

    return (
      <div className="neumorphic-raised rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#BD00FF]" />
            <h3 className="font-semibold">Proactive AI Insights</h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-[#2C2E33] text-[#A0AEC0]"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Risk Assessment Summary */}
        <div className={`rounded-lg p-3 border mb-3 ${riskColors[highestRisk].bg} ${riskColors[highestRisk].border}`}>
          <div className="flex items-center gap-2 mb-2">
            <RiskIcon className={`w-4 h-4 ${riskColors[highestRisk].text}`} />
            <span className={`text-sm font-medium ${riskColors[highestRisk].text}`}>
              {highestRisk.toUpperCase()} RISK DETECTED
            </span>
          </div>
          {risk_assessment?.summary && (
            <p className="text-sm text-[#A0AEC0]">{risk_assessment.summary}</p>
          )}
        </div>

        {expanded && (
          <>
            {/* Next Best Action */}
            <div className="neumorphic-pressed rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${priorityColors[next_best_action.priority]}`}>
                  {next_best_action.priority?.toUpperCase()} PRIORITY
                </span>
                <span className="text-xs text-[#A0AEC0]">{next_best_action.action_type}</span>
              </div>
              <h4 className="font-medium mb-1">{next_best_action.title}</h4>
              <p className="text-sm text-[#A0AEC0] mb-2">{next_best_action.description}</p>
              <div className="text-xs text-[#4A5568] mb-2">
                <strong>Impact:</strong> {next_best_action.expected_impact}
              </div>
              <div className="text-xs text-[#4A5568]">
                <strong>Why:</strong> {next_best_action.reasoning}
              </div>
            </div>

            {/* Predictive Insights */}
            {predictive_insights && predictive_insights.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-sm font-medium text-[#A0AEC0]">Predictive Scenarios</h4>
                {predictive_insights.map((insight, idx) => (
                  <div key={idx} className="neumorphic-pressed rounded-lg p-2 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{insight.scenario}</span>
                      <span className={`text-xs ${
                        insight.probability === 'high' ? 'text-orange-400' :
                        insight.probability === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {insight.probability} probability
                      </span>
                    </div>
                    <p className="text-xs text-[#A0AEC0] mb-1">{insight.impact}</p>
                    <p className="text-xs text-[#00E5FF]">→ {insight.prevention}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowFeedback(!showFeedback)}
                variant="outline"
                size="sm"
                className="border-[#2C2E33] hover:bg-[#2C2E33]"
              >
                Rate Suggestion
              </Button>
              <Button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                variant="outline"
                size="sm"
                className="border-[#2C2E33] hover:bg-[#2C2E33]"
              >
                {refreshMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {showFeedback && (
              <div className="mt-3">
                <AISuggestionFeedback
                  context={{ client_id: clientId, action: next_best_action }}
                  onFeedbackSubmitted={() => setShowFeedback(false)}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Workflow adjustment insights
  if (insights.suggestions) {
    const { requires_adjustment, overall_assessment, suggestions } = insights;

    return (
      <div className="neumorphic-raised rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#00E5FF]" />
            <h3 className="font-semibold">Workflow Optimization</h3>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-[#2C2E33] text-[#A0AEC0]"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className={`rounded-lg p-3 mb-3 ${
          requires_adjustment 
            ? 'bg-orange-500/20 border border-orange-500/30' 
            : 'bg-green-500/20 border border-green-500/30'
        }`}>
          <p className="text-sm">{overall_assessment}</p>
        </div>

        {expanded && requires_adjustment && suggestions.length > 0 && (
          <>
            <div className="space-y-2 mb-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="neumorphic-pressed rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#00E5FF]">
                      {suggestion.adjustment_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-[#A0AEC0]">
                      Approval: {suggestion.requires_approval_level}
                    </span>
                  </div>
                  <h4 className="font-medium mb-1">{suggestion.title}</h4>
                  <p className="text-sm text-[#A0AEC0] mb-2">{suggestion.description}</p>
                  <div className="text-xs space-y-1">
                    <div><strong>Reasoning:</strong> {suggestion.reasoning}</div>
                    <div><strong>Timeline Impact:</strong> {suggestion.impact_on_timeline}</div>
                    <div><strong>Quality Impact:</strong> {suggestion.impact_on_quality}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowFeedback(!showFeedback)}
                variant="outline"
                size="sm"
                className="border-[#2C2E33] hover:bg-[#2C2E33]"
              >
                Rate Suggestions
              </Button>
            </div>

            {showFeedback && (
              <div className="mt-3">
                <AISuggestionFeedback
                  context={{ workflow_instance_id: workflowInstanceId, suggestions }}
                  onFeedbackSubmitted={() => setShowFeedback(false)}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}