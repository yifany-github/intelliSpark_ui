import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Coins, 
  Plus, 
  History, 
  BarChart3, 
  Settings, 
  Download,
  RefreshCw,
  CreditCard,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { ImprovedTokenBalance } from './ImprovedTokenBalance';
import { TokenTransactionHistory } from './TokenTransactionHistory';
import { TokenUsageStats } from './TokenUsageStats';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface TokenManagementProps {
  className?: string;
  defaultTab?: 'overview' | 'history' | 'stats' | 'settings';
}

export const TokenManagement: React.FC<TokenManagementProps> = ({
  className,
  defaultTab = 'overview'
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const handleBuyTokens = () => {
    setLocation('/payment');
  };

  const handleExportData = () => {
    // Implementation for exporting transaction data
    console.log('Export data functionality');
  };

  if (!isAuthenticated) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Coins className="h-12 w-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold text-white mb-2">{t('authenticationRequired')}</h3>
            <p className="text-gray-400 mb-4">{t('pleaseLoginToManageTokens')}</p>
            <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700 rounded-2xl">
              {t('login')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="h-6 w-6 text-yellow-400" />
            {t('tokenManagement')}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('manageTokenDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportData}
            className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('exportData')}
          </Button>
          <Button 
            size="sm"
            onClick={handleBuyTokens}
            className="bg-blue-600 hover:bg-blue-700 rounded-2xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('buyTokens')}
          </Button>
        </div>
      </div>

      {/* Quick Token Balance */}
      <ImprovedTokenBalance 
        showTitle={true} 
        compact={false} 
        showStats={true} 
        showActions={true}
        className="mb-6"
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'history' | 'stats' | 'settings')} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
          <TabsTrigger 
            value="overview" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <Target className="h-4 w-4" />
            {t('overview')}
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <History className="h-4 w-4" />
            {t('history')}
          </TabsTrigger>
          <TabsTrigger 
            value="stats" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            {t('statistics')}
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <Settings className="h-4 w-4" />
            {t('settings')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <TokenUsageStats compact={true} />
              
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    {t('quickActions')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleBuyTokens}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('purchaseMoreTokens')}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setLocation('/chats')}
                    className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('startNewChat')}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('history')}
                    className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
                  >
                    <History className="h-4 w-4 mr-2" />
                    {t('viewTransactionHistory')}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <TokenTransactionHistory compact={true} maxItems={5} />
              
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                    {t('tokenTips')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      💡 {t('optimizeUsage')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('engageLongerConversations')}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      🎯 {t('saveOnBulkPurchases')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('largerPackagesBetter')}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      ⚡ {t('tokensNeverExpire')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {t('buyTokensWhenNeeded')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <TokenTransactionHistory compact={false} maxItems={50} />
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
          <TokenUsageStats compact={false} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-400" />
                  {t('tokenPreferences')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t('lowBalanceAlerts')}</div>
                    <div className="text-xs text-gray-400">
                      {t('getNotifiedLowBalance')}
                    </div>
                  </div>
                  <Badge className="bg-green-900 text-green-400">{t('enabled')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t('autoPurchase')}</div>
                    <div className="text-xs text-gray-400">
                      {t('automaticallyBuyTokens')}
                    </div>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400">{t('disabled')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{t('usageAnalytics')}</div>
                    <div className="text-xs text-gray-400">
                      {t('trackDetailedUsage')}
                    </div>
                  </div>
                  <Badge className="bg-green-900 text-green-400">{t('enabled')}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-400" />
                  {t('paymentSettings')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm text-white font-medium mb-2">
                    {t('defaultPaymentMethod')}
                  </div>
                  <div className="text-xs text-gray-400">
                    •••• •••• •••• 1234 (Visa)
                  </div>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm text-white font-medium mb-2">
                    {t('preferredPackage')}
                  </div>
                  <div className="text-xs text-gray-400">
                    Standard Pack (500 tokens)
                  </div>
                </div>
                <Button 
                  variant="outline"
                  className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('updatePaymentSettings')}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-gray-800 border-gray-700">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-gray-400">
              <strong className="text-white">{t('securityNotice')}:</strong> {t('securityInfo')}
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TokenManagement;