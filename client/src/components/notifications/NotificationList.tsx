import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, 
  CheckCircle, 
  Filter,
  RefreshCw,
  Trash2,
  Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationItem } from './NotificationItem';

interface Notification {
  id: number;
  title: string;
  content: string;
  type: 'system' | 'payment' | 'admin' | 'achievement';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_read: boolean;
  action_type?: 'redirect' | 'dismiss' | 'acknowledge' | null;
  action_data?: any;
  created_at: string;
  read_at?: string | null;
}

interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

interface NotificationListProps {
  compact?: boolean;
  maxItems?: number;
  showSettings?: boolean;
  className?: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  compact = false,
  maxItems = 20,
  showSettings = true,
  className
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Fetch notifications
  const { 
    data: notifications = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['notifications', page, typeFilter, unreadOnly],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        skip: (page * maxItems).toString(),
        limit: maxItems.toString(),
        unread_only: unreadOnly.toString(),
        ...(typeFilter !== 'all' && { type_filter: typeFilter })
      });

      const response = await fetch(`http://localhost:8000/api/notifications?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      if (data.length < maxItems) {
        setHasMore(false);
      }
      return data;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

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
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:8000/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8000/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:8000/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationStats'] });
    }
  });

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const handleAction = (notification: Notification) => {
    if (notification.action_type === 'redirect') {
      // Handle redirect action
      const actionData = notification.action_data;
      if (actionData && actionData.url) {
        window.location.href = actionData.url;
      }
    } else if (notification.action_type === 'acknowledge') {
      // Mark as read for acknowledgment
      handleMarkAsRead(notification.id);
    } else if (notification.action_type === 'dismiss') {
      // Delete for dismiss
      handleDelete(notification.id);
    }
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const resetFilters = () => {
    setPage(0);
    setTypeFilter('all');
    setUnreadOnly(false);
    setHasMore(true);
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
  }, [typeFilter, unreadOnly]);

  if (!user) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        <CardContent className="p-6 text-center">
          <p className="text-gray-400">{t('pleaseSignIn')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-gray-800 border-gray-700", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            {t('notifications')}
            {stats && stats.unread > 0 && (
              <Badge className="bg-blue-600 text-white">
                {stats.unread}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            
            {stats && stats.unread > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
                className="bg-green-600 hover:bg-green-700 border-green-600 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {t('markAllAsRead')}
              </Button>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && !compact && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-gray-300">
              {t('total')}: {stats.total}
            </Badge>
            <Badge variant="outline" className="text-blue-400">
              {t('unreadNotifications')}: {stats.unread}
            </Badge>
            {Object.entries(stats.by_type).map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-gray-400">
                {t(type as any)}: {count as number}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Filters */}
        {showSettings && !compact && (
          <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes')}</SelectItem>
                  <SelectItem value="system">{t('system')}</SelectItem>
                  <SelectItem value="payment">{t('payment')}</SelectItem>
                  <SelectItem value="admin">{t('admin')}</SelectItem>
                  <SelectItem value="achievement">{t('achievement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
                className="data-[state=checked]:bg-blue-600"
              />
              <span className="text-sm text-gray-300">{t('unreadNotifications')}</span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={resetFilters}
              className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
            >
              {t('clearFilters')}
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Skeleton className="h-5 w-5 rounded bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-gray-700" />
                    <Skeleton className="h-3 w-full bg-gray-700" />
                    <Skeleton className="h-3 w-1/2 bg-gray-700" />
                  </div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              <p>{t('failedToLoad')} {t('notifications').toLowerCase()}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="mt-2 bg-secondary border-secondary hover:bg-secondary/80 text-white"
              >
                {t('tryAgain')}
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>{t('noNotifications')}</p>
            </div>
          ) : (
            <>
              {notifications.map((notification: Notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  onAction={handleAction}
                  compact={compact}
                />
              ))}
              
              {hasMore && notifications.length >= maxItems && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
                  >
                    {t('loadMore')}
                  </Button>
                </div>
              )}
              
              {!hasMore && notifications.length > 0 && (
                <div className="text-center pt-4 text-gray-500 text-sm">
                  {t('noMoreNotifications')}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationList;