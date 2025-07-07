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
import { TokenBalance } from '../../components/payment/TokenBalance';

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
  const token = localStorage.getItem('token');
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">{tierData.description}</span>
            <span className="font-bold text-lg">${(tierData.price / 100).toFixed(2)}</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {tierData.tokens} tokens • ${((tierData.price / 100) / tierData.tokens).toFixed(3)} per token
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 border rounded-lg">
            <CardElement options={cardElementOptions} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            disabled={!stripe || isProcessing} 
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              'Processing...'
            ) : (
              `Pay $${(tierData.price / 100).toFixed(2)}`
            )}
          </Button>

          <div className="text-xs text-gray-500 text-center">
            Payments are processed securely by Stripe. Your card information is never stored on our servers.
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const PaymentPage: React.FC = () => {
  const [, setLocation] = useLocation();
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

  const handleBack = () => {
    setLocation('/profile');
  };

  if (paymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your tokens have been added to your account. You can now continue chatting with AI characters.
            </p>
            <div className="mb-6">
              <TokenBalance showTitle={false} />
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setLocation('/chats')} size="lg">
                Start Chatting
              </Button>
              <Button onClick={handleBack} variant="outline" size="lg">
                Back to Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showPaymentForm && pricingTiers && selectedTier) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setShowPaymentForm(false)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pricing
          </Button>
          <h1 className="text-3xl font-bold">Complete Purchase</h1>
        </div>

        <Elements stripe={stripePromise}>
          <PaymentForm 
            selectedTier={selectedTier}
            tierData={pricingTiers[selectedTier]}
            onSuccess={handlePaymentSuccess}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">Buy Tokens</h1>
        <p className="text-gray-600">
          Purchase tokens to continue chatting with AI characters. Each message costs 1 token.
        </p>
      </div>

      <div className="mb-6">
        <TokenBalance />
      </div>

      <Separator className="my-6" />

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Choose a Token Package</h2>
        
        {tiersLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {pricingTiers && Object.entries(pricingTiers).map(([tierKey, tier]) => {
              const isPopular = tierKey === 'standard';
              const valuePerToken = tier.price / tier.tokens / 100;
              
              return (
                <Card 
                  key={tierKey}
                  className={`relative cursor-pointer transition-all hover:shadow-lg ${
                    selectedTier === tierKey ? 'ring-2 ring-blue-500' : ''
                  } ${isPopular ? 'border-blue-500' : ''}`}
                  onClick={() => setSelectedTier(tierKey)}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500 text-white flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardContent className="p-6">
                    <div className="text-center">
                      <h3 className="font-bold text-lg capitalize mb-2">
                        {tierKey} Pack
                      </h3>
                      <div className="mb-4">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Coins className="h-5 w-5 text-yellow-600" />
                          <span className="text-2xl font-bold">{tier.tokens}</span>
                          <span className="text-gray-500">tokens</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-600">
                          ${(tier.price / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${valuePerToken.toFixed(3)} per token
                        </div>
                      </div>
                      
                      {tierKey !== 'starter' && (
                        <div className="mb-4">
                          <Badge variant="secondary" className="text-xs">
                            {tierKey === 'standard' ? '25% bonus' : '50% bonus'}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-600 mb-4">
                        ≈ {tier.tokens} AI conversations
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
        >
          Continue to Payment
        </Button>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Token Usage</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Each AI message generation costs 1 token</li>
          <li>• Tokens never expire</li>
          <li>• Secure payments processed by Stripe</li>
          <li>• Instant delivery to your account</li>
        </ul>
      </div>
    </div>
  );
};

export default PaymentPage;