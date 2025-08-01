import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Coins, CreditCard, Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Separator } from '../../components/ui/separator';
import { useLocation } from 'wouter';
import { ImprovedTokenBalance } from '../../components/payment/ImprovedTokenBalance';
import GlobalLayout from '../../components/layout/GlobalLayout';
import { useLanguage } from '../../contexts/LanguageContext';

// Initialize Stripe (you'll need to set your publishable key in environment variables)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

interface PricingTier {
  tokens: number;
  price: number;
  description: string;
}

interface PricingTiers {
  [key: string]: PricingTier;
}

const fetchPricingTiers = async (): Promise<PricingTiers> => {
  const response = await fetch('http://localhost:8000/api/payment/pricing-tiers');
  if (!response.ok) {
    throw new Error('Failed to fetch pricing tiers');
  }
  return response.json();
};

const createPaymentIntent = async (tier: string) => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch('http://localhost:8000/api/payment/create-payment-intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tier, amount: 0 }), // amount is determined by backend
  });

  if (!response.ok) {
    throw new Error('Failed to create payment intent');
  }

  return response.json();
};

const PaymentForm: React.FC<{ 
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
    mutationFn: createPaymentIntent,
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
          <CreditCard className="h-5 w-5 text-blue-400" />
          {t('paymentDetails')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
          <div className="flex justify-between items-center">
            <span className="font-medium text-white">{tierData.description}</span>
            <span className="font-bold text-lg text-green-400">${(tierData.price / 100).toFixed(2)}</span>
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
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
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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

          {/* Order Summary */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{t('orderSummary')}</h3>
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">{tierData.description}</span>
                <span className="text-white font-semibold">${(tierData.price / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
                <span>{tierData.tokens} {t('tokensPlural')}</span>
                <span>${((tierData.price / 100) / tierData.tokens).toFixed(3)} {t('perToken')}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 mt-2">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-white">{t('total')}</span>
                  <span className="text-green-400 text-lg">${(tierData.price / 100).toFixed(2)} {t('usd')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-2">
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                required
                className="mt-1 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-300">
                {t('agreeToTerms')}{' '}
                <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                  {t('termsOfService')}
                </a>{' '}
                {t('and')}{' '}
                <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                  {t('privacyPolicy')}
                </a>
              </span>
            </label>
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                className="mt-1 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2"
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl"
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

const PaymentPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [selectedTier, setSelectedTier] = useState<string>('standard');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const queryClient = useQueryClient();

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

  // Back function for sub-pages only
  const handleBackToProfile = () => {
    setLocation('/profile');
  };

  if (paymentSuccess) {
    return (
      <GlobalLayout>
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-2xl">
          <Card className="text-center bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="mx-auto w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">{t('paymentSuccessful')}</h2>
              <p className="text-gray-400 mb-6">
                {t('tokensAddedToAccount')}
              </p>
              <div className="mb-6">
                <ImprovedTokenBalance showTitle={false} compact={false} showStats={false} />
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setLocation('/chats')} size="lg" className="bg-blue-600 hover:bg-blue-700 rounded-2xl">
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
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-2xl">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowPaymentForm(false)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('backToPricing')}
            </Button>
            <h1 className="text-3xl font-bold text-white">{t('completePurchase')}</h1>
          </div>

          <Elements stripe={stripePromise}>
            <PaymentForm 
              selectedTier={selectedTier}
              tierData={pricingTiers[selectedTier]}
              onSuccess={handlePaymentSuccess}
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
                        <Badge className="bg-blue-500 text-white flex items-center gap-1">
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
                          <div className="text-3xl font-bold text-blue-400">
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
            className="bg-blue-600 hover:bg-blue-700 rounded-2xl"
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