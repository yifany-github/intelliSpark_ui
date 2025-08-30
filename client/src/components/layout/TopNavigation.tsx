import { Search, ChevronDown, MessageCircle, User, Settings, LogOut, LogIn, Bell, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImprovedTokenBalance } from '@/components/payment/ImprovedTokenBalance';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { fetchTokenBalance } from '@/services/tokenService';

interface TopNavigationProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  withSidebar?: boolean;
}

export default function TopNavigation({ searchQuery = '', onSearchChange, withSidebar = true }: TopNavigationProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { 
    navigateToHome, 
    navigateToPayment, 
    navigateToLogin, 
    navigateToPath,
    getTopNavItems,
    isCollapsed 
  } = useNavigation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const topNavItems = getTopNavItems();

  const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
    queryKey: ['tokenBalance'],
    queryFn: fetchTokenBalance,
    refetchInterval: isAuthenticated ? 30000 : false,
    enabled: isAuthenticated && !!localStorage.getItem('auth_token'),
    staleTime: 0,
    retry: 1,
  });

  // Refetch when authentication status changes
  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('auth_token')) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`bg-gray-800 border-b border-gray-700 w-full sticky top-0 z-30 ${
      withSidebar ? (isCollapsed ? 'sm:pl-16' : 'sm:pl-64') : ''
    }`}>
      <div className="flex items-center justify-between px-2 sm:px-4 py-3">
        {/* Left side */}
        <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
          <button 
            onClick={navigateToHome}
            className="flex items-center space-x-2 group transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-50 rounded-lg p-1 hover:bg-gray-700/50"
            title="Go to Home"
            aria-label="Navigate to home page - ProductInsightAI"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToHome();
              }
            }}
          >
            <div className="w-8 h-8 bg-gradient-brand rounded-lg shadow-surface border border-surface-border flex items-center justify-center group-hover:scale-105 transition-transform">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-brand-primary hidden sm:block group-hover:text-slate-100 transition-colors tracking-wide">
              ProductInsightAI
            </span>
            <span className="text-xs text-brand-secondary font-medium ml-2 uppercase tracking-wider hidden sm:inline">
              Premium
            </span>
            <span className="text-lg font-bold text-brand-primary sm:hidden group-hover:text-slate-100 transition-colors">
              AI
            </span>
          </button>
          
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md mx-2 sm:mx-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchCharacters')}
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          {/* Token Balance - only show for authenticated users */}
          {isAuthenticated && (
            <ImprovedTokenBalance compact={true} showTitle={false} showStats={false} showActions={true} />
          )}
          
          {/* Notification Bell - only show for authenticated users */}
          {isAuthenticated && (
            <NotificationBell className="mx-1" />
          )}
          
          <button 
            onClick={navigateToPayment}
            className="bg-gradient-premium text-zinc-900 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold tracking-wide shadow-premium hover:shadow-glow transition-all duration-200"
          >
            <span className="hidden sm:inline">💎 {t('upgradePlan')}</span>
            <span className="sm:hidden">💎</span>
          </button>
          
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-sm">{language === 'en' ? 'English' : '中文'}</span>
            <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          
          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            {isAuthenticated ? (
              <>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 bg-gray-100/5 rounded-xl px-3 py-2.5 hover:bg-gray-100/10 transition-all duration-200 group"
                >
                  <div className="w-7 h-7 bg-gray-600/80 rounded-full flex items-center justify-center group-hover:bg-gray-500/80 transition-colors">
                    <span className="text-xs font-medium text-white">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                  </div>
                  <span className="text-sm font-normal text-gray-200">{t('freePlan')}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-200 transition-colors" />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-3 w-52 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-700/50 py-2 z-50">
                    {topNavItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigateToPath(item.path);
                          setShowUserMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-100/5 text-sm flex items-center space-x-3 text-gray-300 hover:text-gray-100 transition-all duration-150 group"
                      >
                        <item.icon className="w-4 h-4 text-gray-400 group-hover:text-gray-200 transition-colors" />
                        <span className="font-normal">{t(item.label)}</span>
                      </button>
                    ))}
                    <div className="h-px bg-gray-700/50 my-2 mx-2"></div>
                    <button 
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-red-500/10 text-sm flex items-center space-x-3 text-red-400 hover:text-red-300 transition-all duration-150 group"
                    >
                      <LogOut className="w-4 h-4 group-hover:text-red-300 transition-colors" />
                      <span className="font-normal">{t('logout')}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <button 
                  onClick={navigateToLogin}
                  className="flex items-center space-x-2 bg-brand-accent hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('login')}</span>
                </button>
                <div className="flex items-center space-x-3 bg-gray-100/5 rounded-xl px-3 py-2.5">
                  <div className="w-7 h-7 bg-gray-600/60 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-300" />
                  </div>
                  <span className="text-sm font-normal text-gray-300">{t('guest')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}