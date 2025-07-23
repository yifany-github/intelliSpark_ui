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
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface TokenBalance {
  user_id: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

const fetchTokenBalance = async (): Promise<TokenBalance> => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch('http://localhost:8000/api/payment/user/tokens', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch token balance');
  }

  return response.json();
};

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
  const [, setLocation] = useLocation();
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
      setLocation('/payment');
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
      label: 'Critical',
      description: t('purchaseTokensImmediately')
    };
    if (isLowBalance) return { 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 border-orange-200', 
      icon: Clock, 
      label: 'Low',
      description: t('considerPurchasingMore')
    };
    if (isGoodBalance) return { 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 border-green-200', 
      icon: TrendingUp, 
      label: 'Good',
      description: t('plentyTokensForChatting')
    };
    return { 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50 border-blue-200', 
      icon: Zap, 
      label: 'Active',
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
            <div className="text-sm text-red-400">Failed to load balance</div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => refetch()}
              className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
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
            'text-green-400'
          )}>
            {balance}
          </span>
        </div>
        {(isLowBalance || isCriticalBalance) && showActions && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleBuyTokens}
            className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700 border-blue-600 text-white rounded-full"
          >
            <Plus className="h-3 w-3 mr-1" />
            Buy
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
            Token Balance
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
              <span className="text-sm text-gray-400">tokens</span>
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
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 rounded-2xl"
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 border-blue-600 text-white rounded-2xl"
            >
              <Gift className="h-4 w-4 mr-2" />
              Quick Buy
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onHistoryClick ? onHistoryClick : () => setLocation('/payment')}
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