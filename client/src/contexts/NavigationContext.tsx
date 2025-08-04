import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { NAVIGATION_CONFIG, getVisibleNavItems, isActiveRoute, NavigationItem } from '@/config/navigation';

interface NavigationContextType {
  // Existing collapse functionality
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  
  // New navigation functionality
  location: string;
  isAuthenticated: boolean;
  
  // Navigation functions
  navigateToHome: () => void;
  navigateToPath: (path: string) => void;
  navigateBack: () => void;
  navigateToPayment: () => void;
  navigateToLogin: () => void;
  
  // Configuration getters
  getSidebarItems: () => NavigationItem[];
  getTopNavItems: () => NavigationItem[];
  getMobileTabItems: () => NavigationItem[];
  isRouteActive: (path: string) => boolean;
  
  // Raw config access
  allNavigationItems: NavigationItem[];
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Existing collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // 从 localStorage 获取保存的状态
    const saved = localStorage.getItem('navigationCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 保存状态到 localStorage
  useEffect(() => {
    localStorage.setItem('navigationCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // New navigation functions
  const navigateToHome = () => {
    navigate('/');
  };
  
  const navigateToPath = (path: string) => {
    navigate(path);
  };
  
  const navigateBack = () => {
    window.history.back();
  };
  
  const navigateToPayment = () => {
    navigate('/payment');
  };
  
  const navigateToLogin = () => {
    navigate('/login');
  };
  
  const getSidebarItems = () => getVisibleNavItems('sidebar', isAuthenticated);
  const getTopNavItems = () => getVisibleNavItems('topnav', isAuthenticated);
  const getMobileTabItems = () => getVisibleNavItems('mobile', isAuthenticated);
  
  const isRouteActive = (path: string) => isActiveRoute(path, location);

  const value = {
    // Existing
    isCollapsed,
    setIsCollapsed,
    toggleCollapsed,
    
    // New
    location,
    isAuthenticated,
    navigateToHome,
    navigateToPath,
    navigateBack,
    navigateToPayment,
    navigateToLogin,
    getSidebarItems,
    getTopNavItems,
    getMobileTabItems,
    isRouteActive,
    allNavigationItems: NAVIGATION_CONFIG
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};