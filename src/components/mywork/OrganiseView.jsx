import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Inbox, Target, Calendar, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const columns = [
  {
    id: 'dump',
    title: 'Task Dump',
    description: 'All unprocessed tasks',
    icon: Inbox,
    color: 'text-[#A0AEC0]'
  },
  {
    id: 'prioritized',
    title: 'Prioritise',
    description: 'Important tasks to focus on',
    icon: Target,
    color: 'text-orange-400'
  },
  {
    id: 'scheduled',
    title: 'Schedule',
    description: 'Ready to be scheduled',
    icon: Calendar,
    color: 'text-[#00E5FF]'
  }
];

function TaskCard({ task, index }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            p-3 rounded-lg mb-2 transition-all
            ${snapshot.isDragging 
              ? 'bg-[#2C2E33] shadow-lg shadow-[#00E5FF]/20 rotate-2' 
              : 'bg-[#1A1B1E] hover:bg-[#2C2E33]'
            }
          `}
        >
          <div className="flex items-start gap-2">
            <GripVertical className="w-4 h-4 text-[#4A5568] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  task.priority === 'urgent' ? 'bg-red-400 animate-pulse' :
                  task.priority === 'high' ? 'bg-orange-400' :
                  'bg-[#4A5568]'
                }`} />
                <h4 className="text-sm font-medium truncate">{task.name}</h4>
              </div>
              <p className="text-xs text-[#A0AEC0] truncate">{task.client_name || 'No Client'}</p>
              {task.due_date && (
                <p className="text-xs text-[#4A5568] mt-1">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function OrganiseView() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['organise-tasks'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const tasks = await base44.entities.TaskInstance.filter({
        assigned_user_id: user.id,
        status: { $in: ['not_started', 'in_progress', 'review', 'blocked'] }
      }, '-created_date', 100);

      const clientIds = [...new Set(tasks.map(t => t.client_id).filter(Boolean))];
      const clients = await Promise.all(
        clientIds.map(id => base44.entities.Client.filter({ id }))
      );
      const clientMap = Object.fromEntries(clients.flat().map(c => [c.id, c.name]));

      return tasks.map(task => ({
        ...task,
        client_name: clientMap[task.client_id] || 'No Client'
      }));
    },
  });

  const updatePersonalStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }) => {
      await base44.entities.TaskInstance.update(taskId, {
        personal_status: newStatus
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organise-tasks'] });
      toast.success('Task moved successfully');
    },
    onError: (error) => {
      toast.error('Failed to update task: ' + error.message);
    }
  });

  const tasksByColumn = {
    dump: tasks.filter(t => !t.personal_status || t.personal_status === 'dump'),
    prioritized: tasks.filter(t => t.personal_status === 'prioritized'),
    scheduled: tasks.filter(t => t.personal_status === 'scheduled')
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside any droppable
    if (!destination) return;

    // Dropped in same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Update task personal_status
    if (destination.droppableId !== source.droppableId) {
      updatePersonalStatusMutation.mutate({
        taskId: draggableId,
        newStatus: destination.droppableId
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.id} className="neumorphic-raised rounded-xl p-4">
            <div className="h-8 bg-[#2C2E33] rounded animate-pulse mb-4" />
            <div className="space-y-2">
              <div className="h-20 bg-[#2C2E33] rounded animate-pulse" />
              <div className="h-20 bg-[#2C2E33] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-[#A0AEC0]">
          Drag tasks between columns to organize your work. Tasks start in the dump, move to prioritize what matters, then schedule when you'll do it.
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-4">
          {columns.map(column => {
            const Icon = column.icon;
            const columnTasks = tasksByColumn[column.id] || [];

            return (
              <div key={column.id} className="neumorphic-raised rounded-xl p-4">
                {/* Column Header */}
                <div className="mb-4 pb-3 border-b border-[#2C2E33]">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${column.color}`} />
                    <h3 className="font-semibold">{column.title}</h3>
                    <span className="ml-auto text-xs text-[#4A5568] bg-[#2C2E33] px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5568]">{column.description}</p>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        min-h-[400px] transition-colors rounded-lg
                        ${snapshot.isDraggingOver ? 'bg-[#00E5FF]/5 border-2 border-dashed border-[#00E5FF]/30' : ''}
                      `}
                    >
                      {columnTasks.length === 0 ? (
                        <div className="flex items-center justify-center h-[400px]">
                          <div className="text-center">
                            <Icon className="w-12 h-12 mx-auto mb-2 text-[#4A5568]" />
                            <p className="text-sm text-[#4A5568]">
                              {snapshot.isDraggingOver ? 'Drop task here' : 'No tasks'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {columnTasks.map((task, index) => (
                            <TaskCard key={task.id} task={task} index={index} />
                          ))}
                        </>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}