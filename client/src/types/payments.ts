export type PaymentMethod = 'card' | 'wechat_pay' | 'alipay';

export interface SavedPaymentMethodSummary {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
}
