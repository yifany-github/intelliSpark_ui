import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Coins, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useLocation } from 'wouter';
import { useLanguage } from '@/context/LanguageContext';
import { fetchTokenBalance, type TokenBalance } from '@/services/tokenService';

interface TokenBalanceProps {
  showTitle?: boolean;
  compact?: boolean;
}

export const TokenBalance: React.FC<TokenBalanceProps> = ({ 
  showTitle = true, 
  compact = false 
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
  });

  const handleBuyTokens = () => {
    setLocation('/payment');
  };

  if (isLoading) {
    return (
      <Card className={compact ? "p-2" : ""}>
        {showTitle && !compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('tokenBalance')}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "p-2" : "pt-2"}>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? "p-2" : ""}>
        {showTitle && !compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('tokenBalance')}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "p-2" : "pt-2"}>
          <div className="text-sm text-red-500">{t('failedToLoadBalance')}</div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => refetch()}
            className="mt-2"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const balance = tokenBalance?.balance ?? 0;
  const isLowBalance = balance <= 5;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Coins className="h-4 w-4 text-yellow-600" />
          <span className={`font-medium ${isLowBalance ? 'text-red-500' : 'text-gray-900'}`}>
            {balance}
          </span>
        </div>
        {isLowBalance && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleBuyTokens}
            className="h-6 text-xs px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('buy')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-600" />
            Token Balance
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${isLowBalance ? 'text-red-500' : 'text-gray-900'}`}>
              {balance}
            </span>
            <span className="text-sm text-gray-500">{t('tokens')}</span>
            {isLowBalance && (
              <Badge variant="destructive" className="text-xs">
                {t('low')}
              </Badge>
            )}
          </div>
          <Button 
            size="sm" 
            onClick={handleBuyTokens}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            {t('buyTokens')}
          </Button>
        </div>
        
        {isLowBalance && (
          <div className="mt-2 p-2 bg-red-50 rounded-md">
            <p className="text-xs text-red-600">
              {t('runningLowTokens')}
            </p>
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-500">
          {t('lastUpdated')}: {new Date(tokenBalance?.updated_at || '').toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenBalance;