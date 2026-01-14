import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import AIInsightCard from '@/components/AIInsightCard';
import { 
  GitMerge, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const communicationIcons = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  message: MessageSquare,
  note: FileText,
};

const statusColors = {
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  not_started: 'bg-[#2C2E33] text-[#A0AEC0] border-[#3a3d44]',
};

export default function ClientActivityFeed({ client, workflowInstances, communications }) {
  return (
    <div className="space-y-4">
      {/* AI Insights & Recommendations */}
      {client.next_best_action && (
        <AIInsightCard
          type="recommendation"
          title="Next Best Action"
          content={client.next_best_action}
          severity="opportunity"
        />
      )}

      {/* Risk & Sentiment */}
      {((client.risk_score !== null && client.risk_score !== undefined) || client.sentiment_score) && (
        <div className="neumorphic-raised rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Health Indicators</h3>
          <div className="flex gap-3">
            {(client.risk_score !== null && client.risk_score !== undefined) && (
              <div className="flex-1 neumorphic-pressed rounded-lg p-3 text-center">
                <p className="text-xs text-[#4A5568] mb-1">Risk Score</p>
                <p className={`text-lg font-bold ${client.risk_score > 70 ? 'text-red-400' : client.risk_score > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {client.risk_score}
                </p>
              </div>
            )}
            {client.sentiment_score && (
              <div className="flex-1 neumorphic-pressed rounded-lg p-3 text-center">
                <p className="text-xs text-[#4A5568] mb-1">Sentiment</p>
                <p className={`text-sm font-medium capitalize ${
                  client.sentiment_score === 'positive' ? 'text-green-400' :
                  client.sentiment_score === 'negative' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {client.sentiment_score}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Workflows */}
      <div className="neumorphic-raised rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Workflows</h3>
        {workflowInstances.length === 0 ? (
          <p className="text-sm text-[#4A5568] text-center py-4">No workflows yet</p>
        ) : (
          <div className="space-y-2">
            {workflowInstances.slice(0, 5).map((workflow) => (
              <Link
                key={workflow.id}
                to={createPageUrl('Workflows') + '?id=' + workflow.id}
                className="block neumorphic-pressed rounded-lg p-3 hover:bg-[#2C2E33] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <GitMerge className="w-4 h-4 text-[#00E5FF] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{workflow.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${statusColors[workflow.status] || statusColors.not_started}`}>
                        {workflow.status?.replace('_', ' ')}
                      </span>
                      {workflow.progress_percentage !== null && workflow.progress_percentage !== undefined && (
                        <span className="text-xs text-[#4A5568]">{workflow.progress_percentage}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Communications */}
      <div className="neumorphic-raised rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#A0AEC0] mb-3">Recent Communications</h3>
        {communications.length === 0 ? (
          <p className="text-sm text-[#4A5568] text-center py-4">No communications logged</p>
        ) : (
          <div className="space-y-2">
            {communications.slice(0, 5).map((comm) => {
              const Icon = communicationIcons[comm.communication_type] || FileText;
              return (
                <div key={comm.id} className="neumorphic-pressed rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-[#A0AEC0] mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {comm.subject && (
                        <p className="text-sm font-medium truncate">{comm.subject}</p>
                      )}
                      {comm.content && (
                        <p className="text-xs text-[#A0AEC0] mt-1 line-clamp-2">{comm.content}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#4A5568] capitalize">{comm.communication_type}</span>
                        {comm.occurred_at && (
                          <>
                            <span className="text-xs text-[#4A5568]">•</span>
                            <span className="text-xs text-[#4A5568]">
                              {new Date(comm.occurred_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stage Summaries */}
      {client.summary_history && client.summary_history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[#A0AEC0]">Historical Summaries</h3>
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