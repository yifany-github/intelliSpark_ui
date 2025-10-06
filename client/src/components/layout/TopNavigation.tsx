import { Search, ChevronDown, User, LogOut, LogIn, Menu, Shield, ShieldOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useRolePlay } from '@/contexts/RolePlayContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImprovedTokenBalance } from '@/components/payment/ImprovedTokenBalance';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { fetchTokenBalance } from '@/services/tokenService';
import { fetchTrendingSearches, extractTrendingNames } from '@/services/searchService';
import LogoImage from '@/assets/logo.png';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const SEARCH_HISTORY_KEY = 'character_search_history_v2';
const MAX_HISTORY_ITEMS = 10;
const PLACEHOLDER_ROTATION_INTERVAL = 4000;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const resolveAvatarUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

const HOT_SEARCH_TERMS: Record<'en' | 'zh', string[]> = {
  en: [
    'Cyberpunk detective',
    'Royal sorceress academy',
    'Space exploration crew',
    'AI companion teacher',
    'Supernatural investigation team',
    'Ancient empire strategist',
    'Time-traveling historian',
    'Virtual idol mentor',
    'Mythical beast guardian',
    'Steampunk inventor duo',
  ],
  zh: [
    '赛博朋克侦探',
    '皇家魔导师学院',
    '深空探索小队',
    'AI 陪伴教师',
    '超自然调查组',
    '古朝谋略师',
    '时空旅行历史学家',
    '虚拟偶像经纪人',
    '神兽守护者',
    '蒸汽朋克发明 duo',
  ],
};

interface TopNavigationProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  withSidebar?: boolean;
  hideSearch?: boolean;
}

