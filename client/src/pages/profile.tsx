import { useState } from "react";
import { useRolePlay } from "@/context/RolePlayContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Scene, Character } from "@shared/schema";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import { 
  Clock, 
  Users, 
  Trash2, 
  Download, 
  Crown,
  Globe,
  LogOut,
  User
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

const ProfilePage = () => {
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
  
  // Fetch recent scenes
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
    <div className="px-4 pt-4 pb-16">
      <h1 className="font-poppins font-bold text-2xl mb-4">{t('profile')}</h1>
      
      {/* User Info Section */}
      <div className="bg-secondary rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-3">
              <User className="text-blue-600 h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{user?.username}</h3>
              <p className="text-sm text-gray-500">Member since {new Date(user?.created_at || '').toLocaleDateString()}</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="bg-red-100 hover:bg-red-200 p-2 rounded-full transition-colors">
                <LogOut className="text-red-600 h-5 w-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign you out of your account and redirect you to the home page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                  Logout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-secondary rounded-2xl p-4">
          <h3 className="text-sm text-gray-400 mb-2">{t('todaysChatTime')}</h3>
          <div className="flex items-center">
            <Clock className="text-accent text-xl mr-2" />
            <span className="text-xl font-poppins font-semibold">37 min</span>
          </div>
        </div>
        
        <div className="bg-secondary rounded-2xl p-4">
          <h3 className="text-sm text-gray-400 mb-2">{t('totalCharacters')}</h3>
          <div className="flex items-center">
            <Users className="text-accent text-xl mr-2" />
            <span className="text-xl font-poppins font-semibold">12</span>
          </div>
        </div>
        
        <div className="bg-secondary rounded-2xl p-4 col-span-2">
          <h3 className="text-sm text-gray-400 mb-2">{t('activeScenes')}</h3>
          <div className="flex overflow-x-auto py-2 hide-scrollbar">
            {scenes.map(scene => (
              <div key={scene.id} className="flex-shrink-0 mr-3 w-16 text-center">
                <ImageWithFallback
                  src={scene.imageUrl}
                  alt={scene.name}
                  fallbackText={scene.name}
                  size="lg"
                  showSpinner={true}
                  className="w-14 h-14 mx-auto mb-1"
                />
                <span className="text-xs">{scene.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Settings */}
      <div className="space-y-6">
        <div className="bg-secondary rounded-2xl p-4">
          <h3 className="font-poppins font-semibold text-lg mb-4">{t('settings')}</h3>
          
          <div className="mb-4 space-y-4">
            <LanguageSelector type="interface" />
            <LanguageSelector type="chat" />
          </div>
          
          <div className="w-full h-px bg-gray-700 my-4"></div>
          
          <h4 className="font-poppins font-semibold text-md mb-4">AI {t('settings')}</h4>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm">{t('contextWindowLength')}</label>
              <span className="text-sm text-accent">{contextWindowLength}k tokens</span>
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
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm">{t('temperatureLevel')}</label>
              <span className="text-sm text-accent">{formattedTemperature}</span>
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
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm">{t('memoryEnabled')}</label>
            <Switch 
              checked={memoryEnabled}
              onCheckedChange={setMemoryEnabled}
            />
          </div>
        </div>
        
        <div className="bg-secondary rounded-2xl p-4">
          <h3 className="font-poppins font-semibold text-lg mb-4">{t('settings')}</h3>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm">{t('nsfwLevel')}</label>
              <span className="text-sm text-accent">{nsfwLevelLabels[nsfwLevel]} ({nsfwLevel})</span>
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
          </div>
        </div>
        
        <div className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button 
                className="w-full bg-secondary hover:bg-secondary/80 rounded-2xl px-4 py-3 text-white font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="mr-2 h-5 w-5" /> 
                {t('clearChatHistory')}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to clear all your chat history? This action cannot be undone and will permanently delete all your conversations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleClearChatHistory}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <button className="w-full bg-secondary hover:bg-secondary/80 rounded-2xl px-4 py-3 text-white font-medium transition-colors flex items-center justify-center">
            <Download className="mr-2 h-5 w-5" /> {t('exportScripts')}
          </button>
          
          <button className="w-full bg-primary hover:bg-accent rounded-2xl px-4 py-3 text-white font-medium transition-colors flex items-center justify-center">
            <Crown className="mr-2 h-5 w-5" /> {t('subscribe')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
