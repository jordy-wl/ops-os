import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Sparkles,
  FileText,
  Loader2,
  ChevronRight,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

const severityConfig = {
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
};

const categoryIcons = {
  bottleneck: AlertTriangle,
  efficiency: TrendingUp,
  quality: CheckCircle,
  timeline: Clock,
  resource: Target,
  risk: AlertTriangle,
  opportunity: Zap,
};

export default function InsightsPanel({ workflowTemplateId, clientId, onReportCreated }) {
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', workflowTemplateId, clientId],
    queryFn: async () => {
      const filter = {};
      if (workflowTemplateId) filter['scope.workflow_template_id'] = workflowTemplateId;
      if (clientId) filter['scope.client_id'] = clientId;
      return base44.entities.ReportInstance.filter(filter, '-generated_at', 20);
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateWorkflowInsights', {
        workflow_template_id: workflowTemplateId,
        client_id: clientId,
        date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        date_to: new Date().toISOString(),
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Insights generated successfully');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (onReportCreated) onReportCreated(data.report);
    },
    onError: () => {
      toast.error('Failed to generate insights');
    },
  });

  const generateImprovementsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('suggestProcessImprovements', {
        workflow_template_id: workflowTemplateId,
        lookback_days: 90,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Process improvements generated');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (onReportCreated) onReportCreated(data.report);
    },
    onError: () => {
      toast.error('Failed to generate improvements');
    },
  });

  const latestReport = reports[0];

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => generateInsightsMutation.mutate()}
          disabled={generateInsightsMutation.isPending}
          className="bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
        >
          {generateInsightsMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Generate Insights
        </Button>
        <Button
          onClick={() => generateImprovementsMutation.mutate()}
          disabled={generateImprovementsMutation.isPending}
          variant="outline"
          className="border-[#2C2E33] hover:bg-[#2C2E33]"
        >
          {generateImprovementsMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4 mr-2" />
          )}
          Suggest Improvements
        </Button>
      </div>

      {/* Latest Report */}
      {latestReport && (
        <div className="neumorphic-raised rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold mb-1">{latestReport.title}</h3>
              <p className="text-xs text-[#A0AEC0]">
                Generated {new Date(latestReport.generated_at).toLocaleDateString()}
              </p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30">
              {latestReport.report_type.replace('_', ' ')}
            </span>
          </div>

          {/* Metrics */}
          {latestReport.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {latestReport.metrics.total_workflows !== undefined && (
                <div className="neumorphic-pressed rounded-lg p-3">
                  <p className="text-xs text-[#A0AEC0]">Total Workflows</p>
                  <p className="text-xl font-bold">{latestReport.metrics.total_workflows}</p>
                </div>
              )}
              {latestReport.metrics.success_rate !== undefined && (
                <div className="neumorphic-pressed rounded-lg p-3">
                  <p className="text-xs text-[#A0AEC0]">Success Rate</p>
                  <p className="text-xl font-bold">{latestReport.metrics.success_rate}%</p>
                </div>
              )}
              {latestReport.metrics.avg_completion_time_days !== undefined && (
                <div className="neumorphic-pressed rounded-lg p-3">
                  <p className="text-xs text-[#A0AEC0]">Avg. Completion</p>
                  <p className="text-xl font-bold">{latestReport.metrics.avg_completion_time_days}d</p>
                </div>
              )}
              {latestReport.metrics.blocked_tasks_count !== undefined && (
                <div className="neumorphic-pressed rounded-lg p-3">
                  <p className="text-xs text-[#A0AEC0]">Blocked Tasks</p>
                  <p className="text-xl font-bold">{latestReport.metrics.blocked_tasks_count}</p>
                </div>
              )}
            </div>
          )}

          {/* Insights */}
          {latestReport.insights && latestReport.insights.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-[#A0AEC0] mb-2">Key Insights</h4>
              {latestReport.insights.slice(0, 3).map((insight, idx) => {
                const Icon = categoryIcons[insight.category] || AlertTriangle;
                const severity = severityConfig[insight.severity] || severityConfig.medium;
                
                return (
                  <div key={idx} className={`rounded-lg p-3 border ${severity.bg} ${severity.border}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 ${severity.color}`} />
                      <div className="flex-1">
                        <h5 className="font-medium text-sm mb-1">{insight.title}</h5>
                        <p className="text-xs text-[#A0AEC0] mb-1">{insight.description}</p>
                        {insight.recommendation && (
                          <p className="text-xs text-[#00E5FF]">→ {insight.recommendation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommendations */}
          {latestReport.recommendations && latestReport.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[#A0AEC0] mb-2">Recommendations</h4>
              {latestReport.recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="neumorphic-pressed rounded-lg p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-xs font-medium ${
                      rec.priority === 'high' ? 'text-red-400' : 
                      rec.priority === 'medium' ? 'text-yellow-400' : 
                      'text-blue-400'
                    }`}>
                      {rec.priority?.toUpperCase()} PRIORITY
                    </span>
                    <span className="text-xs text-[#A0AEC0]">
                      Effort: {rec.implementation_effort}
                    </span>
                  </div>
                  <p className="text-sm mb-1">{rec.action}</p>
                  <p className="text-xs text-[#A0AEC0]">Impact: {rec.expected_impact}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report History */}
      {reports.length > 1 && (
        <div className="neumorphic-raised rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00E5FF]" />
            Report History
          </h3>
          <div className="space-y-2">
            {reports.slice(1, 6).map(report => (
              <div key={report.id} className="neumorphic-pressed rounded-lg p-3 flex items-center justify-between hover:bg-[#2C2E33] cursor-pointer transition-colors">
                <div>
                  <p className="text-sm font-medium">{report.title}</p>
                  <p className="text-xs text-[#A0AEC0]">
                    {new Date(report.generated_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#A0AEC0]" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="neumorphic-pressed rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF] mx-auto mb-2" />
          <p className="text-sm text-[#A0AEC0]">Loading insights...</p>
        </div>
      )}
    </div>
  );
}