export default function TopNavigation({
  searchQuery = '',
  onSearchChange,
  withSidebar = true,
  hideSearch = false,
}: TopNavigationProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { nsfwEnabled, setNsfwEnabled } = useRolePlay();
  const {
    navigateToHome,
    navigateToPayment,
    navigateToLogin,
    navigateToPath,
    getTopNavItems,
    isCollapsed,
    toggleCollapsed,
  } = useNavigation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isNSFWConfirmOpen, setIsNSFWConfirmOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const topNavItems = getTopNavItems();
  const fallbackUserName = language === 'zh' ? '用户' : 'User';

  // Fetch real trending searches from backend
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['trendingSearches'],
    queryFn: () => fetchTrendingSearches(10),
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
    retry: 1,
  });

  // Use real trending data if available, otherwise fallback to hard-coded terms
  const hotSearches = useMemo(() => {
    if (trendingData && trendingData.length > 0) {
      return extractTrendingNames(trendingData);
    }
    return HOT_SEARCH_TERMS[language] ?? HOT_SEARCH_TERMS.en;
  }, [trendingData, language]);

  const currentPlaceholder = hotSearches[placeholderIndex % hotSearches.length];

  const { data: tokenBalance, isLoading: tokenLoading, error: tokenError, refetch } = useQuery({
    queryKey: ['tokenBalance'],
    queryFn: fetchTokenBalance,
    refetchInterval: isAuthenticated ? 30000 : false,
    enabled: isAuthenticated && !!localStorage.getItem('auth_token'),
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('auth_token')) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % hotSearches.length);
    }, PLACEHOLDER_ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [hotSearches.length]);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.slice(0, MAX_HISTORY_ITEMS)));
  }, [searchHistory]);

  const addToSearchHistory = (term: string) => {
    const value = term.trim();
    if (!value) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== value.toLowerCase());
      return [value, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const handleSearchSubmit = (term?: string) => {
    const value = (term ?? searchQuery ?? '').trim();
    const finalValue = value || currentPlaceholder;
    if (!finalValue) {
      return;
    }
    onSearchChange?.(finalValue);
    addToSearchHistory(finalValue);
    setIsSearchPanelOpen(false);
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(event.target.value);
  };

  const handleSearchFocus = () => {
    if (!hideSearch) {
      setIsSearchPanelOpen(true);
    }
  };

  const hotSearchColumns = useMemo(() => {
    const firstColumn = hotSearches.slice(0, 5);
    const secondColumn = hotSearches.slice(5, 10);
    return [firstColumn, secondColumn];
  }, [hotSearches]);

  const subscriptionLabel = useMemo(() => {
    const rawTier = (user as any)?.subscriptionTier ?? (user as any)?.subscription_tier ?? (user as any)?.plan;
    if (!rawTier) return t('freePlan');
    const normalized = String(rawTier).toLowerCase();
    if (normalized.includes('starter')) return t('starterPlan');
    if (normalized.includes('standard')) return t('standardPlan');
    if (normalized.includes('premium')) return t('premiumPlan');
    if (normalized.includes('free')) return t('freePlan');
    return rawTier;
  }, [t, user]);

  const showChineseName = language === 'zh';
  const appNameText = showChineseName ? (t('appNameChinese') || '歪歪') : (t('appNameEnglish') || 'YY Chat');

  return (
    <>
      <Dialog open={isNSFWConfirmOpen} onOpenChange={setIsNSFWConfirmOpen}>
        <DialogContent className="w-[calc(100vw-3rem)] max-w-[calc(100vw-3rem)] sm:max-w-md bg-slate-950 text-slate-100 border-slate-800">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base sm:text-lg leading-tight pr-8">{t('confirmEnableNSFW') || '确认开启成人内容'}</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              {t('nsfwDisclaimer') || '成人内容仅面向年满18周岁的用户。开启NSFW模式即表示您确认已年满法定年龄，并对浏览成人向内容负有法律责任。'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-xs leading-relaxed text-red-200">
            {t('nsfwLegalNotice') || '继续操作即表示您知悉当地法律，并同意平台关于成人内容的条款。'}
          </div>
          <DialogFooter className="mt-3 flex w-full justify-end gap-2 flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNSFWConfirmOpen(false)}
              className="text-slate-300 w-full sm:w-auto"
            >
              {t('cancel') || '取消'}
            </Button>
            <Button
              type="button"
              className="bg-red-500 text-white hover:bg-red-500/90 w-full sm:w-auto"
              onClick={() => {
                setNsfwEnabled(true);
                setIsNSFWConfirmOpen(false);
              }}
            >
              {t('confirm') || '确认开启'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="sticky top-0 z-40 w-full px-2 sm:px-4 pt-2 sm:pt-3 pb-2">
        <div className="mx-auto flex w-full max-w-[110rem] min-h-[56px] sm:h-14 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 lg:px-8 liquid-glass-topnav rounded-2xl">
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {withSidebar ? (
              <button
                onClick={toggleCollapsed}
                className="hidden xl:inline-flex items-center justify-center p-2 text-slate-300 transition hover:text-pink-400 focus:outline-none"
                title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <span className="hidden h-10 w-10 items-center justify-center xl:inline-flex" aria-hidden />
            )}
            <button
              onClick={navigateToHome}
              className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-1.5 transition group"
              aria-label={appNameText}
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center overflow-hidden shrink-0">
                <img src={LogoImage} alt={appNameText} className="h-full w-full object-contain transition-transform group-hover:scale-110" />
              </div>
              <div className="hidden sm:flex xl:flex flex-col leading-tight">
                <span className="text-sm font-semibold text-slate-100 tracking-wide transition-colors group-hover:text-pink-400">
                  {appNameText}
                </span>
              </div>
            </button>
          </div>

          {!hideSearch && (
            <div className="flex flex-1 justify-center mx-2 sm:mx-0" ref={searchContainerRef}>
            <div className="relative w-full max-w-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={handleSearchFocus}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                placeholder={currentPlaceholder}
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/80 py-2 sm:py-2.5 pl-4 sm:pl-5 pr-12 sm:pr-16 text-sm text-slate-100 shadow-inner shadow-slate-950/40 placeholder-slate-500 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/60 touch-manipulation"
              />
              <button
                onClick={() => handleSearchSubmit()}
                className="absolute right-1.5 sm:right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 sm:gap-2 rounded-xl bg-brand-secondary px-2 sm:px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-brand-secondary/80 touch-manipulation"
                aria-label={t('search')}
              >
                <span className="hidden sm:inline">{t('search')}</span>
                <Search className="h-4 w-4" />
              </button>

              {isSearchPanelOpen && (
                <div className="absolute left-0 right-0 sm:left-1/2 sm:right-auto z-[100] mt-2 sm:mt-4 w-full sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-4 sm:p-5 shadow-2xl shadow-black/40 backdrop-blur-xl max-h-[calc(100vh-200px)] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200 tracking-wide">{t('searchHistory')}</h3>
                      {searchHistory.length > 0 && (
                        <button
                          onClick={clearSearchHistory}
                          className="text-xs font-medium text-slate-400 transition hover:text-brand-secondary"
                        >
                          {t('clearHistory')}
                        </button>
                      )}
                    </div>
                    {searchHistory.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {searchHistory.slice(0, MAX_HISTORY_ITEMS).map((item) => (
                          <button
                            key={item}
                            onClick={() => handleSearchSubmit(item)}
                            className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:border-brand-secondary hover:text-brand-secondary"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{t('noSearchHistory')}</p>
                    )}

                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-slate-200 tracking-wide">{t('popularSearches')}</h3>
                      <div className="mt-3 space-y-2 sm:hidden">
                        {hotSearches.slice(0, 5).map((term, index) => (
                          <button
                            key={term}
                            onClick={() => handleSearchSubmit(term)}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-brand-secondary hover:text-brand-secondary touch-manipulation"
                          >
                            <span className="text-xs font-semibold text-slate-500 shrink-0">{index + 1}.</span>
                            <span className="truncate">{term}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 hidden sm:grid grid-cols-2 gap-3">
                        {hotSearchColumns.map((column, columnIndex) => (
                          <div key={columnIndex} className="space-y-2">
                            {column.map((term, index) => (
                              <button
                                key={term}
                                onClick={() => handleSearchSubmit(term)}
                                className="flex w-full items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-brand-secondary hover:text-brand-secondary"
                              >
                                <span className="text-xs font-semibold text-slate-500">{index + 1 + columnIndex * 5}.</span>
                                <span className="truncate">{term}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            {isAuthenticated && (
              <div className="hidden md:block">
                <ImprovedTokenBalance compact showTitle={false} showStats={false} showActions />
              </div>
            )}

            <div
              className="relative hidden md:block"
              onMouseEnter={() => setShowUpgradeDetails(true)}
              onMouseLeave={() => setShowUpgradeDetails(false)}
            >
              <button
                onClick={navigateToPayment}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-900 shadow-lg transition hover:shadow-amber-400/40 touch-manipulation whitespace-nowrap"
                aria-label={t('upgradePlan')}
              >
                💎 <span className="hidden lg:inline">{t('upgradePlan')}</span>
              </button>
              {showUpgradeDetails && (
                <div className="absolute right-0 z-[100] mt-3 w-72 rounded-2xl border border-amber-400/40 bg-slate-950/95 p-4 text-left shadow-2xl shadow-black/50 backdrop-blur-xl">
                  <div className="text-sm font-semibold text-amber-300">
                    {t('nextTierPreview')}
                  </div>
                  <div className="mt-2 text-xs text-slate-300 leading-relaxed space-y-2">
                    <div className="flex items-center justify-between">
                      <span>{t('starterPlan')}</span>
                      <span className="font-semibold text-amber-200">¥58 / {t('perMonth')}</span>
                    </div>
                    <ul className="space-y-1 text-slate-400">
                      <li>• {t('monthlyTokens')}</li>
                      <li>• {t('prioritySupport')}</li>
                      <li>• {t('exclusiveStories')}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!nsfwEnabled) {
                  setIsNSFWConfirmOpen(true);
                  return;
                }
                setNsfwEnabled(false);
              }}
              title={nsfwEnabled ? (t('nsfwEnabledLabel') || 'NSFW模式已开启') : (t('nsfwDisabledLabel') || '安全模式')}
              className={`flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition-all touch-manipulation ${
                nsfwEnabled
                  ? 'border-red-400/60 bg-red-500/15 text-red-200 hover:border-red-300 hover:bg-red-500/20'
                  : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/20'
              }`}
              aria-label={nsfwEnabled ? (t('nsfwEnabledLabel') || 'NSFW') : (t('nsfwDisabledLabel') || '安全模式')}
            >
              {nsfwEnabled ? <ShieldOff className="h-4 w-4 sm:h-4 sm:w-4" /> : <Shield className="h-4 w-4 sm:h-4 sm:w-4" />}
              <span className="hidden lg:inline lg:ml-1.5">{nsfwEnabled ? (t('nsfwEnabledLabel') || 'NSFW') : (t('nsfwDisabledLabel') || '安全模式')}</span>
            </button>

            {isAuthenticated && <NotificationBell className="mx-1 hidden xl:block" />}

            <div className="relative" ref={userMenuRef}>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full overflow-hidden bg-slate-700/80 text-sm font-semibold text-slate-100 border-2 border-transparent transition hover:border-brand-secondary hover:bg-slate-700 touch-manipulation"
                    title={user?.username || user?.email || fallbackUserName}
                    aria-label={user?.username || user?.email || fallbackUserName}
                  >
                    {(user as any)?.avatar_url ? (
                      <img
                        src={resolveAvatarUrl((user as any).avatar_url)}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 z-[100] mt-2 sm:mt-3 w-56 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
                      <div className="px-3 py-2 text-xs text-slate-400">
                        {t('tokenBalance')}: {tokenLoading ? '…' : tokenError ? '—' : tokenBalance?.balance ?? 0}
                      </div>
                      {topNavItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigateToPath(item.path);
                            setShowUserMenu(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900/80 hover:text-slate-100"
                        >
                          <item.icon className="h-4 w-4 text-slate-500" />
                          <span>{t(item.label)}</span>
                        </button>
                      ))}
                      <div className="my-2 h-px bg-slate-800/70" />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t('logout')}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={navigateToLogin}
                    className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-accent px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-500 touch-manipulation whitespace-nowrap"
                    aria-label={t('login')}
                  >
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('login')}</span>
                  </button>
                  <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/70 text-sm text-slate-300">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-slate-300">{t('guest')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
