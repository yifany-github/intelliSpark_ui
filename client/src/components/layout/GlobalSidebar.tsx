import React from 'react';
import {
  HelpCircle,
  FileText,
  Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchTokenBalance } from '@/services/tokenService';
import { IconType } from 'react-icons';
import { SiDiscord, SiInstagram, SiReddit, SiX } from 'react-icons/si';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const resolveAvatarUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export default function GlobalSidebar() {
  const { user, isAuthenticated } = useAuth();
  const {
    isCollapsed,
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
    enabled: isAuthenticated,
    staleTime: 0,
    retry: 1,
  });

  // Refetch when authentication status changes
  React.useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const sidebarItems = getSidebarItems();

  const bottomLinks = [
    { icon: HelpCircle, label: t('aboutUs'), path: '/about' },
    { icon: FileText, label: t('faq'), path: '/faq' },
    // Blog is reserved for later; hide to avoid dead link for now
  ];

  type SocialLink = {
    id: string;
    label: string;
    href: string;
    icon: IconType;
    title?: string;
  };

  const socialLinks: SocialLink[] = [
    {
      id: 'discord',
      label: 'Discord',
      href: 'https://discord.com/',
      icon: SiDiscord,
      title: 'Discord (coming soon)',
    },
    {
      id: 'x',
      label: 'X',
      href: 'https://x.com/yy_chat27027',
      icon: SiX,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/yychat_ins/',
      icon: SiInstagram,
    },
    {
      id: 'reddit',
      label: 'Reddit',
      href: 'https://www.reddit.com/',
      icon: SiReddit,
      title: 'Reddit (coming soon)',
    },
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
            className="w-10 h-10 bg-slate-800/70 rounded-full flex items-center justify-center overflow-hidden hover:bg-slate-700 transition-colors cursor-pointer"
            onClick={navigateToHome}
            title={isCollapsed ? (isAuthenticated ? (user?.username || ((user?.email && typeof user.email === 'string') ? user.email.split('@')[0] : t('user'))) : t('guest')) : undefined}
          >
            {isAuthenticated && (user as any)?.avatar_url ? (
              <img
                src={resolveAvatarUrl((user as any).avatar_url)}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm text-white font-medium">
                {isAuthenticated ? (user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U') : 'G'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div>
              <div className="font-medium text-white">
                {isAuthenticated ? (user?.username || ((user?.email && typeof user.email === 'string') ? user.email.split('@')[0] : t('user'))) : t('guest')}
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

        <div
          className={
            isCollapsed
              ? 'flex flex-col items-center space-y-3 py-2'
              : 'flex items-center space-x-3 px-3 py-2'
          }
        >
          {socialLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group inline-flex items-center justify-center text-gray-400 transition-colors duration-200 ${
                  isCollapsed
                    ? 'rounded-xl p-2 hover:bg-gray-100/10'
                    : 'rounded-xl p-2 hover:bg-gray-100/5'
                }`}
                aria-label={link.label}
                title={link.title ?? link.label}
              >
                <Icon
                  className={`${
                    isCollapsed ? 'h-5 w-5' : 'h-4 w-4'
                  } group-hover:text-gray-200 transition-colors`}
                />
              </a>
            );
          })}
        </div>
        
        {!isCollapsed && (
          <div className="text-xs text-gray-500 px-3 text-center space-y-1">
            <div className="flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => navigateToPath('/privacy-policy')}
                className="text-gray-400 hover:text-gray-200 underline-offset-4 hover:underline transition-colors"
              >
                {t('privacyPolicy')}
              </button>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={() => navigateToPath('/terms-of-use')}
                className="text-gray-400 hover:text-gray-200 underline-offset-4 hover:underline transition-colors"
              >
                {t('termsOfUse')}
              </button>
            </div>
            <div>{t('copyright')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
