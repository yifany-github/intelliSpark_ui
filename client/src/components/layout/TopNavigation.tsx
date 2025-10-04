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

      <div className="sticky top-0 z-40 w-full px-4 pt-3 pb-2">
        <div className="mx-auto flex w-full max-w-[110rem] h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 liquid-glass-topnav rounded-2xl">
          <div className="flex flex-1 items-center gap-2 min-w-0">
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
              className="flex items-center gap-2 px-2 py-1.5 transition group"
            >
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden">
                <img src={LogoImage} alt={appNameText} className="h-9 w-9 object-contain transition-transform group-hover:scale-110" />
              </div>
              <div className="hidden xl:flex flex-col leading-tight">
                <span className="text-sm font-semibold text-slate-100 tracking-wide transition-colors group-hover:text-pink-400">
                  {appNameText}
                </span>
              </div>
            </button>
          </div>

          {!hideSearch && (
            <div className="flex flex-1 justify-center" ref={searchContainerRef}>
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
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/80 py-2.5 pl-5 pr-16 text-sm text-slate-100 shadow-inner shadow-slate-950/40 placeholder-slate-500 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/60"
              />
              <button
                onClick={() => handleSearchSubmit()}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-xl bg-brand-secondary px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-brand-secondary/80"
              >
                <span className="hidden sm:inline">{t('search')}</span>
                <Search className="h-4 w-4" />
              </button>

              {isSearchPanelOpen && (
                <div className="absolute left-1/2 z-[100] mt-4 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
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
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            {isAuthenticated && (
              <ImprovedTokenBalance compact showTitle={false} showStats={false} showActions />
            )}

            <div
              className="relative hidden sm:block"
              onMouseEnter={() => setShowUpgradeDetails(true)}
              onMouseLeave={() => setShowUpgradeDetails(false)}
            >
              <button
                onClick={navigateToPayment}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 shadow-lg transition hover:shadow-amber-400/40"
              >
                💎 {t('upgradePlan')}
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
              className={`flex items-center rounded-lg border px-1.5 sm:px-3 py-1 sm:py-2 text-xs font-semibold transition-all ${
                nsfwEnabled
                  ? 'border-red-400/60 bg-red-500/15 text-red-200 hover:border-red-300 hover:bg-red-500/20'
                  : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              {nsfwEnabled ? <ShieldOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              <span className="hidden lg:inline lg:ml-1.5">{nsfwEnabled ? (t('nsfwEnabledLabel') || 'NSFW') : (t('nsfwDisabledLabel') || '安全模式')}</span>
            </button>

            {isAuthenticated && <NotificationBell className="mx-1 hidden xl:block" />}

            <div className="relative" ref={userMenuRef}>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/80 text-sm font-semibold text-slate-100 border-2 border-transparent transition hover:border-brand-secondary hover:bg-slate-700"
                    title={user?.email || fallbackUserName}
                  >
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-1/2 translate-x-1/2 z-[100] mt-3 w-56 rounded-2xl border border-slate-800/80 bg-slate-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={navigateToLogin}
                    className="flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-500"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{t('login')}</span>
                  </button>
                  <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
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
