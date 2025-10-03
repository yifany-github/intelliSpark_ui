import React from 'react';
import {
  HelpCircle,
  FileText,
  Smartphone,
  Twitter,
  MessageCircle,
  Menu,
  ChevronLeft,
  Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchTokenBalance } from '@/services/tokenService';

export default function GlobalSidebar() {
  const { user, isAuthenticated } = useAuth();
  const {
    isCollapsed,
    toggleCollapsed,
    getSidebarItems,
    navigateToHome,
    navigateToPath,
    isRouteActive
  } = useNavigation();
  const { t, language, setLanguage } = useLanguage();

  const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
    queryKey: ['tokenBalance'],
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

  const sidebarItems = getSidebarItems();

  const bottomLinks = [
    { icon: HelpCircle, label: t('aboutUs'), path: '/about' },
    { icon: FileText, label: t('faq'), path: '/faq' },
    // Blog is reserved for later; hide to avoid dead link for now
  ];

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'} fixed left-4 z-20 overflow-hidden transition-[width] duration-300 ease-in-out flex flex-col hidden sm:flex liquid-glass-sidebar rounded-2xl`}
      style={{
        top: 'calc(3.5rem + 0.75rem + 0.5rem)',
        height: 'calc(100vh - 3.5rem - 0.75rem - 1rem - 0.5rem)'
      }}
    >
      <div className="p-4 flex-1 min-h-0">
        {/* Header spacer (branding handled in TopNavigation) */}
        <div className="flex items-center justify-between mb-6">
          {!isCollapsed && (
            <span className="text-sm text-gray-400" aria-hidden="true">&nbsp;</span>
          )}
        </div>

        {/* User Profile */}
        <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <div
            className="w-10 h-10 bg-slate-800/70 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer"
            onClick={navigateToHome}
            title={isCollapsed ? (isAuthenticated ? ((user?.email && typeof user.email === 'string') ? user.email.split('@')[0] : t('user')) : t('guest')) : undefined}
          >
            <span className="text-sm text-white font-medium">
              {isAuthenticated ? (user?.email?.[0]?.toUpperCase() || 'U') : 'G'}
            </span>
          </div>
          {!isCollapsed && (
            <div>
              <div className="font-medium text-white">
                {isAuthenticated ? ((user?.email && typeof user.email === 'string') ? user.email.split('@')[0] : t('user')) : t('guest')}
              </div>
              <div className="text-sm text-brand-secondary flex items-center">
                <span className="w-2 h-2 bg-brand-secondary rounded-full mr-2"></span>
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
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateToPath(item.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'space-x-4 px-3 py-2.5'} rounded-xl transition-colors duration-200 ease-in-out group ${
                isRouteActive(item.path)
                  ? 'bg-gray-100/10 text-white font-medium' 
                  : 'text-gray-300 hover:bg-gray-100/5 hover:text-gray-100'
              }`}
              title={isCollapsed ? t(item.label) : undefined}
            >
              <item.icon className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} transition-colors ${
                isRouteActive(item.path) 
                  ? 'text-white' 
                  : 'text-gray-400 group-hover:text-gray-200'
              }`} />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-normal">{t(item.label)}</span>
                  {item.badge && (
                    <span className="bg-red-500/80 text-xs px-2 py-0.5 rounded-full font-medium">{t(item.badge)}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Bottom Links */}
      <div className="p-4 border-t border-gray-700/50 flex-shrink-0">
        <div className="space-y-1 mb-4">
          {bottomLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigateToPath(link.path)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'space-x-4 px-3 py-2'} rounded-xl text-gray-400 hover:bg-gray-100/5 hover:text-gray-200 text-sm transition-colors duration-200 ease-in-out group`}
              title={isCollapsed ? link.label : undefined}
            >
              <link.icon className={`${isCollapsed ? 'w-6 h-6' : 'w-4 h-4'} group-hover:text-gray-200 transition-colors`} />
              {!isCollapsed && <span className="font-normal">{link.label}</span>}
            </button>
          ))}
        </div>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-3 py-2'} rounded-xl text-gray-400 hover:bg-gray-100/5 hover:text-brand-secondary transition-colors duration-200 ease-in-out group mb-3`}
          title={isCollapsed ? (language === 'en' ? 'English' : '中文') : undefined}
        >
          <Globe className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} group-hover:text-brand-secondary transition-colors`} />
          {!isCollapsed && (
            <span className="text-sm font-normal">{language === 'en' ? 'English' : '中文'}</span>
          )}
        </button>

        <div className={`flex ${isCollapsed ? 'justify-center' : 'space-x-2 px-3'} py-2`}>
          <Smartphone className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} text-gray-400`} />
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
