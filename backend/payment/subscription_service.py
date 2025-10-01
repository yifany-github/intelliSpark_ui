"""
Subscription Service - Manages premium subscription lifecycle and token allocation
"""

from sqlalchemy.orm import Session
from models import PremiumSubscription, User
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import logging
import os

logger = logging.getLogger(__name__)

# Subscription plan configuration
SUBSCRIPTION_PLANS = {
    "basic": {
        "name": "Basic Plan",
        "monthly_tokens": 200,
        "price": 800,  # $8.00 in cents (USD)
        "description": "200 tokens per month - Perfect for casual users",
        "stripe_price_id": os.getenv("STRIPE_PRICE_BASIC"),
    },
    "pro": {
        "name": "Pro Plan",
        "monthly_tokens": 600,
        "price": 1800,  # $18.00 in cents (25% discount vs one-time)
        "description": "600 tokens per month - Best for regular users",
        "stripe_price_id": os.getenv("STRIPE_PRICE_PRO"),
    },
    "premium": {
        "name": "Premium Plan",
        "monthly_tokens": 2000,
        "price": 4500,  # $45.00 in cents (33% discount vs one-time)
        "description": "2000 tokens per month - For power users",
        "stripe_price_id": os.getenv("STRIPE_PRICE_PREMIUM"),
    },
}

# Token expiration period (2 months from allocation)
TOKEN_EXPIRATION_MONTHS = 2


class SubscriptionService:
    def __init__(self, db: Session):
        self.db = db

    def get_subscription_plan(self, tier: str) -> Optional[Dict]:
        """Get subscription plan configuration"""
        return SUBSCRIPTION_PLANS.get(tier.lower())

    def get_all_plans(self) -> Dict:
        """Get all subscription plans"""
        return SUBSCRIPTION_PLANS

    def get_user_subscription(self, user_id: int) -> Optional[PremiumSubscription]:
        """Get active subscription for a user"""
        return self.db.query(PremiumSubscription).filter(
            PremiumSubscription.user_id == user_id,
            PremiumSubscription.status.in_(['active', 'trialing'])
        ).first()

    def create_subscription(
        self,
        user_id: int,
        stripe_subscription_id: str,
        stripe_customer_id: str,
        plan_tier: str,
        status: str,
        current_period_start: datetime,
        current_period_end: datetime,
    ) -> Optional[PremiumSubscription]:
        """Create a new subscription record"""
        try:
            plan = self.get_subscription_plan(plan_tier)
            if not plan:
                logger.error(f"Invalid plan tier: {plan_tier}")
                return None

            # Check if subscription already exists
            existing = self.db.query(PremiumSubscription).filter(
                PremiumSubscription.stripe_subscription_id == stripe_subscription_id
            ).first()

            if existing:
                logger.warning(f"Subscription {stripe_subscription_id} already exists")
                return existing

            subscription = PremiumSubscription(
                user_id=user_id,
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=stripe_customer_id,
                plan_tier=plan_tier,
                status=status,
                current_period_start=current_period_start,
                current_period_end=current_period_end,
                monthly_token_allowance=plan["monthly_tokens"],
                tokens_allocated_this_period=0,
            )

            self.db.add(subscription)

            # Update user premium status
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_premium_member = True

            self.db.commit()
            self.db.refresh(subscription)

            logger.info(f"Created subscription {stripe_subscription_id} for user {user_id}")
            return subscription

        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            self.db.rollback()
            return None

    def update_subscription_status(
        self,
        stripe_subscription_id: str,
        status: str,
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
    ) -> bool:
        """Update subscription status and billing period"""
        try:
            subscription = self.db.query(PremiumSubscription).filter(
                PremiumSubscription.stripe_subscription_id == stripe_subscription_id
            ).first()

            if not subscription:
                logger.error(f"Subscription {stripe_subscription_id} not found")
                return False

            subscription.status = status

            if current_period_start:
                subscription.current_period_start = current_period_start
            if current_period_end:
                subscription.current_period_end = current_period_end

            # Update user premium status
            user = self.db.query(User).filter(User.id == subscription.user_id).first()
            if user:
                user.is_premium_member = (status in ['active', 'trialing'])

            self.db.commit()
            logger.info(f"Updated subscription {stripe_subscription_id} status to {status}")
            return True

        except Exception as e:
            logger.error(f"Error updating subscription status: {str(e)}")
            self.db.rollback()
            return False

    def cancel_subscription(self, stripe_subscription_id: str, cancel_at_period_end: bool = True) -> bool:
        """Mark subscription for cancellation"""
        try:
            subscription = self.db.query(PremiumSubscription).filter(
                PremiumSubscription.stripe_subscription_id == stripe_subscription_id
            ).first()

            if not subscription:
                logger.error(f"Subscription {stripe_subscription_id} not found")
                return False

            subscription.cancel_at_period_end = cancel_at_period_end

            if not cancel_at_period_end:
                # Immediate cancellation
                subscription.status = 'canceled'
                user = self.db.query(User).filter(User.id == subscription.user_id).first()
                if user:
                    user.is_premium_member = False

            self.db.commit()
            logger.info(f"Canceled subscription {stripe_subscription_id} (at_period_end={cancel_at_period_end})")
            return True

        except Exception as e:
            logger.error(f"Error canceling subscription: {str(e)}")
            self.db.rollback()
            return False

    def should_allocate_tokens(self, subscription: PremiumSubscription) -> bool:
        """
        Check if tokens should be allocated for this subscription.
        Tokens are allocated once per billing period.
        """
        if subscription.status not in ['active', 'trialing']:
            return False

        # Check if we're in a new billing period
        now = datetime.now(timezone.utc)

        # If never allocated, allocate now
        if not subscription.last_token_allocation_date:
            return True

        # If last allocation was before current period start, allocate again
        if subscription.last_token_allocation_date < subscription.current_period_start:
            return True

        return False

    def mark_tokens_allocated(self, subscription_id: int, amount: int) -> bool:
        """Mark tokens as allocated for this billing period"""
        try:
            subscription = self.db.query(PremiumSubscription).filter(
                PremiumSubscription.id == subscription_id
            ).first()

            if not subscription:
                return False

            subscription.tokens_allocated_this_period = amount
            subscription.last_token_allocation_date = datetime.now(timezone.utc)

            self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Error marking tokens allocated: {str(e)}")
            self.db.rollback()
            return False

    def reset_period_allocation(self, subscription_id: int) -> bool:
        """Reset token allocation counter for new billing period"""
        try:
            subscription = self.db.query(PremiumSubscription).filter(
                PremiumSubscription.id == subscription_id
            ).first()

            if not subscription:
                return False

            subscription.tokens_allocated_this_period = 0

            self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Error resetting period allocation: {str(e)}")
            self.db.rollback()
            return False


def get_token_expiration_date() -> datetime:
    """Calculate token expiration date (2 months from now)"""
    return datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRATION_MONTHS * 30)


def get_all_subscription_plans() -> Dict:
    """Get all available subscription plans"""
    from utils.exchange_rates import convert_usd_cents_to_cny_fen

    plans = {}
    for tier, config in SUBSCRIPTION_PLANS.items():
        plan = config.copy()
        # Add CNY conversion
        converted_fen, rate = convert_usd_cents_to_cny_fen(plan["price"])
        plan["price_cny"] = converted_fen
        plan["fx_rate"] = float(rate)
        plans[tier] = plan

    return plans
