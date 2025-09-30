import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Coins, 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw, 
  Zap,
  Clock,
  Gift
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchTokenBalance, type TokenBalance } from '@/services/tokenService';

interface ImprovedTokenBalanceProps {
  showTitle?: boolean;
  compact?: boolean;
  showStats?: boolean;
  showActions?: boolean;
  className?: string;
  onPurchaseClick?: () => void;
  onHistoryClick?: () => void;
}

export const ImprovedTokenBalance: React.FC<ImprovedTokenBalanceProps> = ({ 
  showTitle = true, 
  compact = false,
  showStats = true,
  showActions = true,
  className,
  onPurchaseClick,
  onHistoryClick
}) => {
  const { navigateToPath } = useNavigation();
  const { t } = useLanguage();
  
  const { 
    data: tokenBalance, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['tokenBalance'],
    queryFn: fetchTokenBalance,
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!localStorage.getItem('auth_token'), // Only fetch when authenticated
  });

  const handleBuyTokens = () => {
    if (onPurchaseClick) {
      onPurchaseClick();
    } else {
      navigateToPath('/payment');
    }
  };

  const balance = tokenBalance?.balance ?? 0;
  const isLowBalance = balance <= 5;
  const isCriticalBalance = balance <= 2;
  const isGoodBalance = balance >= 50;

  // Get balance status info
  const getBalanceStatus = () => {
    if (isCriticalBalance) return { 
      color: 'text-red-600', 
      bgColor: 'bg-red-50 border-red-200', 
      icon: AlertTriangle, 
      label: t('critical'),
      description: t('purchaseTokensImmediately')
    };
    if (isLowBalance) return { 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 border-orange-200', 
      icon: Clock, 
      label: t('lowBalance'),
      description: t('considerPurchasingMore')
    };
    if (isGoodBalance) return { 
      color: 'text-brand-secondary', 
      bgColor: 'bg-brand-secondary/10 border-brand-secondary/30', 
      icon: TrendingUp, 
      label: t('good'),
      description: t('plentyTokensForChatting')
    };
    return { 
      color: 'text-brand-accent', 
      bgColor: 'bg-brand-accent/10 border-brand-accent/30', 
      icon: Zap, 
      label: t('active'),
      description: t('readyForAIConversations')
    };
  };

  const balanceStatus = getBalanceStatus();

  if (isLoading) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", compact && "p-2", className)}>
        {showTitle && !compact && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-400" />
{t('tokenBalance')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn("pt-2", compact && "p-2")}>
          <div className="space-y-2">
            <Skeleton className="h-8 w-24 bg-gray-700" />
            <Skeleton className="h-4 w-32 bg-gray-700" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", compact && "p-2", className)}>
        {showTitle && !compact && (
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-400" />
{t('tokenBalance')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn("pt-2", compact && "p-2")}>
          <div className="text-center space-y-2">
            <div className="text-sm text-red-400">{t('failedToLoadBalance')}</div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => refetch()}
              className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1">
          <Coins className="h-4 w-4 text-yellow-400" />
          <span className={cn("font-medium", 
            isCriticalBalance ? 'text-red-400' : 
            isLowBalance ? 'text-orange-400' : 
            'text-brand-secondary'
          )}>
            {balance}
          </span>
        </div>
        {(isLowBalance || isCriticalBalance) && showActions && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBuyTokens}
            className="h-6 text-xs px-2 bg-brand-secondary hover:bg-amber-600 border-brand-secondary text-white rounded-full"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('buy')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("bg-gray-800 border-gray-700", className)}>
      {showTitle && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            {t('tokenBalance')}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="pt-2 space-y-4">
        {/* Main Balance Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={cn("text-3xl font-bold", balanceStatus.color)}>
                {balance}
              </span>
              <span className="text-sm text-gray-400">{t('tokens')}</span>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs border", 
                balanceStatus.color,
                balanceStatus.bgColor
              )}
            >
              <balanceStatus.icon className="h-3 w-3 mr-1" />
              {balanceStatus.label}
            </Badge>
          </div>
          {showActions && (
            <Button
              size="sm"
              onClick={handleBuyTokens}
              className="flex items-center gap-1 bg-brand-secondary hover:bg-amber-600 rounded-2xl"
            >
              <Plus className="h-4 w-4" />
              {t('buyMoreTokens')}
            </Button>
          )}
        </div>

        {/* Status Message */}
        <div className={cn("p-3 rounded-lg border", balanceStatus.bgColor)}>
          <p className={cn("text-sm", balanceStatus.color)}>
            {balanceStatus.description}
          </p>
        </div>

        {/* Statistics */}
        {showStats && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
            <div className="text-center">
              <div className="text-sm text-gray-400">{t('messagesAvailable')}</div>
              <div className="text-lg font-semibold text-white">{balance}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">{t('costPerMessage')}</div>
              <div className="text-lg font-semibold text-white">{t('oneToken')}</div>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('lastUpdated')}: {new Date(tokenBalance?.updated_at || '').toLocaleString()}
        </div>

        {/* Quick Actions */}
        {showActions && (isLowBalance || isCriticalBalance) && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBuyTokens}
              className="flex-1 bg-brand-secondary hover:bg-amber-600 border-brand-secondary text-white rounded-2xl"
            >
              <Gift className="h-4 w-4 mr-2" />
              {t('quickBuy')}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onHistoryClick ? onHistoryClick : () => navigateToPath('/payment')}
              className="flex-1 bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
            >
              {onHistoryClick ? t('viewHistory') : t('viewPlans')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImprovedTokenBalance;