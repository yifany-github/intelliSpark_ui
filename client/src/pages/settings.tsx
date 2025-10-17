import { useState } from "react";
import { useRolePlay } from "@/contexts/RolePlayContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useMutation } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { 
  Clock, 
  Users, 
  Trash2, 
  Download, 
  Crown,
  Globe,
  LogOut,
  Settings as SettingsIcon,
  Sliders,
  Bell,
  Database,
  Zap
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import LanguageSelector from "@/components/settings/LanguageSelector";
import AIModelSelector from "@/components/settings/AIModelSelector";
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
import { queryClient, apiRequest } from "@/lib/queryClient";

const SettingsPage = () => {
  const { 
    memoryEnabled, setMemoryEnabled,
  } = useRolePlay();
  
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { navigateToHome, navigateToPayment } = useNavigation();
  
  
  // Simple clear chat history function
  const handleClearChatHistory = async () => {
    try {
      await apiRequest('DELETE', '/api/chats');
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast({
        title: "Success",
        description: "Chat history cleared successfully",
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to clear chat history",
        variant: "destructive",
      });
    }
  };

  // Logout function
  const handleLogout = () => {
    logout();
    navigateToHome();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };
  
  
  
  return (
    <GlobalLayout>
      <div className="px-2 sm:px-4 pt-2 sm:pt-4 pb-8 sm:pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <SettingsIcon className="w-6 h-6 text-brand-secondary" />
            <h1 className="font-poppins font-bold text-2xl text-white">{t('settings')}</h1>
          </div>
          <p className="text-gray-400">{t('customizeAIChat')} {t('applicationPreferences')}</p>
        </div>

        {/* Language Settings */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Globe className="w-5 h-5 text-brand-secondary" />
            <h3 className="font-semibold text-lg text-white">{t('languageSettings')}</h3>
          </div>
          <div className="space-y-4">
            <LanguageSelector type="interface" />
            <LanguageSelector type="chat" />
          </div>
        </div>
        
        {/* AI Settings */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Sliders className="w-5 h-5 text-brand-secondary" />
            <h3 className="font-semibold text-lg text-white">AI {t('settings')}</h3>
          </div>
          
          <div className="space-y-6">
            {/* Memory */}
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div>
                <label className="text-sm text-gray-300 font-medium">{t('memoryEnabled')}</label>
                <p className="text-xs text-gray-500">{t('allowAI')} {t('rememberContext')} {t('acrossConversations')}</p>
              </div>
              <Switch 
                checked={memoryEnabled}
                onCheckedChange={setMemoryEnabled}
              />
            </div>
          </div>
        </div>
        
        {/* AI Model Selection */}
        <AIModelSelector />
        

        
        {/* Data & Privacy */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="w-5 h-5 text-brand-secondary" />
            <h3 className="font-semibold text-lg text-white">{t('dataPrivacy')}</h3>
          </div>
          
          <div className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button 
                  className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-3 text-white font-medium transition-colors flex items-center justify-center"
                >
                  <Trash2 className="mr-2 h-5 w-5" /> 
                  {t('clearChatHistory')}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-800 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">{t('clearChatHistory')}</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    {t('areYouSure')} {t('clearAllChat')} {t('historyAction')} {t('cannotUndone')} {t('permanentlyDelete')} {t('allConversations')}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearChatHistory}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t('clearHistory')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <button className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-3 text-white font-medium transition-colors flex items-center justify-center">
              <Download className="mr-2 h-5 w-5" /> 
              {t('exportScripts')}
            </button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="w-5 h-5 text-brand-secondary" />
            <h3 className="font-semibold text-lg text-white">{t('accountActions')}</h3>
          </div>

          <div className="space-y-3">
            <button
              onClick={navigateToPayment}
              className="w-full bg-brand-secondary hover:bg-amber-600 rounded-lg px-4 py-3 text-white font-medium transition-colors flex items-center justify-center"
            >
              <Crown className="mr-2 h-5 w-5" />
              {t('subscribe')}
            </button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg px-4 py-3 text-red-400 font-medium transition-colors flex items-center justify-center">
                  <LogOut className="mr-2 h-5 w-5" />
                  Logout
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-800 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">{t('areYouSure')} {t('wantLogout')}</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    {t('signOut')} {t('redirectHome')}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                    {t('logout')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default SettingsPage;
