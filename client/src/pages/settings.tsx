import { useState } from "react";
import { useRolePlay } from "@/context/RolePlayContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Scene, Character } from "../types";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
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
  Shield,
  Palette,
  Bell,
  Database,
  Zap
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import LanguageSelector from "@/components/settings/LanguageSelector";
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
    nsfwLevel, setNsfwLevel,
    contextWindowLength, setContextWindowLength,
    temperature, setTemperature,
    memoryEnabled, setMemoryEnabled,
    setCurrentChat
  } = useRolePlay();
  
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  // Fetch recent scenes for display in active scenes setting
  const { data: scenes = [] } = useQuery<Scene[]>({
    queryKey: ["/api/scenes?limit=5"],
  });
  
  // Simple clear chat history function
  const handleClearChatHistory = async () => {
    try {
      await apiRequest('DELETE', '/api/chats');
      setCurrentChat(null);
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
    navigate("/");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };
  
  // Format temperature for display (0.0 - 1.0)
  const formattedTemperature = (temperature / 100).toFixed(1);
  
  // NSFW Level labels
  const nsfwLevelLabels = ["None", "Mild", "Moderate", "Maximum"];
  
  return (
    <GlobalLayout>
      <div className="px-2 sm:px-4 pt-2 sm:pt-4 pb-8 sm:pb-16 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <SettingsIcon className="w-6 h-6 text-blue-400" />
            <h1 className="font-poppins font-bold text-2xl text-white">{t('settings')}</h1>
          </div>
          <p className="text-gray-400">{t('customizeAIChat')} {t('applicationPreferences')}</p>
        </div>
        
        {/* Language Settings */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Globe className="w-5 h-5 text-green-400" />
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
            <Sliders className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-lg text-white">AI {t('settings')}</h3>
          </div>
          
          <div className="space-y-6">
            {/* Context Window Length */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-300">{t('contextWindowLength')}</label>
                <span className="text-sm text-purple-400 bg-purple-900/30 px-2 py-1 rounded">{contextWindowLength}k tokens</span>
              </div>
              <Slider
                value={[contextWindowLength]}
                min={1}
                max={15}
                step={1}
                onValueChange={(value) => setContextWindowLength(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{t('short')}</span>
                <span>{t('long')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('controlsContextWindow')}</p>
            </div>
            
            {/* Temperature */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-300">{t('temperatureLevel')}</label>
                <span className="text-sm text-orange-400 bg-orange-900/30 px-2 py-1 rounded">{formattedTemperature}</span>
              </div>
              <Slider
                value={[temperature]}
                min={0}
                max={100}
                step={10}
                onValueChange={(value) => setTemperature(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{t('precise')}</span>
                <span>{t('creative')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{t('higherValues')} {t('moreCreative')} {t('unpredictable')}</p>
            </div>
            
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
        
        {/* Content & Safety Settings */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-lg text-white">{t('contentSafety')}</h3>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-300">{t('nsfwLevel')}</label>
              <span className="text-sm text-red-400 bg-red-900/30 px-2 py-1 rounded">
                {nsfwLevelLabels[nsfwLevel]} ({nsfwLevel})
              </span>
            </div>
            <Slider
              value={[nsfwLevel]}
              min={0}
              max={3}
              step={1}
              onValueChange={(value) => setNsfwLevel(value[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{t('none')}</span>
              <span>{t('strict')}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('controlsLevel')} {t('matureContent')} {t('allowedConversations')}</p>
          </div>
        </div>

        {/* Scene Preferences */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Palette className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-lg text-white">{t('activeScenes')}</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">{t('yourRecentlyUsed')} {t('conversationSettings')}</p>
          <div className="flex overflow-x-auto py-2 hide-scrollbar">
            {scenes.map(scene => (
              <div key={scene.id} className="flex-shrink-0 mr-3 w-20 text-center">
                <ImageWithFallback
                  src={scene.imageUrl}
                  alt={scene.name}
                  fallbackText={scene.name}
                  size="lg"
                  showSpinner={true}
                  className="w-16 h-16 mx-auto mb-2 rounded-lg"
                />
                <span className="text-xs text-gray-300">{scene.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Data & Privacy */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="w-5 h-5 text-yellow-400" />
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
            <Zap className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg text-white">{t('accountActions')}</h3>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/payment')}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-3 text-white font-medium transition-colors flex items-center justify-center"
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