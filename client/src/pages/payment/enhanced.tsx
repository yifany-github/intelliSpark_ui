import React, { useState } from 'react';
import { ArrowLeft, BarChart3, History, Coins } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { useLocation } from 'wouter';
import { ImprovedTokenBalance } from '../../components/payment/ImprovedTokenBalance';
import { EnhancedTokenPurchase } from '../../components/payment/EnhancedTokenPurchase';
import { TokenTransactionHistory } from '../../components/payment/TokenTransactionHistory';
import { TokenUsageStats } from '../../components/payment/TokenUsageStats';
import GlobalLayout from '../../components/layout/GlobalLayout';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../lib/utils';

type Tab = 'overview' | 'purchase' | 'history' | 'stats';

const EnhancedPaymentPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const handleBack = () => {
    setLocation('/profile');
  };

  const handlePurchaseSuccess = () => {
    setActiveTab('overview');
    // Could add a success toast here
  };

  const tabs = [
    { id: 'overview' as Tab, label: t('balance'), icon: Coins },
    { id: 'purchase' as Tab, label: t('purchaseTokens'), icon: Coins },
    { id: 'history' as Tab, label: t('transactionHistory'), icon: History },
    { id: 'stats' as Tab, label: t('usageStats'), icon: BarChart3 },
  ];

  return (
    <GlobalLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('profile')}
          </Button>
          <h1 className="text-3xl font-bold mb-2 text-white">{t('tokens')}</h1>
          <p className="text-gray-400">
            {t('manageTokenDescription')}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 border-b border-gray-700">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-400 hover:text-white hover:border-gray-600"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Token Balance Overview */}
              <ImprovedTokenBalance 
                showTitle={true} 
                compact={false} 
                showStats={true} 
                showActions={true}
                onPurchaseClick={() => setActiveTab('purchase')}
                onHistoryClick={() => setActiveTab('history')}
              />

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TokenUsageStats showTitle={true} compact={true} />
                <TokenTransactionHistory showTitle={true} compact={true} maxItems={5} />
              </div>

              {/* Quick Actions */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">{t('quickActions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={() => setActiveTab('purchase')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      {t('buyMoreTokens')}
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('history')}
                      variant="outline"
                      className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
                    >
                      <History className="h-4 w-4 mr-2" />
                      {t('viewHistory')}
                    </Button>
                    <Button 
                      onClick={() => setActiveTab('stats')}
                      variant="outline"
                      className="bg-secondary border-secondary hover:bg-secondary/80 text-white"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {t('usageStats')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'purchase' && (
            <div className="space-y-6">
              {/* Current Balance */}
              <ImprovedTokenBalance 
                showTitle={true} 
                compact={true} 
                showStats={false} 
                showActions={false}
              />
              
              <Separator className="border-gray-700" />
              
              {/* Purchase Interface */}
              <EnhancedTokenPurchase 
                onPurchaseSuccess={handlePurchaseSuccess}
                compact={false}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Current Balance */}
              <ImprovedTokenBalance 
                showTitle={true} 
                compact={true} 
                showStats={false} 
                showActions={false}
              />
              
              <Separator className="border-gray-700" />
              
              {/* Transaction History */}
              <TokenTransactionHistory 
                showTitle={true} 
                compact={false} 
                maxItems={50}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Current Balance */}
              <ImprovedTokenBalance 
                showTitle={true} 
                compact={true} 
                showStats={false} 
                showActions={false}
              />
              
              <Separator className="border-gray-700" />
              
              {/* Usage Statistics */}
              <TokenUsageStats 
                showTitle={true} 
                compact={false}
              />
            </div>
          )}
        </div>

        {/* Footer Information */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-3 text-white flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
{t('tokens')} {t('faq')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-white mb-1">{t('howTokensWork')}</h4>
              <p>{t('tokenCostExplanation')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('doTokensExpire')}</h4>
              <p>{t('tokensNeverExpire')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('canGetRefund')}</h4>
              <p>{t('refundPolicy')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">{t('paymentsSecure')}</h4>
              <p>{t('securityInfo')}</p>
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default EnhancedPaymentPage;