import { useState } from "react";
import { useRolePlay } from "@/context/RolePlayContext";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { Scene, Character } from "@shared/schema";
import { 
  Clock, 
  Users, 
  Trash2, 
  Download, 
  Crown,
  Globe
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import LanguageSelector from "@/components/settings/LanguageSelector";

const ProfilePage = () => {
  const { 
    nsfwLevel, setNsfwLevel,
    contextWindowLength, setContextWindowLength,
    temperature, setTemperature,
    memoryEnabled, setMemoryEnabled
  } = useRolePlay();
  
  const { t } = useLanguage();
  
  // Fetch recent scenes
  const { data: scenes = [] } = useQuery<Scene[]>({
    queryKey: ["/api/scenes?limit=5"],
  });
  
  // Format temperature for display (0.0 - 1.0)
  const formattedTemperature = (temperature / 100).toFixed(1);
  
  // NSFW Level labels
  const nsfwLevelLabels = ["None", "Mild", "Moderate", "Maximum"];
  
  return (
    <div className="px-4 pt-4 pb-16">
      <h1 className="font-poppins font-bold text-2xl mb-4">{t('profile')}</h1>
      
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
                <div className="w-14 h-14 rounded-full mx-auto mb-1 overflow-hidden bg-gradient-to-r from-primary/40 to-accent/40">
                  {scene.imageUrl && (
                    <img 
                      src={scene.imageUrl} 
                      alt={scene.name} 
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
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
          <button className="w-full bg-secondary hover:bg-secondary/80 rounded-2xl px-4 py-3 text-white font-medium transition-colors flex items-center justify-center">
            <Trash2 className="mr-2 h-5 w-5" /> {t('clearChatHistory')}
          </button>
          
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
