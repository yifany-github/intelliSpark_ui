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
            <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
            <p className="text-gray-400 mb-4">Please log in to manage your tokens</p>
            <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700 rounded-2xl">
              Log In
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
            Token Management
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your tokens, view usage history, and analyze your chat patterns
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
            Export Data
          </Button>
          <Button 
            size="sm"
            onClick={handleBuyTokens}
            className="bg-blue-600 hover:bg-blue-700 rounded-2xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Buy Tokens
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
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger 
            value="stats" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
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
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleBuyTokens}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Purchase More Tokens
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setLocation('/chats')}
                    className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Start New Chat
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('history')}
                    className="w-full bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl"
                  >
                    <History className="h-4 w-4 mr-2" />
                    View Transaction History
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
                    Token Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      💡 Optimize Your Usage
                    </div>
                    <div className="text-xs text-gray-400">
                      Engage in longer conversations to get more value from each token
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      🎯 Save on Bulk Purchases
                    </div>
                    <div className="text-xs text-gray-400">
                      Larger token packages offer better value per token
                    </div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-white font-medium mb-1">
                      ⚡ Tokens Never Expire
                    </div>
                    <div className="text-xs text-gray-400">
                      Buy tokens when you need them - they'll always be available
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
                  Token Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Low Balance Alerts</div>
                    <div className="text-xs text-gray-400">
                      Get notified when your token balance is low
                    </div>
                  </div>
                  <Badge className="bg-green-900 text-green-400">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Auto-Purchase</div>
                    <div className="text-xs text-gray-400">
                      Automatically buy tokens when balance is low
                    </div>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400">Disabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Usage Analytics</div>
                    <div className="text-xs text-gray-400">
                      Track detailed usage patterns and insights
                    </div>
                  </div>
                  <Badge className="bg-green-900 text-green-400">Enabled</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-400" />
                  Payment Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm text-white font-medium mb-2">
                    Default Payment Method
                  </div>
                  <div className="text-xs text-gray-400">
                    •••• •••• •••• 1234 (Visa)
                  </div>
                </div>
                <div className="p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm text-white font-medium mb-2">
                    Preferred Package
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
                  Update Payment Settings
                </Button>
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-gray-800 border-gray-700">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-gray-400">
              <strong className="text-white">Security Notice:</strong> Your payment information is securely processed by Stripe. 
              We never store your card details on our servers.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TokenManagement;