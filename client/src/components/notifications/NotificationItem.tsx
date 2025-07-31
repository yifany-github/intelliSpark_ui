import React from 'react';
import { 
  Bell, 
  CreditCard, 
  Shield, 
  Trophy, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  X,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationItemProps {
  notification: {
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
  };
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
  onAction?: (notification: any) => void;
  compact?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
  onAction,
  compact = false
}) => {
  const { t } = useLanguage();

  const getTypeIcon = () => {
    switch (notification.type) {
      case 'payment':
        return <CreditCard className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'achievement':
        return <Trophy className="h-4 w-4" />;
      case 'system':
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case 'payment':
        return 'text-green-400';
      case 'admin':
        return 'text-blue-400';
      case 'achievement':
        return 'text-yellow-400';
      case 'system':
      default:
        return 'text-gray-400';
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-red-500 bg-red-900/20';
      case 'high':
        return 'border-orange-500 bg-orange-900/20';
      case 'normal':
        return 'border-gray-600 bg-gray-900/20';
      case 'low':
      default:
        return 'border-gray-700 bg-gray-900/10';
    }
  };

  const getPriorityIndicator = () => {
    switch (notification.priority) {
      case 'urgent':
        return <AlertTriangle className="h-3 w-3 text-red-400" />;
      case 'high':
        return <Info className="h-3 w-3 text-orange-400" />;
      case 'normal':
        return <CheckCircle className="h-3 w-3 text-blue-400" />;
      case 'low':
      default:
        return <CheckCircle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return t('justNow');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${t('minutesAgo')}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${t('hoursAgo')}`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${t('daysAgo')}`;
    } else if (diffInSeconds < 2629746) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} ${t('weeksAgo')}`;
    } else if (diffInSeconds < 31556952) {
      const months = Math.floor(diffInSeconds / 2629746);
      return `${months} ${t('monthsAgo')}`;
    } else {
      const years = Math.floor(diffInSeconds / 31556952);
      return `${years} ${t('yearsAgo')}`;
    }
  };

  const handleAction = () => {
    if (onAction) {
      onAction(notification);
    }
  };

  const handleMarkAsRead = () => {
    onMarkAsRead(notification.id);
  };

  const handleDelete = () => {
    onDelete(notification.id);
  };

  return (
    <div className={cn(
      'border rounded-lg p-4 transition-all duration-200 hover:shadow-sm',
      getPriorityColor(),
      !notification.is_read && 'shadow-md',
      compact && 'p-3'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Type Icon */}
          <div className={cn('mt-1', getTypeColor())}>
            {getTypeIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className={cn(
                'font-medium truncate',
                notification.is_read ? 'text-gray-300' : 'text-white'
              )}>
                {notification.title}
              </h4>
              
              {/* Priority indicator */}
              {notification.priority !== 'normal' && (
                <div className="flex items-center space-x-1">
                  {getPriorityIndicator()}
                  <Badge variant="outline" className={cn(
                    'text-xs',
                    notification.priority === 'urgent' && 'border-red-400 text-red-400',
                    notification.priority === 'high' && 'border-orange-400 text-orange-400',
                    notification.priority === 'low' && 'border-gray-500 text-gray-500'
                  )}>
                    {t(notification.priority)}
                  </Badge>
                </div>
              )}
            </div>

            <p className={cn(
              'text-sm mb-2 line-clamp-2',
              notification.is_read ? 'text-gray-400' : 'text-gray-200'
            )}>
              {notification.content}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {t(notification.type)}
                </Badge>
                <span className="text-xs text-gray-500">
                  {getTimeAgo(notification.created_at)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1">
                {notification.action_type && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAction}
                    className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                  >
                    {notification.action_type === 'redirect' ? (
                      <>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {t('redirect')}
                      </>
                    ) : (
                      t(notification.action_type)
                    )}
                  </Button>
                )}
                
                {!notification.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMarkAsRead}
                    className="h-6 px-2 text-xs text-gray-400 hover:text-white"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  className="h-6 px-2 text-xs text-gray-400 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.is_read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 ml-2 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};

export default NotificationItem;