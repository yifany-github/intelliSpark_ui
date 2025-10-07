import React, { useState, useEffect } from "react";
import { useNavigation } from "@/contexts/NavigationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { MoreHorizontal, Sparkles, MessageSquare, Search, LogIn } from "lucide-react";
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
    'login': LogIn,
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

  // Fix bottom navigation position when browser UI shows/hides on mobile
  useEffect(() => {
    const updateHeight = () => {
      // Use visualViewport if available for better mobile support
      if (window.visualViewport) {
        document.documentElement.style.setProperty(
          '--viewport-height',
          `${window.visualViewport.height}px`
        );
      }
    };

    updateHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);

      return () => {
        window.visualViewport?.removeEventListener('resize', updateHeight);
        window.visualViewport?.removeEventListener('scroll', updateHeight);
      };
    }
  }, []);

  // Add login tab for unauthenticated users (not in main configuration)
  const tabs = isAuthenticated ? mobileTabItems : [
    ...mobileTabItems,
    {
      id: "login",
      label: "signIn" as any, // Cast to any to avoid type issues temporarily
      path: "/login",
      icon: LogIn,
      requiresAuth: false,
      showInMobileTab: true
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 z-20 pb-safe">
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
              className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] py-2 px-4 relative transition-all duration-200 rounded-xl touch-manipulation ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200 active:scale-95"
              }`}
              aria-label={t(tab.label)}
            >
              {IconComponent ? (
                <IconComponent className={`w-6 h-6 transition-colors ${
                  activeTab === tab.id ? "text-white" : "text-gray-400"
                }`} />
              ) : (
                <div className="w-6 h-6 bg-gray-600 rounded" title={`No icon for ${tab.id}`} />
              )}
              <span className={`text-xs mt-1 font-medium transition-colors leading-tight ${
                activeTab === tab.id ? "text-white" : "text-gray-400"
              }`}>{t(tab.label)}</span>
              {activeTab === tab.id && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full"></div>
              )}
            </button>
          );
        })}

        {/* More Menu Button - Only show for authenticated users */}
        {isAuthenticated && moreMenuItems.length > 0 && (
          <Sheet open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center min-h-[56px] min-w-[56px] py-2 px-4 relative transition-all duration-200 rounded-xl text-gray-400 hover:text-gray-200 active:scale-95 touch-manipulation"
                aria-label={t('more')}
              >
                <MoreHorizontal className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium leading-tight">{t('more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-gray-900 border-gray-700 pb-20">
              <SheetHeader>
                <SheetTitle className="text-white">{t('more')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2 mb-4">
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
        )}
      </div>
    </div>
  );
};

export default TabNavigation;
