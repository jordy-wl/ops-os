import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Target } from 'lucide-react';

export default function AnalyticsDashboard() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['analytics-tasks'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.TaskInstance.filter({
        assigned_user_id: user.id
      }, '-created_date', 500);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="neumorphic-raised rounded-xl p-6">
            <div className="h-8 bg-[#2C2E33] rounded animate-pulse mb-4" />
            <div className="h-12 bg-[#2C2E33] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate metrics
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalCompleted = completedTasks.length;

  const onTimeTasks = completedTasks.filter(t => {
    if (!t.due_date || !t.completed_at) return false;
    return new Date(t.completed_at) <= new Date(t.due_date);
  });
  const overdueTasks = completedTasks.filter(t => {
    if (!t.due_date || !t.completed_at) return false;
    return new Date(t.completed_at) > new Date(t.due_date);
  });
  const onTimePercentage = totalCompleted > 0 ? Math.round((onTimeTasks.length / totalCompleted) * 100) : 0;

  const priorityBreakdown = {
    urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
    high: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
    normal: tasks.filter(t => t.priority === 'normal' && t.status !== 'completed').length,
    low: tasks.filter(t => t.priority === 'low' && t.status !== 'completed').length,
  };

  const statusBreakdown = {
    not_started: tasks.filter(t => t.status === 'not_started').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    completed: totalCompleted,
  };

  // Audit trail analysis
  const auditCounts = {
    dumped: tasks.filter(t => t.audit_trail?.some(a => a.action === 'dumped')).length,
    delayed: tasks.filter(t => t.audit_trail?.some(a => a.action === 'delayed')).length,
    overridden: tasks.filter(t => t.audit_trail?.some(a => a.action === 'overridden')).length,
  };

  const MetricCard = ({ icon: Icon, label, value, subtitle, color = 'text-[#00E5FF]', target }) => (
    <div className="neumorphic-raised rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <Icon className={`w-8 h-8 ${color}`} />
        {target && (
          <div className="flex items-center gap-1 text-xs text-[#4A5568]">
            <Target className="w-3 h-3" />
            Target: {target}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-[#A0AEC0]">{label}</div>
      {subtitle && <div className="text-xs text-[#4A5568] mt-2">{subtitle}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          icon={CheckCircle2}
          label="Tasks Completed"
          value={totalCompleted}
          color="text-green-400"
        />
        <MetricCard
          icon={Clock}
          label="On-Time Completion"
          value={`${onTimePercentage}%`}
          subtitle={`${onTimeTasks.length} on time, ${overdueTasks.length} overdue`}
          color="text-[#00E5FF]"
          target="80%"
        />
        <MetricCard
          icon={TrendingUp}
          label="Active Tasks"
          value={tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length}
          color="text-orange-400"
        />
      </div>

      {/* Status Breakdown */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Tasks by Status</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(statusBreakdown).map(([status, count]) => (
            <div key={status} className="text-center">
              <div className="text-2xl font-bold mb-1">{count}</div>
              <div className="text-xs text-[#A0AEC0] capitalize">{status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Active Tasks by Priority</h3>
        <div className="space-y-3">
          {Object.entries(priorityBreakdown).map(([priority, count]) => {
            const total = Object.values(priorityBreakdown).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={priority}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize">{priority}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
                <div className="h-2 bg-[#1A1B1E] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      priority === 'urgent' ? 'bg-red-400' :
                      priority === 'high' ? 'bg-orange-400' :
                      priority === 'normal' ? 'bg-[#00E5FF]' :
                      'bg-[#4A5568]'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Process Improvement Insights */}
      <div className="neumorphic-raised rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Process Improvement Signals
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1A1B1E] rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400 mb-1">{auditCounts.dumped}</div>
            <div className="text-sm text-[#A0AEC0]">Tasks Dumped</div>
            <div className="text-xs text-[#4A5568] mt-2">Cancelled workflow instances</div>
          </div>
          <div className="bg-[#1A1B1E] rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-400 mb-1">{auditCounts.delayed}</div>
            <div className="text-sm text-[#A0AEC0]">Tasks Delayed</div>
            <div className="text-xs text-[#4A5568] mt-2">Postponed for later</div>
          </div>
          <div className="bg-[#1A1B1E] rounded-lg p-4">
            <div className="text-2xl font-bold text-[#00E5FF] mb-1">{auditCounts.overridden}</div>
            <div className="text-sm text-[#A0AEC0]">Tasks Overridden</div>
            <div className="text-xs text-[#4A5568] mt-2">Completed without data</div>
          </div>
        </div>
      </div>

      {/* Target Banner */}
      <div className="bg-gradient-to-r from-[#00E5FF]/10 to-[#BD00FF]/10 border border-[#00E5FF]/30 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <Target className="w-12 h-12 text-[#00E5FF]" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Your Productivity Goals</h3>
            <p className="text-[#A0AEC0] text-sm">
              Aim for 80% on-time completion • Minimize dumped tasks • Maintain clear priorities
            </p>
          </div>
          <div className={`text-3xl font-bold ${onTimePercentage >= 80 ? 'text-green-400' : 'text-orange-400'}`}>
            {onTimePercentage >= 80 ? '🎯' : '📊'}
          </div>
        </div>
      </div>
    </div>
  );
}