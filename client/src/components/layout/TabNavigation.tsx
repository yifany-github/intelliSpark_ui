import { useState, useEffect } from "react";
import { useNavigation } from "@/contexts/NavigationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

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
  const mobileTabItems = getMobileTabItems();

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
        {tabs.map((tab) => (
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
            {tab.icon && typeof tab.icon === 'function' ? (
              <tab.icon className={`w-5 h-5 transition-colors ${
                activeTab === tab.id ? "text-white" : "text-gray-400"
              }`} />
            ) : tab.id === "login" ? (
              <i className={`fas fa-sign-in-alt text-lg transition-colors ${
                activeTab === tab.id ? "text-white" : "text-gray-400"
              }`}></i>
            ) : (
              <i className={`fas fa-user text-lg transition-colors ${
                activeTab === tab.id ? "text-white" : "text-gray-400"
              }`}></i>
            )}
            <span className={`text-xs mt-1.5 font-medium transition-colors ${
              activeTab === tab.id ? "text-white" : "text-gray-400"
            }`}>{t(tab.label)}</span>
            {activeTab === tab.id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
