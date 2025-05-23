import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";

const TabNavigation = () => {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("scenes");
  const { t } = useLanguage();

  useEffect(() => {
    if (location === "/" || location.startsWith("/scenes")) {
      setActiveTab("scenes");
    } else if (location.startsWith("/characters")) {
      setActiveTab("characters");
    } else if (location.startsWith("/chats")) {
      setActiveTab("chats");
    } else if (location.startsWith("/profile")) {
      setActiveTab("profile");
    }
  }, [location]);

  const tabs = [
    { id: "scenes", icon: "map-location-dot", label: t("scenes"), path: "/scenes" },
    { id: "characters", icon: "user", label: t("characters"), path: "/characters" },
    { id: "chats", icon: "message", label: t("chats"), path: "/chats" },
    { id: "profile", icon: "user-gear", label: t("profile"), path: "/profile" },
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
              activeTab === tab.id ? "text-white" : "text-gray-500"
            }`}
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
