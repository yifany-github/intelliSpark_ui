import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  History, 
  Plus, 
  Minus, 
  Calendar, 
  Filter,
  Download,
  CreditCard,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface TokenTransaction {
  id: number;
  user_id: number;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  metadata?: {
    stripe_payment_id?: string;
    chat_id?: number;
    character_name?: string;
  };
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

const fetchTokenTransactions = async (
  page: number = 1, 
  limit: number = 20, 
  type?: string
): Promise<{ transactions: TokenTransaction[]; total: number; pages: number }> => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(type && type !== 'all' && { type })
  });

  const response = await fetch(`http://localhost:8000/api/payment/user/transactions?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch transaction history');
  }

  return response.json();
};

interface TokenTransactionHistoryProps {
  className?: string;
  showTitle?: boolean;
  compact?: boolean;
  maxItems?: number;
}

export const TokenTransactionHistory: React.FC<TokenTransactionHistoryProps> = ({
  className,
  showTitle = true,
  compact = false,
  maxItems = 20
}) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { 
    data: transactionData, 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['tokenTransactions', currentPage, filterType],
    queryFn: () => fetchTokenTransactions(currentPage, maxItems, filterType),
    refetchInterval: 60000, // Refetch every minute
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <CreditCard className="h-4 w-4 text-brand-secondary" />;
      case 'usage':
        return <MessageSquare className="h-4 w-4 text-brand-accent" />;
      case 'refund':
        return <TrendingUp className="h-4 w-4 text-orange-400" />;
      case 'bonus':
        return <Plus className="h-4 w-4 text-brand-accent" />;
      default:
        return <History className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-brand-secondary/20 text-brand-secondary border-brand-secondary/40">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('completed')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-900 text-yellow-400 border-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            {t('pending')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-900 text-red-400 border-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            {t('failed')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getAmountDisplay = (transaction: TokenTransaction) => {
    const isPositive = transaction.type === 'purchase' || transaction.type === 'refund' || transaction.type === 'bonus';
    const amountClass = isPositive ? 'text-brand-secondary' : 'text-red-400';
    const sign = isPositive ? '+' : '-';
    
    return (
      <span className={cn('font-semibold', amountClass)}>
        {sign}{Math.abs(transaction.amount)}
      </span>
    );
  };

  const filteredTransactions = transactionData?.transactions?.filter(transaction =>
    transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <History className="h-4 w-4 text-brand-accent" />
{t('transactionHistory')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 bg-gray-600" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 bg-gray-600" />
                  <Skeleton className="h-3 w-24 bg-gray-600" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 bg-gray-600 mb-1" />
                <Skeleton className="h-3 w-12 bg-gray-600" />
              </div>
            </div>
          ))}
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
              <History className="h-4 w-4 text-brand-accent" />
{t('transactionHistory')}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">{t('failedToLoad')} {t('transactionHistory').toLowerCase()}</div>
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

  return (
    <Card className={cn("bg-gray-800 border-gray-700", className)}>
      {showTitle && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <History className="h-4 w-4 text-brand-accent" />
{t('transactionHistory')}
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
      
      <CardContent className="space-y-4">
        {!compact && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                placeholder={t('searchTransactions')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40 bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder={t('filterByType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                <SelectItem value="purchase">{t('purchases')}</SelectItem>
                <SelectItem value="usage">{t('usage')}</SelectItem>
                <SelectItem value="refund">{t('refunds')}</SelectItem>
                <SelectItem value="bonus">{t('bonuses')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <History className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <p>{t('noTransactionsFound')}</p>
            <p className="text-sm mt-1">
              {searchTerm ? t('tryAdjustingSearch') : t('transactionHistoryWillAppear')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(transaction.type)}
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">
                      {transaction.description}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(transaction.created_at).toLocaleString()}
                      {transaction.metadata?.character_name && (
                        <span className="text-brand-accent">
                          • {transaction.metadata.character_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    {getAmountDisplay(transaction)}
                    <span className="text-gray-400 text-sm">{t('tokens')}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {t('balance')}: {transaction.balance_after}
                    </span>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!compact && transactionData && transactionData.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              {t('page')} {currentPage} {t('of')} {transactionData.pages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
              >
                {t('previous')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(transactionData.pages, prev + 1))}
                disabled={currentPage === transactionData.pages}
                className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenTransactionHistory;