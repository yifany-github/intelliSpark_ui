import React from 'react';
import { ArrowLeft, Bell, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useLocation } from 'wouter';
import { useLanguage } from '../context/LanguageContext';
import { NotificationList } from '../components/notifications/NotificationList';
import GlobalLayout from '../components/layout/GlobalLayout';

const NotificationsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const handleBack = () => {
    setLocation('/profile');
  };

  return (
    <GlobalLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('profile')}
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-white flex items-center gap-2">
                <Bell className="h-8 w-8 text-blue-400" />
                {t('notifications')}
              </h1>
              <p className="text-gray-400">
                Stay updated with your account activities and system announcements
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setLocation('/settings/notifications')}
              className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('settings')}
            </Button>
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
            {t('notifications')} {t('faq')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-white mb-1">How do I manage notifications?</h4>
              <p>You can filter notifications by type, mark them as read, or delete them individually. Use the settings to customize your notification preferences.</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">Why am I getting notifications?</h4>
              <p>We send notifications for important account activities like payments, system updates, and admin announcements to keep you informed.</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">Can I disable notifications?</h4>
              <p>Yes, you can customize your notification preferences in the settings. You can choose which types of notifications you want to receive.</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">How long are notifications stored?</h4>
              <p>Notifications are kept for 30 days by default. Some important notifications may be stored longer for your reference.</p>
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default NotificationsPage;