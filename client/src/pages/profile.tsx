import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@/contexts/NavigationContext";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { fetchUserStats } from "@/services/tokenService";
import {
  Clock,
  Users,
  Settings,
  LogOut,
  User,
  Activity,
  Award,
  MessageSquare
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { TokenManagement } from "@/components/payment/TokenManagement";

const ProfilePage = () => {
  const { t } = useLanguage();
  const { user, logout, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { navigateToHome, navigateToPath } = useNavigation();

  // Fetch user statistics
  const { data: userStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['userStats'],
    queryFn: fetchUserStats,
    enabled: isAuthenticated && !!localStorage.getItem('auth_token'),
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });

  // Logout function
  const handleLogout = () => {
    logout();
    navigateToHome();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };

  // Format date helper
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  // Format relative time helper
  const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins} ${t('minutesAgo') || 'minutes ago'}`;
      if (diffHours < 24) return `${diffHours} ${t('hoursAgo') || 'hours ago'}`;
      return `${diffDays} ${t('daysAgo') || 'days ago'}`;
    } catch {
      return 'Unknown';
    }
  };
  
  return (
    <GlobalLayout>
      <div className="px-2 sm:px-4 pt-2 sm:pt-4 pb-8 sm:pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-6 h-6 text-brand-secondary" />
              <h1 className="font-poppins font-bold text-2xl text-white">{t('profile')}</h1>
            </div>
            <p className="text-gray-400">{t('manageAccount')}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateToPath('/settings')}
              className="p-2 bg-brand-secondary/20 hover:bg-brand-secondary/30 border border-brand-secondary/50 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-brand-secondary" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg transition-colors">
                  <LogOut className="text-red-400 h-5 w-5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-800 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Are you sure you want to logout?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    This will sign you out of your account and redirect you to the home page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* User Info Section */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center">
            <div className="bg-blue-600 p-4 rounded-full mr-4">
              <User className="text-white h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-xl text-white mb-1">
                {(user?.email && typeof user.email === 'string') ? user.email.split('@')[0] : (user?.username || 'User')}
              </h3>
              <p className="text-sm text-gray-400">
                {user?.email || 'No email provided'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Member since {formatDate(userStats?.member_since || user?.created_at)}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-sm text-brand-secondary">
                <Activity className="w-4 h-4" />
                <span>Active</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Token Management Section */}
        <div className="mb-6">
          <TokenManagement />
        </div>
      
        {/* Activity Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-brand-secondary/20 rounded-lg">
                <MessageSquare className="text-brand-secondary w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('totalChats') || 'Total Chats'}</h3>
                <span className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : statsError ? '0' : userStats?.total_chats || 0}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {statsLoading ? 'Loading...' : statsError ? 'Failed to load' : 'Chat sessions'}
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-brand-secondary/20 rounded-lg">
                <Users className="text-brand-secondary w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('uniqueCharacters') || 'Characters Chatted'}</h3>
                <span className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : statsError ? '0' : userStats?.unique_characters || 0}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {statsLoading ? 'Loading...' : statsError ? 'Failed to load' : 'Different characters'}
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-brand-secondary/20 rounded-lg">
                <Activity className="text-brand-secondary w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('totalMessages') || 'Total Messages'}</h3>
                <span className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : statsError ? '0' : userStats?.total_messages || 0}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {statsLoading ? 'Loading...' : statsError ? 'Failed to load' : 'Messages sent'}
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 text-brand-secondary mr-2" />
            {t('recentActivity') || 'Recent Activity'}
          </h3>
          {statsLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : statsError ? (
            <div className="text-center py-8 text-gray-500">Failed to load recent activity</div>
          ) : !userStats?.recent_activity || userStats.recent_activity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('noRecentActivity') || 'No recent activity yet. Start chatting with characters!'}
            </div>
          ) : (
            <div className="space-y-3">
              {userStats.recent_activity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {activity.character_avatar ? (
                      <ImageWithFallback
                        src={activity.character_avatar}
                        alt={activity.character_name}
                        className="w-8 h-8 rounded-full object-cover"
                        fallbackClassName="w-8 h-8 bg-brand-secondary rounded-full flex items-center justify-center"
                        fallbackContent={<User className="w-4 h-4 text-white" />}
                      />
                    ) : (
                      <div className="w-8 h-8 bg-brand-secondary rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-white">
                        {t('chattedWith') || 'Chatted with'} {activity.character_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeTime(activity.updated_at || activity.created_at)}
                      </p>
                    </div>
                  </div>
                  <MessageSquare className="w-4 h-4 text-brand-secondary" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

export default ProfilePage;
