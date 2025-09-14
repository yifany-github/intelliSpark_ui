import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CreditCard, 
  Zap, 
  Star, 
  CheckCircle, 
  Loader2, 
  AlertTriangle, 
  Gift,
  Crown,
  TrendingUp,
  Shield,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

interface PricingTier {
  id: string;
  name: string;
  tokens: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  bonus?: number;
  features?: string[];
  savings?: string;
}

const fetchPricingTiers = async (): Promise<PricingTier[]> => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await apiRequest('GET', '/api/payment/pricing-tiers');

  if (!response.ok) {
    throw new Error('Failed to fetch pricing tiers');
  }

  return response.json();
};

const createPaymentIntent = async (tierId: string) => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await apiRequest('POST', '/api/payment/create-payment-intent', { tier_id: tierId });

  if (!response.ok) {
    throw new Error('Failed to create payment intent');
  }

  return response.json();
};

interface EnhancedTokenPurchaseProps {
  className?: string;
  onPurchaseSuccess?: () => void;
  compact?: boolean;
}

export const EnhancedTokenPurchase: React.FC<EnhancedTokenPurchaseProps> = ({
  className,
  onPurchaseSuccess,
  compact = false
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const { data: pricingTiers, isLoading: isLoadingTiers } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: fetchPricingTiers,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const handlePurchase = async (tierId: string) => {
    if (!user) {
      setPurchaseError(t('pleaseLoginToPurchase'));
      return;
    }

    setIsProcessing(true);
    setPurchaseError(null);
    setSelectedTier(tierId);

    try {
      const { client_secret } = await createPaymentIntent(tierId);
      
      // In a real implementation, you would integrate with Stripe here
      // For now, we'll simulate a successful purchase
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (onPurchaseSuccess) {
        onPurchaseSuccess();
      }
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : t('purchaseFailed'));
    } finally {
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  const getTierIcon = (tier: PricingTier) => {
    if (tier.popular) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (tier.bonus && tier.bonus > 0) return <Gift className="h-5 w-5 text-brand-secondary" />;
    return <Zap className="h-5 w-5 text-brand-accent" />;
  };

  const getTierBadge = (tier: PricingTier) => {
    if (tier.popular) {
      return (
        <Badge className="bg-yellow-900 text-yellow-400 border-yellow-800 mb-2">
          <Star className="h-3 w-3 mr-1" />
          {t('popular')}
        </Badge>
      );
    }
    if (tier.savings) {
      return (
        <Badge className="bg-brand-secondary/20 text-brand-secondary border-brand-secondary/40 mb-2">
          <TrendingUp className="h-3 w-3 mr-1" />
          {tier.savings}
        </Badge>
      );
    }
    return null;
  };

  const getTierFeatures = (tier: PricingTier) => {
    const features = tier.features || [];
    
    // Add default features based on tier size
    const defaultFeatures = [];
    if (tier.tokens >= 1000) {
      defaultFeatures.push(t('prioritySupport'));
      defaultFeatures.push(t('advancedFeatures'));
    }
    if (tier.tokens >= 500) {
      defaultFeatures.push(t('extendedChatHistory'));
    }
    if (tier.bonus && tier.bonus > 0) {
      defaultFeatures.push(`${tier.bonus} ${t('bonusTokens')}`);
    }
    
    return [...features, ...defaultFeatures];
  };

  if (isLoadingTiers) {
    return (
      <Card className={cn("bg-gray-800 border-gray-700", className)}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-accent" />
            {t('purchaseTokens')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-gray-800 border-gray-700", className)}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-accent" />
          {t('purchaseTokens')}
        </CardTitle>
        <p className="text-sm text-gray-400">
          {t('choosePerfectPackage')}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {purchaseError && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">{purchaseError}</span>
          </div>
        )}

        <div className={cn(
          "grid gap-4",
          compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}>
          {pricingTiers?.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "relative p-4 bg-gray-700 rounded-lg border transition-all duration-200",
                tier.popular 
                  ? "border-yellow-400 bg-yellow-900/10" 
                  : "border-gray-600 hover:border-blue-400",
                compact && "p-3"
              )}
            >
              {getTierBadge(tier)}
              
              <div className="flex items-center gap-3 mb-3">
                {getTierIcon(tier)}
                <div>
                  <h3 className="font-semibold text-white">{tier.name}</h3>
                  <p className="text-sm text-gray-400">{tier.tokens} {t('tokens')}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">${tier.price}</span>
                  {tier.originalPrice && tier.originalPrice > tier.price && (
                    <span className="text-sm text-gray-400 line-through">
                      ${tier.originalPrice}
                    </span>
                  )}
                </div>
                {tier.bonus && tier.bonus > 0 && (
                  <div className="flex items-center gap-1 text-sm text-brand-secondary mt-1">
                    <Gift className="h-3 w-3" />
                    +{tier.bonus} {t('bonusTokens')}
                  </div>
                )}
              </div>

              {!compact && (
                <div className="mb-4 space-y-2">
                  {getTierFeatures(tier).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="h-3 w-3 text-brand-secondary" />
                      {feature}
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => handlePurchase(tier.id)}
                disabled={isProcessing}
                className={cn(
                  "w-full transition-all duration-200",
                  tier.popular
                    ? "bg-yellow-600 hover:bg-yellow-700 text-black"
                    : "bg-brand-accent hover:bg-indigo-500 text-white"
                )}
              >
                {isProcessing && selectedTier === tier.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('processing')}...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('purchaseNow')}
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-3 bg-brand-secondary/20/20 border border-brand-secondary/40 rounded-lg mt-4">
          <Shield className="h-4 w-4 text-brand-secondary" />
          <span className="text-brand-secondary text-sm">
            {t('securePayment')}
          </span>
        </div>

        {/* Additional Features */}
        {!compact && (
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-accent" />
              {t('whyChooseTokens')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-brand-secondary" />
                {t('neverExpire')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-brand-secondary" />
                {t('instantActivation')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-brand-secondary" />
                {t('premiumAI')}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-brand-secondary" />
                {t('support24x7')}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedTokenPurchase;
