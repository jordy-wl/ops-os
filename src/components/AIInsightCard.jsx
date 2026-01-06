import React from 'react';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AIInsightCard({ type, title, content, severity = 'info' }) {
  const severityConfig = {
    info: {
      bg: 'bg-[#00E5FF]/10',
      border: 'border-[#00E5FF]/30',
      icon: Sparkles,
      iconColor: 'text-[#00E5FF]'
    },
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: CheckCircle2,
      iconColor: 'text-green-400'
    },
    warning: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      icon: AlertTriangle,
      iconColor: 'text-orange-400'
    },
    opportunity: {
      bg: 'bg-[#BD00FF]/10',
      border: 'border-[#BD00FF]/30',
      icon: TrendingUp,
      iconColor: 'text-[#BD00FF]'
    }
  };

  const config = severityConfig[severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`neumorphic-raised rounded-xl p-4 border ${config.border} ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <h4 className="font-medium text-sm mb-1">{title}</h4>
          <p className="text-sm text-[#A0AEC0] leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}