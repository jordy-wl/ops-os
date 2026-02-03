import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({ onTaskClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const tasks = await base44.entities.TaskInstance.filter({
        assigned_user_id: user.id,
        status: { $in: ['not_started', 'in_progress', 'review', 'blocked'] }
      }, '-due_date', 100);

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

  const handleSync = () => {
    toast.info('Syncing with Microsoft Calendar (in progress)...', {
      description: 'External calendar integration coming soon'
    });
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Previous month days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const tasksForDay = tasks.filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate.getFullYear() === year &&
               taskDate.getMonth() === month &&
               taskDate.getDate() === i;
      });
      
      days.push({
        date: i,
        fullDate: date,
        isCurrentMonth: true,
        isToday: date.toDateString() === new Date().toDateString(),
        tasks: tasksForDay
      });
    }
    
    return days;
  }, [currentDate, tasks]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg hover:bg-[#2C2E33] transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-[#A0AEC0]" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 rounded-lg text-sm bg-[#2C2E33] hover:bg-[#3a3d44] transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-[#2C2E33] transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-[#A0AEC0]" />
            </button>
          </div>
        </div>

        <Button
          onClick={handleSync}
          variant="outline"
          className="bg-transparent border-[#2C2E33] hover:bg-[#2C2E33] gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Sync with Microsoft Calendar
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="neumorphic-raised rounded-xl p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS.map(day => (
            <div key={day} className="text-center text-sm font-medium text-[#A0AEC0] py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => (
            <div
              key={idx}
              className={`
                min-h-[120px] p-2 rounded-lg border transition-colors
                ${day.isCurrentMonth 
                  ? 'bg-[#1A1B1E] border-[#2C2E33] hover:border-[#3a3d44]' 
                  : 'bg-transparent border-transparent'
                }
                ${day.isToday ? 'border-[#00E5FF]/50 bg-[#00E5FF]/5' : ''}
              `}
            >
              {day.date && (
                <>
                  <div className={`text-sm font-medium mb-2 ${
                    day.isToday ? 'text-[#00E5FF]' : 'text-[#A0AEC0]'
                  }`}>
                    {day.date}
                  </div>
                  <div className="space-y-1">
                    {day.tasks?.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className="text-xs p-1.5 rounded bg-[#2C2E33] hover:bg-[#3a3d44] cursor-pointer truncate transition-colors"
                        title={task.name}
                      >
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            task.priority === 'urgent' ? 'bg-red-400' :
                            task.priority === 'high' ? 'bg-orange-400' :
                            'bg-[#00E5FF]'
                          }`} />
                          <span className="truncate">{task.name}</span>
                        </div>
                      </div>
                    ))}
                    {day.tasks?.length > 3 && (
                      <div className="text-xs text-[#A0AEC0] pl-1.5">
                        +{day.tasks.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tasks without due date */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <div className="neumorphic-raised rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#A0AEC0] mb-3 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Tasks without due date ({tasks.filter(t => !t.due_date).length})
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {tasks.filter(t => !t.due_date).map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="p-3 rounded-lg bg-[#1A1B1E] border border-[#2C2E33] hover:border-[#3a3d44] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${
                    task.priority === 'urgent' ? 'bg-red-400' :
                    task.priority === 'high' ? 'bg-orange-400' :
                    'bg-[#00E5FF]'
                  }`} />
                  <span className="text-sm font-medium truncate">{task.name}</span>
                </div>
                <p className="text-xs text-[#A0AEC0] truncate">{task.client_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}