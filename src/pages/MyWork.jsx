import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TaskCompletionModal from '@/components/TaskCompletionModal';
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
  ChevronRight
} from 'lucide-react';

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

function TaskCard({ task, onClick }) {
  const isBlocked = task.status === 'blocked';
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  
  return (
    <div 
      onClick={onClick}
      className={`
        neumorphic-raised rounded-xl p-4 cursor-pointer
        transition-all duration-200 hover:translate-y-[-2px]
        ${isBlocked ? 'border border-red-500/50' : ''}
        ${isOverdue && !isBlocked ? 'border border-orange-500/50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-[#A0AEC0] mb-1">{task.client_name || 'No Client'}</p>
          <p className="text-xs text-[#4A5568]">{task.workflow_name || 'Ad-hoc Task'}</p>
        </div>
        <button className="p-1 rounded hover:bg-[#3a3d44]">
          <MoreHorizontal className="w-4 h-4 text-[#4A5568]" />
        </button>
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
  const [viewMode, setViewMode] = useState('kanban');
  const [selectedTask, setSelectedTask] = useState(null);
  const [completingTask, setCompletingTask] = useState(null);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => base44.entities.TaskInstance.list('-created_date', 50),
  });

  const tasksByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">My Work</h1>
          <p className="text-[#A0AEC0]">{tasks.length} tasks assigned to you</p>
        </div>
        
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
              {tasks.map((task, idx) => {
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

      {/* Task Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedTask(null)}
          />
          <div className="w-[500px] glass h-full overflow-y-auto p-6 shadow-2xl">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-[#A0AEC0] mb-6">
              <span>{selectedTask.client_name || 'No Client'}</span>
              <ChevronRight className="w-4 h-4" />
              <span>{selectedTask.workflow_name || 'Ad-hoc'}</span>
            </div>

            <h2 className="text-xl font-semibold mb-4">{selectedTask.name}</h2>
            
            {selectedTask.instructions && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Instructions</h3>
                <div className="neumorphic-pressed rounded-lg p-4 text-sm">
                  {selectedTask.instructions}
                </div>
              </div>
            )}

            {selectedTask.description && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#A0AEC0] mb-2">Description</h3>
                <p className="text-[#A0AEC0]">{selectedTask.description}</p>
              </div>
            )}

            {/* Action Button */}
            <button 
              onClick={() => {
                setCompletingTask(selectedTask);
                setSelectedTask(null);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#0099ff] text-[#121212] font-medium hover:shadow-lg hover:shadow-[#00E5FF]/30 transition-all"
            >
              Complete Task
            </button>
          </div>
        </div>
      )}

      {/* Task Completion Modal */}
      {completingTask && (
        <TaskCompletionModal
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
            setCompletingTask(null);
          }}
        />
      )}
      </div>
      );
      }