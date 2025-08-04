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
      label: "login",
      path: "/login",
      icon: () => <i className="fas fa-sign-in-alt text-lg"></i>, // Fallback for login
      requiresAuth: false,
      showInMobileTab: true
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border z-20">
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
            className={`flex flex-col items-center py-3 px-4 relative ${
              activeTab === tab.id ? "text-white" : "text-gray-500"
            }`}
          >
            {tab.icon && typeof tab.icon === 'function' ? (
              <tab.icon className="w-5 h-5" />
            ) : tab.id === "login" ? (
              <i className="fas fa-sign-in-alt text-lg"></i>
            ) : (
              <i className="fas fa-user text-lg"></i>
            )}
            <span className="text-xs mt-1">{t(tab.label)}</span>
            <div
              className={`tab-indicator w-6 left-1/2 -translate-x-1/2 ${
                activeTab === tab.id ? "bg-primary" : "bg-transparent"
              }`}
            ></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
