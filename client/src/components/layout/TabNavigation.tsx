import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const TabNavigation = () => {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("characters");
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (location === "/" || location.startsWith("/characters")) {
      setActiveTab("characters");
    } else if (location.startsWith("/chats")) {
      setActiveTab("chats");
    } else if (location.startsWith("/profile")) {
      setActiveTab("profile");
    } else if (location.startsWith("/payment")) {
      setActiveTab("payment");
    } else if (location.startsWith("/login")) {
      setActiveTab("login");
    }
  }, [location]);

  // Dynamic tabs based on authentication status
  const tabs = isAuthenticated ? [
    { id: "characters", icon: "user", label: t("characters"), path: "/characters", enabled: true },
    { id: "chats", icon: "message", label: t("chats"), path: "/chats", enabled: true },
    { id: "payment", icon: "coins", label: "Tokens", path: "/payment", enabled: true },
    { id: "profile", icon: "user-gear", label: t("profile"), path: "/profile", enabled: true },
  ] : [
    { id: "characters", icon: "user", label: t("characters"), path: "/characters", enabled: true },
    { id: "chats", icon: "message", label: "Chats", path: "/login", enabled: false },
    { id: "login", icon: "sign-in-alt", label: "Login", path: "/login", enabled: true },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-secondary border-t border-border z-20">
      <div className="max-w-5xl mx-auto flex justify-around items-center">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.path}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center py-3 px-4 relative ${
              activeTab === tab.id ? "text-white" : 
              tab.enabled ? "text-gray-500" : "text-gray-700"
            } ${!tab.enabled ? "opacity-60" : ""}`}
          >
            <i className={`fas fa-${tab.icon} text-lg`}></i>
            <span className="text-xs mt-1">{tab.label}</span>
            <div
              className={`tab-indicator w-6 left-1/2 -translate-x-1/2 ${
                activeTab === tab.id ? "bg-primary" : "bg-transparent"
              }`}
            ></div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
