import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TaskFormFields from '@/components/tasks/TaskFormFields';
import CalendarView from '@/components/mywork/CalendarView';
import OrganiseView from '@/components/mywork/OrganiseView';
import AnalyticsDashboard from '@/components/mywork/AnalyticsDashboard';
import TaskChatbot from '@/components/tasks/TaskChatbot';
import ClientSummaryTab from '@/components/tasks/ClientSummaryTab';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  LayoutGrid, 
  List, 
  Calendar, 
  Flag, 
  User, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  MoreHorizontal,
  ChevronRight,
  X,
  Loader2,
  Trash2,
  PauseCircle,
  FastForward,
  MessageSquare,
  Building2,
  Plus,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const statusColumns = [
  { id: 'not_started', label: 'Not Started', icon: Circle },
  { id: 'in_progress', label: 'In Progress', icon: ArrowUpCircle },
  { id: 'review', label: 'Review', icon: Clock },
  { id: 'blocked', label: 'Blocked', icon: AlertCircle },
  { id: 'completed', label: 'Complete', icon: CheckCircle2 },
];

const priorityColors = {
  low: 'text-[#A0AEC0]',
  normal: 'text-[#00E5FF]',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

function TaskCard({ task, onClick, onClear }) {
  const isBlocked = task.status === 'blocked';
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const isCompleted = task.status === 'completed';
  
  return (
    <div 
      onClick={onClick}
      className={`
        neumorphic-raised rounded-xl p-4 cursor-pointer group
        transition-all duration-200 hover:translate-y-[-2px]
        ${isBlocked ? 'border border-red-500/50' : ''}
        ${isOverdue && !isBlocked ? 'border border-orange-500/50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#A0AEC0] mb-1">{task.client_name || 'No Client'}</p>
          <p className="text-xs text-[#4A5568]">{task.workflow_name || 'Ad-hoc Task'}</p>
        </div>
        {isCompleted ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear(task.id);
            }}
            className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Clear from view"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        ) : (
          <button className="p-1 rounded hover:bg-[#3a3d44]">
            <MoreHorizontal className="w-4 h-4 text-[#4A5568]" />
          </button>
        )}
      </div>
      
      {/* Task Name */}
      <h3 className="font-medium mb-3 line-clamp-2">{task.name}</h3>
      
      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`text-xs font-mono flex items-center gap-1 ${
              isOverdue ? 'text-red-400' : 'text-[#A0AEC0]'
            }`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            task.priority === 'urgent' || task.priority === 'high' 
              ? 'bg-[#00E5FF] animate-pulse shadow-lg shadow-[#00E5FF]/50' 
              : 'bg-[#4A5568]'
          }`} />
          {task.assigned_user_id && (
            <div className="w-6 h-6 rounded-full bg-[#2C2E33] flex items-center justify-center text-xs">
              <User className="w-3 h-3 text-[#A0AEC0]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyWork() {
  const [activeTab, setActiveTab] = useState('kanban');
  const [viewMode, setViewMode] = useState('kanban');
  const [selectedTask, setSelectedTask] = useState(null);
  const [drawerTab, setDrawerTab] = useState('details');
  const [fieldValues, setFieldValues] = useState({});
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [clearedTaskIds, setClearedTaskIds] = useState(() => {
    const saved = localStorage.getItem('clearedTaskIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const tasks = await base44.entities.TaskInstance.filter({
        assigned_user_id: user.id,
        status: { $in: ['not_started', 'in_progress', 'review', 'blocked', 'completed'] }
      }, '-created_date', 50);

      const clientIds = [...new Set(tasks.map(t => t.client_id).filter(Boolean))];
      const workflowInstanceIds = [...new Set(tasks.map(t => t.workflow_instance_id).filter(Boolean))];

      const clients = await Promise.all(
        clientIds.map(id => base44.entities.Client.filter({ id }))
      );
      const clientMap = Object.fromEntries(clients.flat().map(c => [c.id, c.name]));

      const workflowInstances = await Promise.all(
        workflowInstanceIds.map(id => base44.entities.WorkflowInstance.filter({ id }))
      );
      const workflowMap = Object.fromEntries(workflowInstances.flat().map(w => [w.id, w.name]));

      return tasks.map(task => ({
        ...task,
        client_name: clientMap[task.client_id] || 'No Client',
        workflow_name: workflowMap[task.workflow_instance_id] || 'Ad-hoc Task',
      }));
    },
  });

  const { data: taskTemplate } = useQuery({
    queryKey: ['task-template', selectedTask?.task_template_id],
    queryFn: async () => {
      if (!selectedTask?.task_template_id) return null;
      const templates = await base44.entities.TaskTemplate.filter({ id: selectedTask.task_template_id });
      return templates[0] || null;
    },
    enabled: !!selectedTask?.task_template_id,
  });

  const { data: taskContext } = useQuery({
    queryKey: ['task-context', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return null;

      const [deliverableInstance, workflowInstance, client, deals] = await Promise.all([
        selectedTask.deliverable_instance_id 
          ? base44.entities.DeliverableInstance.filter({ id: selectedTask.deliverable_instance_id }).then(r => r[0])
          : null,
        selectedTask.workflow_instance_id 
          ? base44.entities.WorkflowInstance.filter({ id: selectedTask.workflow_instance_id }).then(r => r[0])
          : null,
        selectedTask.client_id 
          ? base44.entities.Client.filter({ id: selectedTask.client_id }).then(r => r[0])
          : null,
        selectedTask.client_id 
          ? base44.entities.Deal.filter({ client_id: selectedTask.client_id })
          : [],
      ]);

      return { deliverableInstance, workflowInstance, client, deals };
    },
    enabled: !!selectedTask,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, fieldValues, outcome }) => {
      const response = await base44.functions.invoke('completeTask', {
        task_instance_id: taskId,
        field_values: fieldValues,
        outcome: outcome
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      if (selectedTask?.client_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', selectedTask.client_id] });
        queryClient.invalidateQueries({ queryKey: ['client', selectedTask.client_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['document-instances'] });
      toast.success('Task completed successfully!');
      setSelectedTask(null);
      setFieldValues({});
      setSelectedOutcome(null);
    },
    onError: (error) => {
      toast.error('Failed to complete task: ' + error.message);
    }
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, comment }) => {
      const user = await base44.auth.me();
      const task = await base44.entities.TaskInstance.filter({ id: taskId }).then(r => r[0]);
      const comments = task.comments || [];
      comments.push({
        user_id: user.id,
        timestamp: new Date().toISOString(),
        text: comment
      });
      await base44.entities.TaskInstance.update(taskId, { comments });

      // Parse mentions and create notifications
      const mentionRegex = /@(\S+)/g;
      const mentions = [...comment.matchAll(mentionRegex)];
      
      for (const match of mentions) {
        const mentionedEmail = match[1];
        const mentionedUser = allUsers.find(u => u.email === mentionedEmail);
        
        if (mentionedUser) {
          await base44.functions.invoke('createNotification', {
            recipient_user_id: mentionedUser.id,
            type: 'comment_mention',
            entity_type: 'TaskInstance',
            entity_id: taskId,
            message: `${user.full_name} mentioned you in a comment on "${task.name}"`,
            action_url: createPageUrl('MyWork'),
            metadata: { task_id: taskId, comment }
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setNewComment('');
      toast.success('Comment added');
    },
  });

  const taskActionMutation = useMutation({
    mutationFn: async ({ taskId, action, notes }) => {
      const user = await base44.auth.me();
      const task = await base44.entities.TaskInstance.filter({ id: taskId }).then(r => r[0]);
      const audit_trail = task.audit_trail || [];
      
      const auditEntry = {
        action,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        details: { notes }
      };
      audit_trail.push(auditEntry);

      const updates = { audit_trail, action_notes: notes };
      
      if (action === 'dumped') {
        updates.status = 'failed';
        updates.personal_status = 'dump';
      } else if (action === 'delayed') {
        updates.personal_status = 'dump';
      } else if (action === 'overridden') {
        updates.status = 'completed';
      }

      await base44.entities.TaskInstance.update(taskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Task action recorded');
    },
  });

  const handleClearTask = (taskId) => {
    const newClearedIds = [...clearedTaskIds, taskId];
    setClearedTaskIds(newClearedIds);
    localStorage.setItem('clearedTaskIds', JSON.stringify(newClearedIds));
  };

  const filteredTasks = showCompleted 
    ? tasks.filter(t => !clearedTaskIds.includes(t.id))
    : tasks.filter(t => t.status !== 'completed' && !clearedTaskIds.includes(t.id));
  
  const tasksByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = filteredTasks.filter(t => t.status === col.id);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">My Work</h1>
        <p className="text-[#A0AEC0]">{filteredTasks.length} tasks assigned to you</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-[#2C2E33]">
        <div className="flex gap-6">
          {['kanban', 'calendar', 'analytics', 'organise'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-[#00E5FF]'
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00E5FF]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Controls - Only show for Kanban tab */}
      {activeTab === 'kanban' && (
        <div className="flex items-center justify-end gap-4 mb-6">
          {/* Show Completed Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              showCompleted 
                ? 'bg-[#2C2E33] text-[#A0AEC0] hover:text-[#F5F5F5]' 
                : 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30'
            }`}
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          
          {/* View Toggle */}
          <div className="neumorphic-pressed rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === 'kanban' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm transition-all ${
                viewMode === 'list' 
                  ? 'bg-[#2C2E33] text-[#00E5FF] shadow' 
                  : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'kanban' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-5 gap-4">
              {statusColumns.map((col) => (
                <div key={col.id} className="space-y-4">
                  <div className="h-8 bg-[#2C2E33] rounded animate-pulse" />
                  <div className="h-32 bg-[#2C2E33] rounded animate-pulse" />
                  <div className="h-32 bg-[#2C2E33] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-5 gap-4 overflow-x-auto">
          {statusColumns.map((column) => {
            const Icon = column.icon;
            const columnTasks = tasksByStatus[column.id] || [];
            
            return (
              <div key={column.id} className="min-w-[280px]">
                {/* Column Header */}
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#2C2E33]">
                  <Icon className={`w-4 h-4 ${
                    column.id === 'blocked' ? 'text-red-400' :
                    column.id === 'completed' ? 'text-green-400' :
                    'text-[#A0AEC0]'
                  }`} />
                  <span className="font-medium text-sm">{column.label}</span>
                  <span className="ml-auto text-xs text-[#4A5568] bg-[#2C2E33] px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                
                {/* Tasks */}
                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <TaskCard 
                      key={task.id} 
                      task={task}
                      onClick={() => setSelectedTask(task)}
                      onClear={handleClearTask}
                    />
                  ))}
                  
                  {columnTasks.length === 0 && (
                    <div className="neumorphic-pressed rounded-xl p-6 text-center">
                      <p className="text-[#4A5568] text-sm">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="neumorphic-raised rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="neumorphic-pressed">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Task</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Due Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A0AEC0] uppercase">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, idx) => {
                const StatusIcon = statusColumns.find(s => s.id === task.status)?.icon || Circle;
                return (
                  <tr 
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`
                      cursor-pointer transition-colors hover:bg-[#2C2E33]
                      ${idx % 2 === 0 ? 'bg-[#1A1B1E]' : 'bg-[#232529]'}
                    `}
                  >
                    <td className="px-4 py-3">
                      <StatusIcon className={`w-4 h-4 ${
                        task.status === 'blocked' ? 'text-red-400' :
                        task.status === 'completed' ? 'text-green-400' :
                        task.status === 'in_progress' ? 'text-[#00E5FF]' :
                        'text-[#A0AEC0]'
                      }`} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{task.name}</span>
                    </td>
                    <td className="px-4 py-3 text-[#A0AEC0]">
                      {task.client_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {task.due_date ? (
                        <span className="font-mono text-sm">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm capitalize ${priorityColors[task.priority] || 'text-[#A0AEC0]'}`}>
                        {task.priority || 'normal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      {activeTab === 'calendar' && (
        <CalendarView onTaskClick={setSelectedTask} />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard />
      )}

      {activeTab === 'organise' && (
        <OrganiseView />
      )}

      {/* Task Workspace Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setSelectedTask(null);
              setFieldValues({});
              setSelectedOutcome(null);
            }}
          />
          <div className="w-[700px] glass h-full shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#2C2E33] flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-[#A0AEC0]">
                  <span>{selectedTask.client_name || 'No Client'}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>{selectedTask.workflow_name || 'Ad-hoc'}</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedTask(null);
                    setFieldValues({});
                    setSelectedOutcome(null);
                    setDrawerTab('details');
                  }}
                  className="p-2 rounded-lg hover:bg-[#2C2E33]"
                >
                  <X className="w-5 h-5 text-[#A0AEC0]" />
                </button>
              </div>
              <h2 className="text-xl font-semibold mb-4">{selectedTask.name}</h2>

              {/* Drawer Tabs */}
              <div className="flex gap-4 border-b border-[#2C2E33] -mb-6 pb-2">
                {[
                  { id: 'details', label: 'Details', icon: CheckCircle2 },
                  { id: 'comments', label: 'Comments', icon: MessageSquare },
                  { id: 'client', label: 'Client', icon: Building2 },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDrawerTab(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        drawerTab === tab.id
                          ? 'text-[#00E5FF] border-b-2 border-[#00E5FF]'
                          : 'text-[#A0AEC0] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {drawerTab === 'details' && (
                <div className="h-full overflow-y-auto p-6 space-y-6">
              {selectedTask.instructions && (
                <div>
                  <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Instructions</h3>
                  <div className="neumorphic-pressed rounded-lg p-4 text-sm text-[#A0AEC0]">
                    {selectedTask.instructions}
                  </div>
                </div>
              )}

              {selectedTask.description && (
                <div>
                  <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Description</h3>
                  <p className="text-[#A0AEC0] text-sm">{selectedTask.description}</p>
                </div>
              )}

              {/* Task Form Fields */}
              <div>
                <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Task Details</h3>
                <TaskFormFields
                  taskTemplate={taskTemplate}
                  initialValues={selectedTask.field_values || {}}
                  onChange={setFieldValues}
                />
              </div>

              {/* Outcomes */}
              {taskTemplate?.conditions?.outcomes && taskTemplate.conditions.outcomes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-[#A0AEC0] mb-4">Select Outcome <span className="text-red-400">*</span></h3>
                  <div className="space-y-2">
                    {taskTemplate.conditions.outcomes.map((outcome, idx) => (
                      <label 
                        key={idx} 
                        className="flex items-center p-3 rounded-lg bg-[#1A1B1E] border border-[#2C2E33] hover:border-[#00E5FF]/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="radio"
                          name="task-outcome"
                          value={outcome.outcome_name}
                          checked={selectedOutcome === outcome.outcome_name}
                          onChange={() => setSelectedOutcome(outcome.outcome_name)}
                          className="w-4 h-4 text-[#00E5FF] bg-[#1A1B1E] border-[#2C2E33] focus:ring-[#00E5FF]"
                        />
                        <span className="ml-3 text-sm text-[#F5F5F5]">
                          {outcome.outcome_name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
              )}

              {drawerTab === 'comments' && (
                <div className="h-full flex flex-col p-6">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                    {(selectedTask.comments || []).map((comment, idx) => (
                      <div key={idx} className="bg-[#1A1B1E] rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2 text-xs text-[#A0AEC0]">
                          <User className="w-3 h-3" />
                          <span>{comment.user_id}</span>
                          <span>•</span>
                          <span>{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">{comment.text}</p>
                      </div>
                    ))}
                    {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-[#4A5568]" />
                        <p className="text-[#A0AEC0]">No comments yet</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 bg-[#1A1B1E] border-[#2C2E33]"
                    />
                    <Button
                      onClick={() => addCommentMutation.mutate({ taskId: selectedTask.id, comment: newComment })}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      className="bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#121212]"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {drawerTab === 'client' && (
                <ClientSummaryTab clientId={selectedTask.client_id} />
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-[#2C2E33] flex-shrink-0">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedTask(null);
                    setFieldValues({});
                    setSelectedOutcome(null);
                    setDrawerTab('details');
                  }}
                  className="flex-1 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]"
                >
                  Cancel
                </Button>
                
                {taskTemplate && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-transparent border-[#2C2E33] hover:bg-[#2C2E33]">
                        <Flag className="w-4 h-4" />
                        Actions
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-[#1A1B1E] border-[#2C2E33] text-[#F5F5F5]">
                      <DropdownMenuItem
                        onClick={() => {
                          const notes = prompt('Why are you dumping this task?');
                          if (notes) {
                            taskActionMutation.mutate({ taskId: selectedTask.id, action: 'dumped', notes });
                          }
                        }}
                        disabled={!taskTemplate?.can_be_dumped}
                        className="flex items-center gap-2 text-red-400 hover:bg-[#2C2E33] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        Dump Task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const delay = prompt('Delay by how many days? (1, 3, or 7)');
                          if (delay && ['1', '3', '7'].includes(delay)) {
                            const notes = `Delayed by ${delay} day(s)`;
                            taskActionMutation.mutate({ taskId: selectedTask.id, action: 'delayed', notes });
                          }
                        }}
                        disabled={!taskTemplate?.can_be_delayed}
                        className="flex items-center gap-2 text-orange-400 hover:bg-[#2C2E33] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PauseCircle className="w-4 h-4" />
                        Delay Task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const notes = prompt('Why are you overriding this task?');
                          if (notes) {
                            taskActionMutation.mutate({ taskId: selectedTask.id, action: 'overridden', notes });
                          }
                        }}
                        disabled={!taskTemplate?.can_be_overridden}
                        className="flex items-center gap-2 text-[#00E5FF] hover:bg-[#2C2E33] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FastForward className="w-4 h-4" />
                        Override Task
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#2C2E33]" />
                      <DropdownMenuItem
                        disabled={!taskTemplate?.can_add_subtask}
                        className="flex items-center gap-2 text-green-400 hover:bg-[#2C2E33] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        Add Subtask
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button
                  onClick={() => completeTaskMutation.mutate({
                    taskId: selectedTask.id,
                    fieldValues,
                    outcome: selectedOutcome
                  })}
                  disabled={completeTaskMutation.isPending || (taskTemplate?.conditions?.outcomes?.length > 0 && !selectedOutcome)}
                  className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] hover:shadow-lg hover:shadow-[#00E5FF]/30"
                >
                  {completeTaskMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    'Complete Task'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}