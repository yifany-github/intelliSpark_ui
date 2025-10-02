import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Crown, Check, Zap, Calendar, AlertCircle, Loader2, X, TrendingUp, TrendingDown, CreditCard, QrCode } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import { QRCodePayment } from '@/components/payment/QRCodePayment';
import { PaymentMethod } from '@/types/payments';
import type {
  SubscriptionPlans,
  SubscriptionTier,
  UserSubscriptionResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
} from '@/types/payments';

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

// Note: You'll need to create these Price IDs in your Stripe Dashboard
// For testing, use test mode price IDs
const STRIPE_PRICE_IDS = {
  basic: import.meta.env.VITE_STRIPE_PRICE_BASIC || 'price_basic_test',
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_pro_test',
  premium: import.meta.env.VITE_STRIPE_PRICE_PREMIUM || 'price_premium_test',
};

const fetchSubscriptionPlans = async (): Promise<SubscriptionPlans> => {
  const res = await apiRequest('GET', '/api/payment/subscription-plans');
  if (!res.ok) throw new Error('Failed to fetch subscription plans');
  return res.json();
};

const fetchUserSubscription = async (): Promise<UserSubscriptionResponse> => {
  const res = await apiRequest('GET', '/api/payment/user/subscription');
  if (!res.ok) throw new Error('Failed to fetch subscription');
  return res.json();
};

