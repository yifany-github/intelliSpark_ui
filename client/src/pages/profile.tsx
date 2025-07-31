import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { 
  Clock, 
  Users, 
  Settings,
  LogOut,
  User,
  Activity,
  Award
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
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  

  // Logout function
  const handleLogout = () => {
    logout();
    navigate("/");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };
  
  return (
    <GlobalLayout>
      <div className="px-2 sm:px-4 pt-2 sm:pt-4 pb-8 sm:pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-6 h-6 text-blue-400" />
              <h1 className="font-poppins font-bold text-2xl text-white">{t('profile')}</h1>
            </div>
            <p className="text-gray-400">{t('manageAccount')}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-300" />
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
                {user?.email?.split('@')[0] || user?.username || 'User'}
              </h3>
              <p className="text-sm text-gray-400">
                {user?.email || 'No email provided'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Member since {new Date(user?.created_at || '').toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 text-sm text-gray-400">
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
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Clock className="text-blue-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('todaysChatTime')}</h3>
                <span className="text-2xl font-bold text-white">37 min</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">+12 min {t('fromYesterday')}</div>
          </div>
          
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Users className="text-purple-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('totalCharacters')}</h3>
                <span className="text-2xl font-bold text-white">12</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">{t('acrossScenes')}</div>
          </div>
          
          <div className="bg-gray-800 rounded-2xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <Award className="text-green-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm text-gray-400">{t('achievementLevel')}</h3>
                <span className="text-2xl font-bold text-white">8</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">{t('conversationExpert')}</div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-lg text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 text-indigo-400 mr-2" />
            {t('recentActivity')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white">{t('startedChatWith')} Elara</p>
                  <p className="text-xs text-gray-400">2 {t('hoursAgo')}</p>
                </div>
              </div>
              <span className="text-xs text-blue-400">{t('active')}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white">{t('unlockedAchievement')}: {t('conversationalist')}</p>
                  <p className="text-xs text-gray-400">1 {t('dayAgo')}</p>
                </div>
              </div>
              <span className="text-xs text-green-400">+50 XP</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white">{t('explored')} 3 {t('newCharacters')}</p>
                  <p className="text-xs text-gray-400">2 {t('daysAgo')}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{t('completed')}</span>
            </div>
          </div>
        </div>
        
      
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/settings')}
            className="bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-left transition-colors group"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30 transition-colors">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Settings</h3>
                <p className="text-sm text-gray-400">{t('customizeExperience')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{t('manageAISettings')}</p>
          </button>
          
          <button 
            onClick={() => navigate('/payment')}
            className="bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-left transition-colors group"
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-green-600/20 rounded-lg group-hover:bg-green-600/30 transition-colors">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{t('getMoreTokens')}</h3>
                <p className="text-sm text-gray-400">{t('continueConversations')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">{t('purchaseTokenPackages')}</p>
          </button>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default ProfilePage;
