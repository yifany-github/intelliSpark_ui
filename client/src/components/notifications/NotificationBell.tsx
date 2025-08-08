import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationItem } from './NotificationItem';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notification stats
  const { data: stats } = useQuery({
    queryKey: ['notificationStats'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/notifications/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notification stats');
      }

      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch recent notifications for dropdown
  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['recentNotifications'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/notifications?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recent notifications');
      }

      return response.json();
    },
    enabled: !!user && isOpen,
    staleTime: 30000,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = (notificationId: number) => {
    // This would typically trigger a mutation
    console.log('Mark as read:', notificationId);
  };

  const handleDelete = (notificationId: number) => {
    // This would typically trigger a mutation
    console.log('Delete notification:', notificationId);
  };

  const handleAction = (notification: any) => {
    // Handle notification action
    console.log('Notification action:', notification);
    setIsOpen(false);
  };

  const handleViewAll = () => {
    // Navigate to notifications page
    window.location.href = '/notifications';
    setIsOpen(false);
  };

  if (!user) {
    return null;
  }

  const hasUnread = stats && stats.unread > 0;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Bell Icon */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBellClick}
        className={cn(
          "relative p-2 text-gray-400 hover:text-white transition-colors",
          hasUnread && "text-brand-accent"
        )}
      >
        <Bell className={cn(
          "h-5 w-5 transition-all duration-200",
          hasUnread && "animate-pulse"
        )} />
        
        {/* Unread count badge */}
        {hasUnread && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-0">
            {stats.unread > 99 ? '99+' : stats.unread}
          </Badge>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50">
          <Card className="w-80 bg-gray-800 border-gray-700 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  <Bell className="h-4 w-4 text-brand-accent" />
                  {t('notifications')}
                  {hasUnread && (
                    <Badge className="bg-brand-accent text-white">
                      {stats.unread}
                    </Badge>
                  )}
                </CardTitle>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="max-h-96 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                  <p className="text-sm">{t('noNotifications')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentNotifications.map((notification: any) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                      onAction={handleAction}
                      compact={true}
                    />
                  ))}
                </div>
              )}

              {/* View All Button */}
              {recentNotifications.length > 0 && (
                <div className="pt-3 border-t border-gray-700 mt-3">
                  <Button
                    variant="outline"
                    onClick={handleViewAll}
                    className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white"
                  >
                    {t('viewAll')} {t('notifications')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;