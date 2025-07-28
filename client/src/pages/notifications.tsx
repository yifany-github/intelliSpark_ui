import React from 'react';
import { Bell } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { NotificationList } from '../components/notifications/NotificationList';
import GlobalLayout from '../components/layout/GlobalLayout';

const NotificationsPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <GlobalLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white flex items-center gap-2">
              <Bell className="h-8 w-8 text-blue-400" />
              {t('notifications')}
            </h1>
            <p className="text-gray-400">
              {t('stayUpdatedAccount')}
            </p>
          </div>
        </div>

        {/* Notifications List */}
        <NotificationList
          compact={false}
          maxItems={20}
          showSettings={true}
          className="w-full"
        />
        
        {/* Footer Information */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-3 text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-400" />
            {t('notificationsFaq')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-white mb-1">{t('howManageNotifications')}</h4>
              <p>{t('howManageNotificationsAnswer')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('whyGettingNotifications')}</h4>
              <p>{t('whyGettingNotificationsAnswer')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('canDisableNotifications')}</h4>
              <p>{t('canDisableNotificationsAnswer')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('howLongNotificationsStored')}</h4>
              <p>{t('howLongNotificationsStoredAnswer')}</p>
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default NotificationsPage;