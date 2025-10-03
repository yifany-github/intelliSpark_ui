export type PaymentMethod = 'card' | 'wechat_pay' | 'alipay';

export interface SavedPaymentMethodSummary {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
}

// Subscription types
export type SubscriptionTier = 'basic' | 'pro' | 'premium';

export interface SubscriptionPlan {
  name: string;
  monthly_tokens: number;
  price: number;
  price_cny?: number;
  fx_rate?: number;
  description: string;
  stripe_price_id?: string;
}

export interface SubscriptionPlans {
  basic: SubscriptionPlan;
  pro: SubscriptionPlan;
  premium: SubscriptionPlan;
}

export interface SubscriptionInfo {
  id: number;
  plan_tier: SubscriptionTier;
  status: string;
  monthly_token_allowance: number;
  tokens_allocated_this_period: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface UserSubscriptionResponse {
  has_subscription: boolean;
  subscription?: SubscriptionInfo;
}

export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  price_id: string;
}

export interface CreateSubscriptionResponse {
  client_secret?: string;
  subscription_id: string;
  status: string;
}