const createSubscription = async (data: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> => {
  const res = await apiRequest('POST', '/api/payment/create-subscription', data);
  if (!res.ok) throw new Error('Failed to create subscription');
  return res.json();
};

const cancelSubscription = async (cancelImmediately: boolean = false) => {
  const res = await apiRequest('POST', '/api/payment/cancel-subscription', {
    cancel_immediately: cancelImmediately,
  });
  if (!res.ok) throw new Error('Failed to cancel subscription');
  return res.json();
};

const updateSubscription = async (data: CreateSubscriptionRequest) => {
  const res = await apiRequest('POST', '/api/payment/update-subscription', data);
  if (!res.ok) throw new Error('Failed to update subscription');
  return res.json();
};

const fetchSavedPaymentMethods = async (): Promise<SavedPaymentMethod[]> => {
  const res = await apiRequest('GET', '/api/payment/saved-payment-methods');
  if (!res.ok) throw new Error('Failed to fetch saved payment methods');
  return res.json();
};

// Create one-time payment for WeChat monthly subscription
const createWechatMonthlyPayment = async (tier: SubscriptionTier) => {
  // Backend now supports subscription tiers (basic, pro, premium) directly
  // No mapping needed - it will use SUBSCRIPTION_PLANS for correct pricing
  const res = await apiRequest('POST', '/api/payment/create-payment-intent', {
    tier, // Send subscription tier directly (basic/pro/premium)
    amount: 0, // Backend derives amount from tier
    payment_method: 'wechat_pay',
    save_payment_method: false,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create WeChat payment (${res.status})`);
  }
  return res.json();
};

export const PremiumMembership: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('basic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPollingTokens, setIsPollingTokens] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [wechatQrCode, setWechatQrCode] = useState<string | null>(null);
  const [wechatPaymentIntentId, setWechatPaymentIntentId] = useState<string | null>(null);
  const [wechatClientSecret, setWechatClientSecret] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: fetchSubscriptionPlans,
  });

  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['userSubscription'],
    queryFn: fetchUserSubscription,
    enabled: !!user,
  });

  const { data: savedCardsRaw, isLoading: savedCardsLoading } = useQuery({
    queryKey: ['savedPaymentMethods'],
    queryFn: fetchSavedPaymentMethods,
    enabled: !!user,
  });

  // Deduplicate saved cards
  const savedCards = React.useMemo(() => {
    if (!savedCardsRaw) return [];
    const uniqueCards = new Map<string, SavedPaymentMethod>();
    savedCardsRaw.forEach(card => {
      const key = `${card.brand}-${card.last4}-${card.exp_month}-${card.exp_year}`;
      if (!uniqueCards.has(key)) {
        uniqueCards.set(key, card);
      }
    });
    return Array.from(uniqueCards.values());
  }, [savedCardsRaw]);

  // Auto-select first saved card
  useEffect(() => {
    if (savedCards.length > 0 && !selectedSavedCardId) {
      setSelectedSavedCardId(savedCards[0].id);
      setUseSavedCard(true);
    }
  }, [savedCards, selectedSavedCardId]);

  // Token polling function - checks for token updates after subscription
  const pollForTokens = useCallback(async () => {
    setIsPollingTokens(true);
    const maxAttempts = 10; // 10 attempts * 3 seconds = 30 seconds max
    let attempts = 0;

    const checkTokens = async (): Promise<boolean> => {
      await queryClient.invalidateQueries({ queryKey: ['userTokens'] });
      await queryClient.invalidateQueries({ queryKey: ['userSubscription'] });

      const sub = queryClient.getQueryData<UserSubscriptionResponse>(['userSubscription']);
      return sub?.subscription?.tokens_allocated_this_period ? sub.subscription.tokens_allocated_this_period > 0 : false;
    };

    const poll = async () => {
      while (attempts < maxAttempts) {
        attempts++;

        const hasTokens = await checkTokens();
        if (hasTokens) {
          toast({
            title: "Tokens Added!",
            description: "Your subscription tokens have been added to your account.",
            variant: "default",
          });
          setIsPollingTokens(false);
          return;
        }

        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
      }

      // Timeout after 30 seconds
      toast({
        title: "Processing...",
        description: "Your tokens are being processed. They should appear shortly.",
        variant: "default",
      });
      setIsPollingTokens(false);
    };

    await poll();
  }, [queryClient, toast]);

  const createSubscriptionMutation = useMutation({
    mutationFn: createSubscription,
    onSuccess: async (data) => {
      if (!stripe || !data.client_secret) {
        setError('Stripe not initialized');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        let result;

        if (useSavedCard && selectedSavedCardId) {
          // Use saved card
          result = await stripe.confirmCardPayment(data.client_secret, {
            payment_method: selectedSavedCardId,
          });
        } else {
          // Use new card
          const cardElement = elements?.getElement(CardElement);
          if (!cardElement) {
            setError('Card element not found');
            return;
          }

          result = await stripe.confirmCardPayment(data.client_secret, {
            payment_method: {
              card: cardElement,
              billing_details: {
                email: user?.email,
              },
            },
          });
        }

        if (result.error) {
          setError(result.error.message || 'Subscription creation failed');
        } else {
          // Success! Show toast and start polling for tokens
          toast({
            title: "Subscription Activated!",
            description: "Your subscription is now active. Tokens will be added shortly...",
            variant: "default",
          });
          setError(null);

          // Start polling for tokens
          pollForTokens();
        }
      } catch (err) {
        setError('Subscription processing failed');
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsProcessing(false);
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSubscription'] });
      setShowCancelConfirm(false);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: updateSubscription,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userSubscription'] });
      queryClient.invalidateQueries({ queryKey: ['userTokens'] });

      toast({
        title: data.immediate ? "Upgraded Successfully!" : "Downgrade Scheduled",
        description: data.message,
      });

      // Poll for tokens if it's an immediate upgrade
      if (data.immediate) {
        pollForTokens();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const wechatPaymentMutation = useMutation({
    mutationFn: createWechatMonthlyPayment,
    onSuccess: (data) => {
      const qrDetails = data.next_action?.wechat_pay_display_qr_code;
      const qrUrl = qrDetails?.image_url_png || qrDetails?.image_url_svg || qrDetails?.image_data_url;

      if (qrUrl && data.client_secret && data.payment_intent_id) {
        setWechatQrCode(qrUrl);
        setWechatPaymentIntentId(data.payment_intent_id);
        setWechatClientSecret(data.client_secret);
        setError(null);
      } else {
        setError('Unable to generate WeChat QR code - missing required data');
        // Clear stale state
        setWechatQrCode(null);
        setWechatPaymentIntentId(null);
        setWechatClientSecret(null);
      }
    },
    onError: (error: Error) => {
      setError(error.message);
      // Clear stale WeChat state on error
      setWechatQrCode(null);
      setWechatPaymentIntentId(null);
      setWechatClientSecret(null);
    },
  });

  const handleWechatPaymentSuccess = () => {
    setWechatQrCode(null);
    setWechatPaymentIntentId(null);
    setWechatClientSecret(null);

    toast({
      title: "Payment Successful!",
      description: "Your monthly tokens have been added. Remember to pay again next month!",
      variant: "default",
    });

    // Refresh subscription and token data
    queryClient.invalidateQueries({ queryKey: ['userSubscription'] });
    queryClient.invalidateQueries({ queryKey: ['userTokens'] });
    queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
  };

  const handleSubscribe = () => {
    if (!selectedTier || !plans) return;

    // Handle WeChat Pay separately (one-time monthly payment)
    if (selectedMethod === 'wechat_pay') {
      wechatPaymentMutation.mutate(selectedTier);
      return;
    }

    const priceId = STRIPE_PRICE_IDS[selectedTier];

    // If user has active subscription, this is an upgrade/downgrade
    if (hasActiveSubscription) {
      const currentTier = userSubscription.subscription?.plan_tier;

      // Prevent selecting the same plan
      if (currentTier === selectedTier) {
        toast({
          title: "Already Subscribed",
          description: `You already have an active ${selectedTier} plan.`,
          variant: "destructive",
        });
        return;
      }

      // Update subscription (upgrade or downgrade)
      updateSubscriptionMutation.mutate({
        tier: selectedTier,
        price_id: priceId,
      });
    } else {
      // Create new subscription
      createSubscriptionMutation.mutate({
        tier: selectedTier,
        price_id: priceId,
      });
    }
  };

  const handleCancel = () => {
    cancelSubscriptionMutation.mutate(false); // Cancel at period end
  };

  const hasActiveSubscription = userSubscription?.has_subscription &&
    userSubscription.subscription?.status === 'active';

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#F9FAFB',
        fontFamily: '"Inter", system-ui, sans-serif',
        '::placeholder': {
          color: '#9CA3AF',
        },
      },
      invalid: {
        color: '#EF4444',
      },
    },
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          <h2 className="text-3xl font-bold text-white">Premium Membership</h2>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Subscribe to a monthly plan and never run out of tokens. Enjoy recurring credits with exclusive savings!
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-400">{error}</AlertDescription>
        </Alert>
      )}

      {/* Active Subscription Display */}
      {hasActiveSubscription && userSubscription.subscription && (
        <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-white">Active Subscription</CardTitle>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                {userSubscription.subscription.plan_tier.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Monthly Tokens</p>
                <p className="text-2xl font-bold text-white">
                  {userSubscription.subscription.monthly_token_allowance}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Allocated This Period</p>
                <p className="text-2xl font-bold text-purple-400">
                  {userSubscription.subscription.tokens_allocated_this_period}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Calendar className="h-4 w-4" />
              <span>
                Auto-renews on {new Date(userSubscription.subscription.current_period_end).toLocaleDateString()}
              </span>
            </div>

            {userSubscription.subscription.cancel_at_period_end && (
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-300">
                  Your subscription will end on {new Date(userSubscription.subscription.current_period_end).toLocaleDateString()}. It will not auto-renew.
                </AlertDescription>
              </Alert>
            )}

            {!userSubscription.subscription.cancel_at_period_end && (
              <Button
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelSubscriptionMutation.isPending}
              >
                {cancelSubscriptionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <Card className="bg-gray-900/90 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Cancellation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              Are you sure you want to cancel your subscription? You'll still have access until the end of your current billing period.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleCancel}
              >
                Yes, Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Plans */}
      {plans && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            {(Object.keys(plans) as SubscriptionTier[]).map((tier) => {
              const plan = plans[tier];
              const isSelected = selectedTier === tier;
              const isRecommended = tier === 'pro';
              const isCurrentPlan = hasActiveSubscription && userSubscription.subscription?.plan_tier === tier;

              return (
                <Card
                  key={tier}
                  className={`relative cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-purple-900/60 to-pink-900/60 border-purple-500 scale-105'
                      : 'bg-gray-900/40 border-gray-700 hover:border-purple-500/50'
                  } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
                  onClick={() => setSelectedTier(tier)}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-green-500 text-white border-0">
                        <Check className="h-3 w-3 mr-1" />
                        CURRENT PLAN
                      </Badge>
                    </div>
                  )}
                  {!isCurrentPlan && isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                        <Zap className="h-3 w-3 mr-1" />
                        RECOMMENDED
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-white capitalize">{plan.name}</CardTitle>
                    <CardDescription className="text-gray-400">{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">
                          ${(plan.price / 100).toFixed(0)}
                        </span>
                        <span className="text-gray-400">/month</span>
                      </div>
                      {plan.price_cny && (
                        <p className="text-sm text-gray-500">
                          ¥{(plan.price_cny / 100).toFixed(0)} CNY
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-purple-400">
                        <Check className="h-4 w-4" />
                        <span className="font-semibold">{plan.monthly_tokens} tokens/month</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Tokens expire after 2 months</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Auto-renewal</span>
                      </div>
                    </div>

                    {isSelected && (
                      <Badge className="w-full justify-center bg-purple-500/20 text-purple-300 border-purple-500/30">
                        Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Payment Form */}
          <Card className="bg-gray-900/60 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Payment Details</CardTitle>
              <CardDescription className="text-gray-400">
                Subscribe to the {selectedTier} plan - {plans[selectedTier]?.monthly_tokens} tokens per month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show QR Code if WeChat payment is active */}
              {wechatQrCode && wechatPaymentIntentId && wechatClientSecret ? (
                <div className="space-y-4">
                  <QRCodePayment
                    clientSecret={wechatClientSecret}
                    paymentIntentId={wechatPaymentIntentId}
                    qrImageUrl={wechatQrCode}
                    amount={plans[selectedTier]?.price_cny || 0}
                    currency="cny"
                    method="wechat_pay"
                    onSuccess={handleWechatPaymentSuccess}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWechatQrCode(null);
                      setWechatPaymentIntentId(null);
                      setWechatClientSecret(null);
                    }}
                    className="w-full"
                  >
                    Back to Payment Options
                  </Button>
                </div>
              ) : (
              <>
              {/* Payment method selection for all subscriptions */}
              <>
                {/* Payment Method Selector (Card and WeChat only for subscriptions) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">选择支付方式</label>
                  <div className="grid gap-3">
                    {/* Card Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMethod('card');
                        setUseSavedCard(savedCards.length > 0);
                      }}
                      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all bg-gray-800/80 border-gray-700 hover:border-brand-accent hover:bg-gray-800 ${
                        selectedMethod === 'card' ? 'border-brand-accent ring-2 ring-brand-accent/30' : ''
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        selectedMethod === 'card' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-300'
                      }`}>
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Credit / Debit Card</span>
                          {selectedMethod === 'card' && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-400">Pay securely with Visa, Mastercard, American Express, and more.</p>
                      </div>
                    </button>

                    {/* WeChat Pay Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMethod('wechat_pay');
                        setUseSavedCard(false);
                      }}
                      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all bg-gray-800/80 border-gray-700 hover:border-brand-accent hover:bg-gray-800 ${
                        selectedMethod === 'wechat_pay' ? 'border-brand-accent ring-2 ring-brand-accent/30' : ''
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        selectedMethod === 'wechat_pay' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-300'
                      }`}>
                        <QrCode className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">WeChat Pay</span>
                          <span className="rounded-full bg-brand-accent/20 px-2 py-0.5 text-xs font-medium text-brand-accent">
                            China
                          </span>
                          {selectedMethod === 'wechat_pay' && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-400">Scan the QR code with WeChat to complete your purchase.</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Saved Cards Section (only for card payments) */}
                {selectedMethod === 'card' && savedCards.length > 0 && useSavedCard && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">使用已保存的卡片</label>
                        <button
                          type="button"
                          onClick={() => setUseSavedCard(false)}
                          className="text-xs font-medium text-purple-400 hover:text-purple-300"
                        >
                          + 添加新卡片
                        </button>
                      </div>
                      <div className="space-y-2">
                        {savedCards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => setSelectedSavedCardId(card.id)}
                            className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition ${
                              selectedSavedCardId === card.id
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <CreditCard className="h-5 w-5 text-purple-400" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white">
                                {card.brand.toUpperCase()} •••• {card.last4}
                              </div>
                              <div className="text-xs text-gray-400">
                                到期 {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}
                              </div>
                            </div>
                            {selectedSavedCardId === card.id && <Check className="h-5 w-5 text-purple-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New Card Section (only for card payments) */}
                  {selectedMethod === 'card' && (!useSavedCard || savedCards.length === 0) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">卡片信息</label>
                        {savedCards.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUseSavedCard(true);
                              setSelectedSavedCardId(savedCards[0]?.id || '');
                            }}
                            className="text-xs font-medium text-purple-400 hover:text-purple-300"
                          >
                            使用已保存的卡片
                          </button>
                        )}
                      </div>
                      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <CardElement options={cardElementOptions} />
                      </div>
                    </div>
                  )}

                  {/* WeChat Pay Information */}
                  {selectedMethod === 'wechat_pay' && (
                    <Alert className="bg-blue-500/10 border-blue-500/30">
                      <AlertCircle className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-blue-300 text-sm">
                        微信支付将按月收费。每月需要手动完成支付，我们会在续费日期临近时提醒您。
                      </AlertDescription>
                    </Alert>
                  )}
                </>

              {hasActiveSubscription && userSubscription.subscription?.plan_tier !== selectedTier && (
                <Alert className="bg-purple-500/10 border-purple-500/30">
                  <AlertCircle className="h-4 w-4 text-purple-400" />
                  <AlertDescription className="text-purple-300 text-sm">
                    {(() => {
                      const currentPlan = plans[userSubscription.subscription?.plan_tier || ''];
                      const newPlan = plans[selectedTier];
                      const isUpgrade = newPlan && currentPlan && newPlan.price > currentPlan.price;

                      if (isUpgrade) {
                        return `You'll be charged a prorated amount for the upgrade. Your existing payment method will be used.`;
                      } else {
                        return `Your plan will downgrade at the end of the current billing period. You'll keep your current benefits until then.`;
                      }
                    })()}
                  </AlertDescription>
                </Alert>
              )}

              {!hasActiveSubscription && (
                <Alert className="bg-blue-500/10 border-blue-500/30">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-300 text-sm">
                    You'll be charged ${((plans[selectedTier]?.price || 0) / 100).toFixed(2)} today and then monthly until you cancel.
                    Tokens expire 2 months after allocation.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSubscribe}
                disabled={
                  (selectedMethod === 'card' && !stripe) ||
                  isProcessing ||
                  createSubscriptionMutation.isPending ||
                  updateSubscriptionMutation.isPending ||
                  wechatPaymentMutation.isPending ||
                  isPollingTokens ||
                  (hasActiveSubscription && userSubscription.subscription?.plan_tier === selectedTier)
                }
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing || createSubscriptionMutation.isPending || updateSubscriptionMutation.isPending || wechatPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {wechatPaymentMutation.isPending ? 'Generating QR Code...' : 'Processing...'}
                  </>
                ) : isPollingTokens ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Adding tokens...
                  </>
                ) : (hasActiveSubscription && userSubscription.subscription?.plan_tier === selectedTier) ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Current Plan
                  </>
                ) : hasActiveSubscription ? (
                  // Show Upgrade or Downgrade based on price comparison
                  (() => {
                    const currentPlan = plans[userSubscription.subscription?.plan_tier || ''];
                    const newPlan = plans[selectedTier];
                    const isUpgrade = newPlan && currentPlan && newPlan.price > currentPlan.price;

                    return (
                      <>
                        {isUpgrade ? (
                          <>
                            <TrendingUp className="mr-2 h-5 w-5" />
                            Upgrade to {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="mr-2 h-5 w-5" />
                            Downgrade to {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                          </>
                        )}
                      </>
                    );
                  })()
                ) : selectedMethod === 'wechat_pay' ? (
                  <>
                    <QrCode className="mr-2 h-5 w-5" />
                    微信支付 - 首月 ¥{((plans[selectedTier]?.price_cny || 0) / 100).toFixed(0)}
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-5 w-5" />
                    Subscribe to {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Plan
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                By subscribing, you agree to automatic monthly billing. You can cancel anytime from this page.
              </p>
              </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
