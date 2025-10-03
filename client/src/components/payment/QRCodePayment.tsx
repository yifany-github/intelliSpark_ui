import { useEffect, useMemo, useState, type FC } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { PaymentMethod } from '@/types/payments';
import { Loader2, RefreshCcw } from 'lucide-react';

interface QRCodePaymentProps {
  clientSecret: string;
  paymentIntentId: string;
  qrImageUrl: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  expiresAt?: number;
  onSuccess: () => void;
  onExpired?: () => void;
}

const POLL_INTERVAL = 4000;

export const QRCodePayment: FC<QRCodePaymentProps> = ({
  clientSecret,
  paymentIntentId,
  qrImageUrl,
  amount,
  currency,
  method,
  expiresAt,
  onSuccess,
  onExpired,
}) => {
  const stripe = useStripe();
  const [polling, setPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAt - now;
      setTimeLeft(remaining > 0 ? remaining : 0);
      if (remaining <= 0 && onExpired) {
        onExpired();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let isMounted = true;

    const pollStatus = async () => {
      if (!stripe) {
        return;
      }
      setPolling(true);
      setPollingError(null);

      let shouldContinue = true;

      try {
        const result = await stripe.retrievePaymentIntent(clientSecret);
        if (!isMounted) {
          return;
        }

        const paymentIntent = result.paymentIntent;
        if (paymentIntent?.status === 'succeeded') {
          onSuccess();
          shouldContinue = false;
        } else if (paymentIntent?.status === 'requires_payment_method' && onExpired) {
          onExpired();
          shouldContinue = false;
        }
      } catch (err: any) {
        if (isMounted) {
          setPollingError(err?.message || 'Unable to verify payment status.');
        }
      } finally {
        if (isMounted) {
          setPolling(false);
          if (shouldContinue) {
            timeout = setTimeout(pollStatus, POLL_INTERVAL);
          }
        }
      }
    };

    pollStatus();
    return () => {
      isMounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [stripe, clientSecret, onSuccess, onExpired]);

  const formattedAmount = useMemo(() => {
    const amountMajor = amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency?.toUpperCase() || 'USD',
    }).format(amountMajor);
  }, [amount, currency]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">
          Scan to pay with {method === 'wechat_pay' ? 'WeChat Pay' : 'Alipay'}
        </h3>
        <p className="text-sm text-gray-400">
          Use the {method === 'wechat_pay' ? 'WeChat' : 'Alipay'} app on your phone to scan the QR code and follow the prompts.
        </p>
      </div>

      <div className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-gray-700 bg-gray-800/80 p-6">
        <img src={qrImageUrl} alt="Payment QR Code" className="h-52 w-52 rounded-lg border border-gray-700 bg-white p-3" />
        <div className="text-center">
          <p className="text-sm text-gray-400">Payment amount</p>
          <p className="text-2xl font-semibold text-white">{formattedAmount}</p>
        </div>
        {typeof timeLeft === 'number' && (
          <div className="rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-300">
            QR code expires in {timeLeft}s
          </div>
        )}
      </div>

      <div className="space-y-3 text-sm text-gray-400">
        <p>• Keep this page open while you complete the payment.</p>
        <p>• After paying, the page will update automatically once the payment succeeds.</p>
        <p>• If the QR code expires, you can generate a new one.</p>
      </div>

      {polling && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for payment confirmation...
        </div>
      )}

      {pollingError && (
        <Alert variant="destructive">
          <AlertDescription>{pollingError}</AlertDescription>
        </Alert>
      )}

      {onExpired && (
        <div className="flex items-center justify-center">
          <Button
            type="button"
            onClick={onExpired}
            variant="outline"
            className="border-gray-600 text-gray-200 hover:bg-gray-700"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Generate new QR code
          </Button>
        </div>
      )}

      <p className="text-xs text-center text-gray-500">
        Payment Intent: {paymentIntentId}
      </p>
    </div>
  );
};

export default QRCodePayment;
