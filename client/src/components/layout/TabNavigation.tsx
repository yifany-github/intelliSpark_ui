import React, { useState, useEffect } from "react";
import { useNavigation } from "@/contexts/NavigationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { MoreHorizontal, Sparkles, MessageSquare, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getMoreMenuItems } from "@/config/navigation";

const TabNavigation = () => {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { 
    location, 
    getMobileTabItems, 
    navigateToPath, 
    navigateToLogin,
    isRouteActive 
  } = useNavigation();
  
  const [activeTab, setActiveTab] = useState("characters");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const mobileTabItems = getMobileTabItems();
  const moreMenuItems = getMoreMenuItems(isAuthenticated);

  // Icon mapping as fallback - ensure these are the actual components
  const iconMap: Record<string, React.ComponentType<any>> = {
    'characters': Sparkles,
    'chats': MessageSquare,
    'discover': Search,
  };

  useEffect(() => {
    // Update active tab based on current location
    const currentItem = mobileTabItems.find(item => isRouteActive(item.path));
    if (currentItem) {
      setActiveTab(currentItem.id);
    } else if (location === "/" || location.startsWith("/characters")) {
      setActiveTab("characters");
    }
  }, [location, mobileTabItems, isRouteActive]);

  // Add login tab for unauthenticated users (not in main configuration)
  const tabs = isAuthenticated ? mobileTabItems : [
    ...mobileTabItems,
    {
      id: "login",
      label: "signIn" as any, // Cast to any to avoid type issues temporarily
      path: "/login",
      icon: () => <i className="fas fa-sign-in-alt text-lg"></i>, // Fallback for login
      requiresAuth: false,
      showInMobileTab: true
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 z-20">
      <div className="max-w-5xl mx-auto flex justify-around items-center">
        {tabs.map((tab) => {
          // Use icon from tab or fallback to iconMap
          const IconComponent = tab.icon || iconMap[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "login") {
                  navigateToLogin();
                } else {
                  navigateToPath(tab.path);
                }
                setActiveTab(tab.id);
              }}
              className={`flex flex-col items-center py-4 px-3 relative transition-all duration-200 rounded-xl ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200 active:scale-95"
              }`}
            >
              {IconComponent ? (
                <IconComponent className={`w-5 h-5 transition-colors ${
                  activeTab === tab.id ? "text-white" : "text-gray-400"
                }`} />
              ) : (
                <div className="w-5 h-5 bg-gray-600 rounded" title={`No icon for ${tab.id}`} />
              )}
              <span className={`text-xs mt-1.5 font-medium transition-colors ${
                activeTab === tab.id ? "text-white" : "text-gray-400"
              }`}>{t(tab.label)}</span>
              {activeTab === tab.id && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full"></div>
              )}
            </button>
          );
        })}

        {/* More Menu Button */}
        <Sheet open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center py-4 px-3 relative transition-all duration-200 rounded-xl text-gray-400 hover:text-gray-200 active:scale-95"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs mt-1.5 font-medium">{t('more')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-gray-900 border-gray-700">
            <SheetHeader>
              <SheetTitle className="text-white">{t('more')}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {moreMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigateToPath(item.path);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                >
                  {item.icon && typeof item.icon === 'function' && (
                    <item.icon className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-white font-medium">{t(item.label)}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default TabNavigation;
