import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationDetailDialogProps {
  notification: any | null;
  open: boolean;
  onClose: () => void;
  onMarkAsRead: (id: number) => void;
  onAction?: (notification: any) => void;
}

export const NotificationDetailDialog: React.FC<NotificationDetailDialogProps> = ({
  notification,
  open,
  onClose,
  onMarkAsRead,
  onAction
}) => {
  const { t } = useLanguage();

  if (!notification) {
    return null;
  }

  const getPriorityBadgeStyles = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-red-400 text-red-300';
      case 'high':
        return 'border-orange-400 text-orange-300';
      case 'normal':
        return 'border-brand-accent text-brand-accent';
      case 'low':
      default:
        return 'border-gray-500 text-gray-300';
    }
  };

  const handleActionClick = () => {
    if (onAction) {
      onAction(notification);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-gray-900 text-white border border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{notification.title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {new Date(notification.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', getPriorityBadgeStyles())}>
              {t(notification.priority)}
            </Badge>
            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
              {t(notification.type)}
            </Badge>
            {!notification.is_read && (
              <Badge className="text-xs bg-blue-600 text-white">
                {t('unread')}
              </Badge>
            )}
          </div>

          <Separator className="bg-gray-800" />

          <p className="leading-relaxed whitespace-pre-line text-gray-100">
            {notification.content}
          </p>

          {notification.action_type && (
            <div className="rounded-lg border border-gray-700 p-3 bg-gray-800/70">
              <p className="text-sm text-gray-300 mb-2">
                {t('notificationAction')}
              </p>
              <Button
                variant="outline"
                className="text-white border-brand-accent hover:bg-brand-accent/20"
                onClick={handleActionClick}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t(notification.action_type)}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            {!notification.is_read && (
              <Button
                variant="outline"
                className="text-white border-blue-500 hover:bg-blue-500/20"
                onClick={() => onMarkAsRead(notification.id)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t('markAsRead')}
              </Button>
            )}
            <Button
              variant="secondary"
              className="bg-brand-accent text-white hover:bg-brand-accent/90"
              onClick={onClose}
            >
              {t('close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDetailDialog;
