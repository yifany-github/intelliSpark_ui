import React from 'react';
import { 
  Home, 
  Heart, 
  Coins, 
  Trophy, 
  MessageSquare, 
  Plus, 
  User, 
  Bell, 
  Star, 
  Search,
  Settings,
  HelpCircle,
  FileText,
  Smartphone,
  Twitter,
  MessageCircle,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchTokenBalance } from '@/services/tokenService';

export default function GlobalSidebar() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const { isCollapsed, toggleCollapsed } = useNavigation();
  const { t } = useLanguage();

  const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
    queryKey: ['tokenBalance', isAuthenticated],
    queryFn: fetchTokenBalance,
    refetchInterval: isAuthenticated ? 30000 : false,
    enabled: isAuthenticated && !!localStorage.getItem('auth_token'),
    staleTime: 0,
    retry: 1,
  });

  // Refetch when authentication status changes
  React.useEffect(() => {
    if (isAuthenticated && localStorage.getItem('auth_token')) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const menuItems = [
    { icon: Home, label: t('home'), path: '/', active: location === '/' || location === '/characters' },
    { icon: MessageSquare, label: t('recentChats'), path: '/chats', active: location === '/chats' || location.startsWith('/chats/') },
    { icon: Heart, label: t('favorites'), path: '/favorites', active: location === '/favorites' },
    { icon: Search, label: t('discover'), path: '/discover', active: location === '/discover' },
    { icon: Plus, label: t('createCharacter'), path: '/create-character', active: location === '/create-character' },
    { icon: Coins, label: t('tokens'), path: '/payment', badge: t('updated'), active: location === '/payment' },
    { icon: User, label: t('profile'), path: '/profile', active: location === '/profile' },
    { icon: Bell, label: t('notifications'), path: '/notifications', active: location === '/notifications' },
    { icon: Settings, label: t('settings'), path: '/settings', active: location === '/settings' },
  ];

  const bottomLinks = [
    { icon: HelpCircle, label: t('aboutUs'), path: '/about' },
    { icon: FileText, label: t('faq'), path: '/faq' },
    { icon: FileText, label: t('blog'), path: '/blog' },
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 h-screen fixed left-0 top-0 z-10 transition-all duration-300 flex flex-col hidden sm:flex`}>
      <div className="p-4 flex-1 min-h-0">
        {/* Toggle Button */}
        <div className="flex items-center justify-between mb-6">
          {!isCollapsed && (
            <span className="text-lg font-bold text-white">{t('navigation')}</span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            {isCollapsed ? (
              <Menu className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* User Profile */}
        <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div 
            className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-500 transition-colors cursor-pointer"
            title={isCollapsed ? (isAuthenticated ? (user?.email?.split('@')[0] || t('user')) : t('guest')) : undefined}
          >
            <span className="text-sm text-white font-medium">
              {isAuthenticated ? (user?.email?.[0]?.toUpperCase() || 'U') : 'G'}
            </span>
          </div>
          {!isCollapsed && (
            <div>
              <div className="font-medium text-white">
                {isAuthenticated ? (user?.email?.split('@')[0] || t('user')) : t('guest')}
              </div>
              <div className="text-sm text-green-400 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                {isAuthenticated ? (
                  tokenLoading ? t('loading') : 
                  tokenError ? t('errorLoading') : 
                  `${tokenBalance?.balance ?? '?'} ${t('tokens')}`
                ) : t('notLoggedIn')}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-pink-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-xs px-2 py-1 rounded">{item.badge}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Bottom Links */}
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <div className="space-y-2 mb-4">
          {bottomLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg text-gray-400 hover:bg-gray-700 text-sm transition-colors`}
              title={isCollapsed ? link.label : undefined}
            >
              <link.icon className="w-4 h-4" />
              {!isCollapsed && <span>{link.label}</span>}
            </button>
          ))}
        </div>
        
        <div className={`flex ${isCollapsed ? 'justify-center' : 'space-x-2 px-3'} py-2`}>
          <Smartphone className="w-4 h-4 text-gray-400" />
          {!isCollapsed && (
            <>
              <Twitter className="w-4 h-4 text-gray-400" />
              <MessageCircle className="w-4 h-4 text-gray-400" />
            </>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="text-xs text-gray-500 px-3 text-center">
            <div>{t('privacyPolicy')} | {t('termsOfUse')}</div>
            <div className="mt-1">{t('copyright')}</div>
          </div>
        )}
      </div>
    </div>
  );
}