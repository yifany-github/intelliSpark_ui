import { Home, MessageSquare, Heart, Search, Plus, Coins, User, Bell, Settings, Users } from 'lucide-react';
import { TranslationKey } from '@/contexts/LanguageContext';

export interface NavigationItem {
  id: string;
  label: TranslationKey;
  path: string;
  icon: any;
  requiresAuth?: boolean;
  badge?: TranslationKey;
  showInSidebar?: boolean;
  showInTopNav?: boolean;
  showInMobileTab?: boolean;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    id: 'home',
    label: 'home',
    path: '/',
    icon: Home,
    showInSidebar: true,
    showInTopNav: false,
    showInMobileTab: false  // Will map to characters for mobile
  },
  {
    id: 'characters',
    label: 'characters',
    path: '/characters',
    icon: Home,
    showInSidebar: false, // Home covers this
    showInTopNav: false,
    showInMobileTab: true  // Primary mobile tab
  },
  {
    id: 'chats',
    label: 'recentChats',
    path: '/chats',
    icon: MessageSquare,
    requiresAuth: true,
    showInSidebar: true,
    showInTopNav: true,
    showInMobileTab: true
  },
  {
    id: 'favorites',
    label: 'favorites',
    path: '/favorites',
    icon: Heart,
    requiresAuth: true,
    showInSidebar: true,
    showInTopNav: false,
    showInMobileTab: false
  },
  {
    id: 'discover',
    label: 'discover',
    path: '/discover',
    icon: Search,
    showInSidebar: true,
    showInTopNav: false,
    showInMobileTab: false
  },
  {
    id: 'create-character',
    label: 'createCharacter',
    path: '/create-character',
    icon: Plus,
    requiresAuth: true,
    showInSidebar: true,
    showInTopNav: false,
    showInMobileTab: false
  },
  {
    id: 'my-characters',
    label: 'myCharacters',
    path: '/my-characters',
    icon: Users,
    requiresAuth: true,
    showInSidebar: true,
    showInTopNav: false,
    showInMobileTab: false
  },
  {
    id: 'payment',
    label: 'tokens',
    path: '/payment',
    icon: Coins,
    requiresAuth: true,
    showInSidebar: false,
    showInTopNav: false,
    showInMobileTab: true
  },
  {
    id: 'profile',
    label: 'profile',
    path: '/profile',
    icon: User,
    requiresAuth: true,
    showInSidebar: false,
    showInTopNav: true,
    showInMobileTab: true
  },
  {
    id: 'notifications',
    label: 'notifications',
    path: '/notifications',
    icon: Bell,
    requiresAuth: true,
    showInSidebar: false,
    showInTopNav: false,
    showInMobileTab: false
  },
  {
    id: 'settings',
    label: 'settings',
    path: '/settings',
    icon: Settings,
    requiresAuth: true,
    showInSidebar: false,
    showInTopNav: false,
    showInMobileTab: false
  }
];

// Helper functions
export const getVisibleNavItems = (
  location: 'sidebar' | 'topnav' | 'mobile',
  isAuthenticated: boolean
): NavigationItem[] => {
  return NAVIGATION_CONFIG.filter(item => {
    // Check authentication requirement
    if (item.requiresAuth && !isAuthenticated) {
      return false;
    }
    
    // Check location visibility
    switch (location) {
      case 'sidebar':
        return item.showInSidebar;
      case 'topnav':
        return item.showInTopNav;
      case 'mobile':
        return item.showInMobileTab;
      default:
        return false;
    }
  });
};

export const isActiveRoute = (itemPath: string, currentLocation: string): boolean => {
  // Home page logic (maps to characters)
  if (itemPath === '/' && (currentLocation === '/' || currentLocation === '/characters')) {
    return true;
  }
  
  // Exact match for other routes
  if (itemPath !== '/' && currentLocation.startsWith(itemPath)) {
    return true;
  }
  
  return false;
};
