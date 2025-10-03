import { CreditCard, Landmark, QrCode } from 'lucide-react';
import type { FC, ReactNode } from 'react';
import type { PaymentMethod } from '@/types/payments';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

interface MethodOption {
  key: PaymentMethod;
  title: string;
  description: string;
  badge?: string;
  icon: ReactNode;
}

const methodOptions: MethodOption[] = [
  {
    key: 'card',
    title: 'Credit / Debit Card',
    description: 'Pay securely with Visa, Mastercard, American Express, and more.',
    icon: <CreditCard className="h-5 w-5" />,
  },
  // WeChat Pay and Alipay temporarily disabled - pending provider approval
  // {
  //   key: 'wechat_pay',
  //   title: 'WeChat Pay',
  //   description: 'Scan the QR code with WeChat to complete your purchase.',
  //   badge: 'China',
  //   icon: <QrCode className="h-5 w-5" />,
  // },
  // {
  //   key: 'alipay',
  //   title: 'Alipay',
  //   description: 'Redirect to Alipay for a familiar checkout experience.',
  //   badge: 'Popular',
  //   icon: <Landmark className="h-5 w-5" />,
  // },
];

export const PaymentMethodSelector: FC<PaymentMethodSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid gap-3">
      {methodOptions.map((option) => {
        const isActive = option.key === selected;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.key)}
            className={cn(
              'flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all',
              'bg-gray-800/80 border-gray-700 hover:border-brand-accent hover:bg-gray-800',
              isActive && 'border-brand-accent ring-2 ring-brand-accent/30'
            )}
          >
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              isActive ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-300'
            )}>
              {option.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{option.title}</span>
                {option.badge && (
                  <span className="rounded-full bg-brand-accent/20 px-2 py-0.5 text-xs font-medium text-brand-accent">
                    {option.badge}
                  </span>
                )}
                {isActive && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-400">{option.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PaymentMethodSelector;
