import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Coins, CreditCard, Loader2, Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Separator } from '../../components/ui/separator';
import { useNavigation } from '../../contexts/NavigationContext';
import { ImprovedTokenBalance } from '../../components/payment/ImprovedTokenBalance';
import GlobalLayout from '../../components/layout/GlobalLayout';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiRequest } from '@/lib/queryClient';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import { QRCodePayment } from '@/components/payment/QRCodePayment';
import { PaymentMethod } from '@/types/payments';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Initialize Stripe (you'll need to set your publishable key in environment variables)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

interface PricingTier {
  tokens: number;
  price: number;
  price_cny?: number;
  description: string;
  fx_rate?: number;
}

interface PricingTiers {
  [key: string]: PricingTier;
}

const fetchPricingTiers = async (): Promise<PricingTiers> => {
  // Use env-configured base URL
  const res = await fetch(`${API_BASE_URL}/api/payment/pricing-tiers`);
  if (!res.ok) throw new Error('Failed to fetch pricing tiers');
  return res.json();
};

interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  tokens: number;
  currency: string;
  payment_method: PaymentMethod;
  next_action?: Record<string, any>;
}

const createPaymentIntent = async (tier: string, paymentMethod: PaymentMethod, returnUrl?: string) => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const res = await apiRequest('POST', '/api/payment/create-payment-intent', {
    tier,
    amount: 0,
    payment_method: paymentMethod,
    return_url: returnUrl,
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  return res.json() as Promise<PaymentIntentResponse>;
};

const CardPaymentForm: React.FC<{ 
  selectedTier: string; 
  tierData: PricingTier;
  onSuccess: () => void; 
}> = ({ selectedTier, tierData, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US'
    }
  });

  const { mutate: createPayment } = useMutation({
    mutationFn: (tier: string) => createPaymentIntent(tier, 'card'),
    onSuccess: async (data) => {
      if (!stripe || !elements) return;

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return;

      setIsProcessing(true);
      setError(null);

      try {
        const { error: stripeError } = await stripe.confirmCardPayment(data.client_secret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: billingDetails.name,
              email: billingDetails.email,
              address: {
                line1: billingDetails.address.line1,
                line2: billingDetails.address.line2,
                city: billingDetails.address.city,
                state: billingDetails.address.state,
                postal_code: billingDetails.address.postal_code,
                country: billingDetails.address.country,
              },
            },
          },
        });

        if (stripeError) {
          setError(stripeError.message || 'Payment failed');
        } else {
          onSuccess();
        }
      } catch (err) {
        setError('Payment processing failed');
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    createPayment(selectedTier);
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#1f2937',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <CreditCard className="h-5 w-5 text-brand-secondary" />
          {t('paymentDetails')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
          <div className="flex justify-between items-center">
            <span className="font-medium text-white">{tierData.description}</span>
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-secondary mb-1">
                ${(tierData.price / 100).toFixed(2)}
              </div>
              <div className="text-sm text-content-tertiary uppercase tracking-wide">
                Premium Tokens
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {tierData.tokens} tokens • ${((tierData.price / 100) / tierData.tokens).toFixed(3)} per token
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Billing Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{t('billingInformation')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('fullName')} *</label>
                <input
                  type="text"
                  required
                  value={billingDetails.name}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                  placeholder={t('fullName')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('emailAddress')} *</label>
                <input
                  type="email"
                  required
                  value={billingDetails.email}
                  onChange={(e) => setBillingDetails(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                  placeholder={t('emailAddress')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('addressLine1')} *</label>
              <input
                type="text"
                required
                value={billingDetails.address.line1}
                onChange={(e) => setBillingDetails(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, line1: e.target.value }
                }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                placeholder={t('addressLine1')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('addressLine2')}</label>
              <input
                type="text"
                value={billingDetails.address.line2}
                onChange={(e) => setBillingDetails(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, line2: e.target.value }
                }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                placeholder={`${t('addressLine2')} (${t('optional')})`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('city')} *</label>
                <input
                  type="text"
                  required
                  value={billingDetails.address.city}
                  onChange={(e) => setBillingDetails(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, city: e.target.value }
                  }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                  placeholder={t('city')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('state')} *</label>
                <input
                  type="text"
                  required
                  value={billingDetails.address.state}
                  onChange={(e) => setBillingDetails(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, state: e.target.value }
                  }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                  placeholder={t('state')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('zipCode')} *</label>
                <input
                  type="text"
                  required
                  value={billingDetails.address.postal_code}
                  onChange={(e) => setBillingDetails(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, postal_code: e.target.value }
                  }))}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-accent"
                  placeholder={t('zipCode')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('country')} *</label>
              <select
                required
                value={billingDetails.address.country}
                onChange={(e) => setBillingDetails(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, country: e.target.value }
                }))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-brand-accent"
              >
                <option value="US">{t('unitedStates')}</option>
                <option value="CA">{t('canada')}</option>
                <option value="GB">{t('unitedKingdom')}</option>
                <option value="AU">{t('australia')}</option>
                <option value="DE">{t('germany')}</option>
                <option value="FR">{t('france')}</option>
                <option value="JP">{t('japan')}</option>
                <option value="KR">{t('southKorea')}</option>
                <option value="SG">{t('singapore')}</option>
                <option value="CN">{t('china')}</option>
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{t('paymentMethod')}</h3>
            <div className="p-3 border border-gray-600 rounded-lg bg-gray-700">
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-2">
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                required
                className="mt-1 rounded border-gray-600 bg-gray-700 text-brand-accent focus:ring-brand-accent focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                {t('agreeToTerms')}{' '}
                <a href="#" className="text-brand-secondary hover:text-amber-300 underline">
                  {t('termsOfService')}
                </a>{' '}
                {t('and')}{' '}
                <a href="#" className="text-brand-secondary hover:text-amber-300 underline">
                  {t('privacyPolicy')}
                </a>
              </span>
            </label>
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-600 bg-gray-700 text-brand-accent focus:ring-brand-accent focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                {t('receivePromotional')}
              </span>
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={!stripe || isProcessing} 
            className="w-full bg-gradient-premium text-zinc-900 rounded-2xl font-semibold tracking-wide shadow-premium hover:shadow-glow transition-all duration-200"
            size="lg"
          >
            {isProcessing ? (
              `${t('processing')}...`
            ) : (
              `${t('pay')} $${(tierData.price / 100).toFixed(2)}`
            )}
          </Button>

          <div className="text-xs text-gray-400 text-center">
            {t('paymentProcessingSecure')}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const OrderSummary: React.FC<{ tierData: PricingTier; method: PaymentMethod }> = ({ tierData, method }) => {
  const { t } = useLanguage();
  const usdTotal = (tierData.price / 100).toFixed(2);
  const pricePerToken = ((tierData.price / 100) / tierData.tokens).toFixed(3);
  const cnyTotal = tierData.price_cny ? (tierData.price_cny / 100).toFixed(2) : null;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">{t('orderSummary')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">{tierData.description}</span>
          <span className="text-white font-semibold">${usdTotal}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{tierData.tokens} {t('tokensPlural')}</span>
          <span>${pricePerToken} {t('perToken')}</span>
        </div>

        {cnyTotal && method !== 'card' && (
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Amount in CNY</span>
            <span>¥{cnyTotal}</span>
          </div>
        )}

        <Separator className="border-gray-700" />

        <div className="text-center">
          <div className="text-3xl font-bold text-brand-secondary mb-1">
            ${usdTotal}
          </div>
          <div className="text-sm text-content-tertiary uppercase tracking-wide">
            {t('usd')} • {t('tokensPlural')}
          </div>
        </div>

        {cnyTotal && method !== 'card' && (
          <div className="rounded-lg bg-gray-700/60 p-3 text-sm text-gray-300">
            <div className="font-medium text-white">WeChat/Alipay amount</div>
            <div>¥{cnyTotal}</div>
            <p className="mt-1 text-xs text-gray-400">Final amount may vary slightly due to currency conversion.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface PaymentCheckoutProps {
  selectedTier: string;
  tierData: PricingTier;
  onSuccess: () => void;
  onBack: () => void;
}

interface QRSessionState {
  clientSecret: string;
  paymentIntentId: string;
  qrImageUrl: string;
  amount: number;
  currency: string;
  expiresAt?: number;
  method: PaymentMethod;
}

const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({ selectedTier, tierData, onSuccess, onBack }) => {
  const { t } = useLanguage();
  const stripe = useStripe();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [qrSession, setQrSession] = useState<QRSessionState | null>(null);
  const [isAltProcessing, setIsAltProcessing] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);

  const createAlternativePayment = useMutation<PaymentIntentResponse, Error, PaymentMethod>({
    mutationFn: (method: PaymentMethod) => {
      const returnUrl = new URL(window.location.pathname, window.location.origin);
      returnUrl.searchParams.set('payment', method);
      returnUrl.searchParams.set('status', 'success');
      const encodedReturnUrl = method === 'alipay' ? returnUrl.toString() : undefined;
      return createPaymentIntent(selectedTier, method, encodedReturnUrl);
    },
    onSuccess: async (data: PaymentIntentResponse, method: PaymentMethod) => {
      if (method === 'wechat_pay') {
        const qrDetails = data.next_action?.wechat_pay_display_qr_code;
        const qrUrl = qrDetails?.image_url_png || qrDetails?.image_url_svg || qrDetails?.image_data_url;
        if (!qrUrl) {
          setAltError('Unable to load WeChat Pay QR code. Please try again.');
          return;
        }
        setQrSession({
          clientSecret: data.client_secret,
          paymentIntentId: data.payment_intent_id,
          qrImageUrl: qrUrl,
          amount: data.amount,
          currency: data.currency,
          expiresAt: qrDetails?.expires_at,
          method,
        });
        setAltError(null);
      } else if (method === 'alipay') {
        if (!stripe) {
          setAltError('Stripe is not ready yet. Please try again.');
          return;
        }
        try {
          const returnUrl = new URL(window.location.pathname, window.location.origin);
          returnUrl.searchParams.set('payment', 'alipay');
          returnUrl.searchParams.set('status', 'success');
          const { error } = await stripe.confirmAlipayPayment(data.client_secret, {
            return_url: returnUrl.toString(),
          });
          if (error) {
            setAltError(error.message || 'Alipay confirmation failed.');
          }
        } catch (err: any) {
          setAltError(err?.message || 'Unable to redirect to Alipay.');
        }
      }
    },
    onError: (error: any) => {
      setAltError(error?.message || 'Unable to start payment. Please try again.');
    },
    onSettled: () => {
      setIsAltProcessing(false);
    },
  });

  useEffect(() => {
    if (selectedMethod !== 'wechat_pay') {
      setQrSession(null);
    }
  }, [selectedMethod]);

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setAltError(null);
    if (method !== 'wechat_pay') {
      setQrSession(null);
    }
  };

  const handleQrSuccess = () => {
    setQrSession(null);
    onSuccess();
  };

  const handleStartAlternativePayment = () => {
    if (isAltProcessing) {
      return;
    }
    setAltError(null);
    setIsAltProcessing(true);
    createAlternativePayment.mutate(selectedMethod);
  };

  const showAlternativeFlow = selectedMethod !== 'card';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToPricing')}
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-white">{t('completePurchase')}</h1>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">{t('paymentMethod')}</h3>
            <PaymentMethodSelector selected={selectedMethod} onSelect={handleMethodChange} />
          </div>

          {showAlternativeFlow ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">
                  {selectedMethod === 'wechat_pay' ? 'WeChat Pay' : 'Alipay'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMethod === 'wechat_pay' && qrSession ? (
                  <QRCodePayment
                    clientSecret={qrSession.clientSecret}
                    paymentIntentId={qrSession.paymentIntentId}
                    qrImageUrl={qrSession.qrImageUrl}
                    amount={qrSession.amount}
                    currency={qrSession.currency}
                    expiresAt={qrSession.expiresAt}
                    method={qrSession.method}
                    onSuccess={handleQrSuccess}
                    onExpired={() => {
                      setQrSession(null);
                      handleStartAlternativePayment();
                    }}
                  />
                ) : (
                  <div className="space-y-4 text-gray-300">
                    <p>
                      {selectedMethod === 'wechat_pay'
                        ? 'Generate a QR code and scan it with your WeChat app to complete the payment.'
                        : 'You will be redirected to Alipay to confirm and complete your purchase.'}
                    </p>

                    {selectedMethod === 'alipay' && (
                      <div className="rounded-lg bg-gray-700/60 p-3 text-sm text-gray-300">
                        <p className="font-medium text-white mb-1">What to expect</p>
                        <p>• A new tab or window will open with the Stripe Alipay simulator.</p>
                        <p>• Follow the prompts to approve the payment.</p>
                        <p>• You will be brought back here automatically after completing the approval.</p>
                      </div>
                    )}

                    <Button
                      type="button"
                      disabled={isAltProcessing}
                      onClick={handleStartAlternativePayment}
                      className="w-full bg-brand-accent text-black hover:bg-brand-accent/90"
                    >
                      {isAltProcessing ? (
                        <span className="flex items-center justify-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('processing')}...
                        </span>
                      ) : (
                        selectedMethod === 'wechat_pay' ? 'Generate QR Code' : 'Continue to Alipay'
                      )}
                    </Button>

                    <p className="text-xs text-gray-500">
                      Payment Intent will be created under your account: {tierData.tokens} tokens purchase.
                    </p>
                  </div>
                )}

                {altError && (
                  <Alert variant="destructive">
                    <AlertDescription>{altError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <CardPaymentForm selectedTier={selectedTier} tierData={tierData} onSuccess={onSuccess} />
          )}
        </div>

        <OrderSummary tierData={tierData} method={selectedMethod} />
      </div>
    </div>
  );
};

const PaymentPage: React.FC = () => {
  const { navigateToPath, navigateToHome } = useNavigation();
  const { t } = useLanguage();
  const [selectedTier, setSelectedTier] = useState<string>('standard');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentMethodParam = params.get('payment');
    const statusParam = params.get('status');

    if (paymentMethodParam === 'alipay' && statusParam === 'success') {
      setPaymentSuccess(true);
      setShowPaymentForm(false);
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });

      params.delete('payment');
      params.delete('status');
      const newQuery = params.toString();
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!paymentSuccess) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 6; // Refresh for ~30 seconds after success
    let intervalId: number | null = null;

    const refreshBalance = () => {
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      attempts += 1;
      if (attempts >= maxAttempts && intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    refreshBalance();
    intervalId = window.setInterval(refreshBalance, 5000);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [paymentSuccess, queryClient]);

  const { 
    data: pricingTiers, 
    isLoading: tiersLoading 
  } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: fetchPricingTiers,
  });

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setShowPaymentForm(false);
    // Refetch token balance
    queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
  };

  const handleBuyMoreTokens = () => {
    setPaymentSuccess(false);
    setShowPaymentForm(false);
  };

  // Back function for sub-pages only
  const handleBackToProfile = () => {
    navigateToPath('/profile');
  };

  if (paymentSuccess) {
    return (
      <GlobalLayout>
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-2xl">
          <Card className="text-center bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="mx-auto w-16 h-16 bg-brand-secondary/20 border-2 border-brand-secondary rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-brand-secondary" />
              </div>
              <h2 className="text-2xl font-bold text-brand-secondary mb-2">{t('paymentSuccessful')}</h2>
              <p className="text-gray-400 mb-6">
                {t('tokensAddedToAccount')}
              </p>
              <div className="mb-6">
                <ImprovedTokenBalance
                  showTitle={false}
                  compact={false}
                  showStats={false}
                  onPurchaseClick={handleBuyMoreTokens}
                />
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={navigateToHome} size="lg" className="bg-brand-accent hover:bg-indigo-500 rounded-2xl shadow-surface">
                  {t('startChatting')}
                </Button>
                <Button onClick={handleBackToProfile} variant="outline" size="lg" className="bg-secondary border-secondary hover:bg-secondary/80 text-white rounded-2xl">
                  {t('backToProfile')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </GlobalLayout>
    );
  }

  if (showPaymentForm && pricingTiers && selectedTier) {
    return (
      <GlobalLayout>
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
          <Elements stripe={stripePromise}>
            <PaymentCheckout
              selectedTier={selectedTier}
              tierData={pricingTiers[selectedTier]}
              onSuccess={handlePaymentSuccess}
              onBack={() => setShowPaymentForm(false)}
            />
          </Elements>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-white">{t('buyTokens')}</h1>
          <p className="text-gray-400">
            {t('purchaseTokensToContinue')}
          </p>
        </div>

        <div className="mb-6">
          <ImprovedTokenBalance showTitle={true} compact={false} showStats={true} showActions={false} />
        </div>

        <Separator className="my-6" />

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-white">{t('chooseTokenPackage')}</h2>
          
          {tiersLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded mb-4"></div>
                    <div className="h-8 bg-gray-700 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pricingTiers && Object.entries(pricingTiers).map(([tierKey, tier]) => {
                const isPopular = tierKey === 'standard';
                const valuePerToken = tier.price / tier.tokens / 100;
                
                return (
                  <Card 
                    key={tierKey}
                    className={`relative cursor-pointer transition-all hover:shadow-lg bg-gray-800 border-gray-700 hover:border-gray-600 ${
                      selectedTier === tierKey ? 'ring-2 ring-blue-500 border-blue-500' : ''
                    } ${isPopular ? 'border-blue-500' : ''}`}
                    onClick={() => setSelectedTier(tierKey)}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-brand-accent text-white flex items-center gap-1 shadow-surface">
                          <Star className="h-3 w-3" />
                          {t('mostPopular')}
                        </Badge>
                      </div>
                    )}
                    
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="font-bold text-lg capitalize mb-2 text-white">
                          {tierKey} {t('pack')}
                        </h3>
                        <div className="mb-4">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Coins className="h-5 w-5 text-yellow-400" />
                            <span className="text-2xl font-bold text-white">{tier.tokens}</span>
                            <span className="text-gray-400">{t('tokensPlural')}</span>
                          </div>
                          <div className="text-3xl font-bold text-brand-secondary">
                            ${(tier.price / 100).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-400">
                            ${valuePerToken.toFixed(3)} {t('perToken')}
                          </div>
                        </div>
                        
                        {tierKey !== 'starter' && (
                          <div className="mb-4">
                            <Badge variant="secondary" className="text-xs">
                              {tierKey === 'standard' ? t('bonusPercent25') : t('bonusPercent50')}
                            </Badge>
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-400 mb-4">
                          ≈ {tier.tokens} {t('aiConversations')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={() => setShowPaymentForm(true)}
            disabled={!selectedTier || tiersLoading}
            className="bg-gradient-premium text-zinc-900 rounded-2xl font-semibold tracking-wide shadow-premium hover:shadow-glow transition-all duration-200"
          >
            {t('continueToPayment')}
          </Button>
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-2 text-white">{t('tokenUsage')}</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• {t('eachAIMessage')}</li>
            <li>• {t('tokensNeverExpireItem')}</li>
            <li>• {t('securePaymentsStripe')}</li>
            <li>• {t('instantDelivery')}</li>
          </ul>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default PaymentPage;
