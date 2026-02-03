import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, Trash2, User, MessageSquare, CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotificationPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const notifs = await base44.entities.Notification.filter(
        { recipient_user_id: user.id },
        '-created_date',
        50
      );
      return notifs;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, { read_status: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifs = notifications.filter(n => !n.read_status);
      await Promise.all(
        unreadNotifs.map(n => base44.entities.Notification.update(n.id, { read_status: true }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.delete(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read_status).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment_mention': return <MessageSquare className="w-4 h-4" />;
      case 'task_assigned': return <CheckCircle2 className="w-4 h-4" />;
      case 'task_completed': return <Check className="w-4 h-4" />;
      case 'new_kpi': return <TrendingUp className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const handleNotificationClick = (notification) => {
    markAsReadMutation.mutate(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-[#2C2E33] transition-colors">
          <Bell className="w-4 h-4 md:w-5 md:h-5 text-[#A0AEC0]" />
          {unreadCount > 0 && (
            <div className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#00E5FF] flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#121212]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 bg-[#1A1B1E] border-[#2C2E33] text-[#F5F5F5] max-h-[500px] overflow-hidden p-0">
        <div className="p-4 border-b border-[#2C2E33] flex items-center justify-between">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              className="text-xs text-[#00E5FF] hover:text-[#00E5FF]/80"
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <div className="overflow-y-auto max-h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-[#4A5568]" />
              <p className="text-[#A0AEC0]">No notifications</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    p-4 border-b border-[#2C2E33] cursor-pointer transition-colors hover:bg-[#2C2E33]
                    ${!notification.read_status ? 'bg-[#00E5FF]/5' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${!notification.read_status ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#2C2E33] text-[#A0AEC0]'}
                    `}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm mb-1">{notification.message}</p>
                      <p className="text-xs text-[#4A5568]">
                        {new Date(notification.created_date).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                      className="p-1 rounded hover:bg-[#3a3d44] text-[#4A5568] hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}