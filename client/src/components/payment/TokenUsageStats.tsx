import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  Calendar,
  Clock,
  Activity,
  RefreshCw,
  Target,
  Zap,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';

interface TokenUsageStats {
  total_purchased: number;
  total_used: number;
  current_balance: number;
  daily_average: number;
  weekly_usage: number;
  monthly_usage: number;
  favorite_characters: Array<{
    character_name: string;
    usage_count: number;
  }>;
  usage_by_day: Array<{
    date: string;
    usage: number;
  }>;
  efficiency_score: number;
  streak_days: number;
}

const fetchTokenUsageStats = async (): Promise<TokenUsageStats> => {
  const response = await apiRequest('GET', '/api/payment/user/stats');
  return response.json();
};

interface TokenUsageStatsProps {
  className?: string;
  showTitle?: boolean;
  compact?: boolean;
}

export const TokenUsageStats: React.FC<TokenUsageStatsProps> = ({
  className,
  showTitle = true,
  compact = false
}) => {
  const { t } = useLanguage();
  const { 
    data: stats, 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['tokenUsageStats'],
    queryFn: fetchTokenUsageStats,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'text-brand-secondary';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getUsageInsight = () => {
    if (!stats) return null;

    const usageRatio = stats.total_used / stats.total_purchased;
    
    if (usageRatio > 0.8) {
      return {
        message: t('youMakingGreatUse'),
        color: "text-brand-secondary",
        icon: <TrendingUp className="h-4 w-4" />
      };
    } else if (usageRatio > 0.5) {
      return {
        message: t('goodTokenUtilization'),
        color: "text-brand-accent",
        icon: <Target className="h-4 w-4" />
      };
    } else {
      return {
        message: t('plentyTokensAvailable'),
        color: "text-gray-400",
        icon: <Zap className="h-4 w-4" />
      };
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-accent" />
{t('usageStatistics')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20 bg-gray-700" />
                <Skeleton className="h-8 w-16 bg-gray-700" />
              </div>
            ))}
          </div>
          <Skeleton className="h-24 w-full bg-gray-700" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-accent" />
{t('usageStatistics')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">{t('failedToLoad')} {t('usageStatistics').toLowerCase()}</div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => refetch()}
              className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('tryAgain')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const insight = getUsageInsight();

  return (
    <Card className={cn("bg-gray-800 border-gray-700", className)}>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-accent" />
{t('usageStatistics')}
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => refetch()}
              className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="space-y-6">
        {/* Key Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-white">{stats.total_purchased}</div>
            <div className="text-sm text-gray-400">{t('totalPurchased')}</div>
          </div>
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-brand-accent">{stats.total_used}</div>
            <div className="text-sm text-gray-400">{t('totalUsed')}</div>
          </div>
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-brand-secondary">{stats.current_balance}</div>
            <div className="text-sm text-gray-400">{t('currentBalance')}</div>
          </div>
          <div className="text-center p-3 bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{stats.daily_average.toFixed(1)}</div>
            <div className="text-sm text-gray-400">{t('dailyAverage')}</div>
          </div>
        </div>

        {/* Usage Period Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            <Calendar className="h-5 w-5 text-brand-accent" />
            <div>
              <div className="font-semibold text-white">{stats.weekly_usage}</div>
              <div className="text-sm text-gray-400">{t('thisWeek')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            <Clock className="h-5 w-5 text-brand-secondary" />
            <div>
              <div className="font-semibold text-white">{stats.monthly_usage}</div>
              <div className="text-sm text-gray-400">{t('thisMonth')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
            <Activity className="h-5 w-5 text-brand-accent" />
            <div>
              <div className="font-semibold text-white">{stats.streak_days}</div>
              <div className="text-sm text-gray-400">{t('dayStreak')}</div>
            </div>
          </div>
        </div>

        {/* Efficiency Score */}
        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-orange-400" />
            <div>
              <div className="font-semibold text-white">{t('efficiencyScore')}</div>
              <div className="text-sm text-gray-400">{t('howWellYouUse')}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-2xl font-bold", getEfficiencyColor(stats.efficiency_score))}>
              {stats.efficiency_score}%
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "mt-1",
                stats.efficiency_score >= 80 ? "border-brand-secondary text-brand-secondary" :
                stats.efficiency_score >= 60 ? "border-yellow-400 text-yellow-400" :
                "border-red-400 text-red-400"
              )}
            >
              {stats.efficiency_score >= 80 ? t('excellent') :
               stats.efficiency_score >= 60 ? t('good') : t('needsImprovement')}
            </Badge>
          </div>
        </div>

        {/* Favorite Characters */}
        {stats.favorite_characters.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              {t('mostChattedCharacters')}
            </h4>
            <div className="space-y-2">
              {stats.favorite_characters.slice(0, compact ? 3 : 5).map((char, index) => (
                <div key={char.character_name} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
                    <span className="text-sm text-white">{char.character_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-brand-accent">{char.usage_count}</span>
                    <MessageSquare className="h-3 w-3 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Insight */}
        {insight && (
          <div className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg">
            <span className={insight.color}>
              {insight.icon}
            </span>
            <span className={cn("text-sm", insight.color)}>
              {insight.message}
            </span>
          </div>
        )}

        {/* Simple Usage Chart */}
        {!compact && stats.usage_by_day.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-accent" />
              {t('dailyUsage')} ({t('lastSevenDays')})
            </h4>
            <div className="grid grid-cols-7 gap-1">
              {stats.usage_by_day.slice(-7).map((day, index) => {
                const maxUsage = Math.max(...stats.usage_by_day.map(d => d.usage));
                const height = maxUsage > 0 ? (day.usage / maxUsage) * 100 : 0;
                
                return (
                  <div key={index} className="text-center">
                    <div className="h-16 flex items-end justify-center">
                      <div 
                        className="w-4 bg-brand-accent rounded-t"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${day.usage} ${t('tokensUsed')}`}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(day.date).toLocaleDateString(t('language') === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenUsageStats;
