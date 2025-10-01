from sqlalchemy.orm import Session
from models import UserToken, TokenTransaction, User
from database import get_db
from typing import Optional
from datetime import datetime, timedelta, timezone

from utils.exchange_rates import convert_usd_cents_to_cny_fen
import logging

logger = logging.getLogger(__name__)

class TokenService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_balance(self, user_id: int) -> int:
        """Get user's current token balance"""
        user_token = self.db.query(UserToken).filter(UserToken.user_id == user_id).first()
        if not user_token:
            # Create initial token balance for user
            user_token = UserToken(user_id=user_id, balance=0)
            self.db.add(user_token)
            self.db.commit()
            return 0
        return user_token.balance
    
    def add_tokens(
        self,
        user_id: int,
        amount: int,
        description: str = None,
        stripe_payment_intent_id: str = None,
        payment_method: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        subscription_id: Optional[int] = None,
        stripe_event_id: Optional[str] = None,
    ) -> bool:
        """Add tokens to user's balance (supports both one-time and subscription tokens)"""
        try:
            # Check for duplicate webhook event (idempotency)
            if stripe_event_id:
                existing = self.db.query(TokenTransaction).filter(
                    TokenTransaction.stripe_event_id == stripe_event_id
                ).first()
                if existing:
                    logger.warning(f"Duplicate webhook event detected: {stripe_event_id}. Skipping token allocation.")
                    return True  # Return success to acknowledge webhook

            # Get or create user token record
            user_token = self.db.query(UserToken).filter(UserToken.user_id == user_id).first()
            if not user_token:
                user_token = UserToken(user_id=user_id, balance=0)
                self.db.add(user_token)

            # Update balance
            user_token.balance += amount

            # Create transaction record
            details = description or f"Purchased {amount} tokens"
            if payment_method:
                details = f"{details} via {payment_method}"

            transaction_type = "subscription_allocation" if subscription_id else "purchase"

            transaction = TokenTransaction(
                user_id=user_id,
                transaction_type=transaction_type,
                amount=amount,
                description=details,
                stripe_payment_intent_id=stripe_payment_intent_id,
                expires_at=expires_at,
                subscription_id=subscription_id,
                stripe_event_id=stripe_event_id,
            )
            self.db.add(transaction)

            self.db.commit()
            logger.info(f"Added {amount} tokens to user {user_id}. New balance: {user_token.balance}")
            return True

        except Exception as e:
            logger.error(f"Error adding tokens to user {user_id}: {str(e)}")
            self.db.rollback()
            return False
    
    def deduct_tokens(self, user_id: int, amount: int, description: str = None) -> bool:
        """Deduct tokens from user's balance (wipes expired tokens first)"""
        try:
            # First, wipe any expired tokens for this user
            self._remove_expired_tokens_for_user(user_id)

            # Now check balance after expiration cleanup (with row lock for concurrency safety)
            user_token = self.db.query(UserToken).filter(
                UserToken.user_id == user_id
            ).with_for_update().first()
            if not user_token or user_token.balance < amount:
                logger.warning(f"Insufficient tokens for user {user_id}. Required: {amount}, Available: {user_token.balance if user_token else 0}")
                return False

            # Update balance
            user_token.balance -= amount

            # Create transaction record
            transaction = TokenTransaction(
                user_id=user_id,
                transaction_type="deduction",
                amount=-amount,  # Negative for deduction
                description=description or f"Deducted {amount} tokens for AI generation"
            )
            self.db.add(transaction)

            self.db.commit()
            logger.info(f"Deducted {amount} tokens from user {user_id}. New balance: {user_token.balance}")
            return True

        except Exception as e:
            logger.error(f"Error deducting tokens from user {user_id}: {str(e)}")
            self.db.rollback()
            return False

    def _remove_expired_tokens_for_user(self, user_id: int):
        """
        Remove expired subscription tokens for a specific user.
        Called automatically before token deduction.
        """
        try:
            now = datetime.now(timezone.utc)

            # Find expired transactions for this user
            expired_transactions = self.db.query(TokenTransaction).filter(
                TokenTransaction.user_id == user_id,
                TokenTransaction.expires_at.isnot(None),
                TokenTransaction.expires_at < now,
                TokenTransaction.transaction_type == 'subscription_allocation'
            ).all()

            if not expired_transactions:
                return  # No expired tokens

            # Calculate total expired amount
            total_expired = sum(t.amount for t in expired_transactions)

            # Get user's token balance
            user_token = self.db.query(UserToken).filter(UserToken.user_id == user_id).first()
            if not user_token:
                return

            # Deduct expired tokens from balance
            tokens_to_remove = min(total_expired, user_token.balance)  # Can't go negative
            if tokens_to_remove > 0:
                user_token.balance -= tokens_to_remove

                # Create expiration record
                expiration_record = TokenTransaction(
                    user_id=user_id,
                    transaction_type="expiration",
                    amount=-tokens_to_remove,
                    description=f"Expired {len(expired_transactions)} subscription token allocation(s)"
                )
                self.db.add(expiration_record)

                logger.info(f"Removed {tokens_to_remove} expired tokens from user {user_id}")

            self.db.commit()

        except Exception as e:
            logger.error(f"Error removing expired tokens for user {user_id}: {str(e)}")
            self.db.rollback()
    
    def has_sufficient_balance(self, user_id: int, required_amount: int) -> bool:
        """Check if user has sufficient token balance"""
        current_balance = self.get_user_balance(user_id)
        return current_balance >= required_amount
    
    def get_user_transactions(self, user_id: int, limit: int = 50) -> list:
        """Get user's recent token transactions"""
        transactions = self.db.query(TokenTransaction).filter(
            TokenTransaction.user_id == user_id
        ).order_by(TokenTransaction.created_at.desc()).limit(limit).all()
        return transactions

    def cleanup_expired_tokens(self) -> dict:
        """
        Clean up expired subscription tokens.
        Returns dict with cleanup statistics.
        This should be run as a scheduled job (cron/celery).
        """
        try:
            now = datetime.now(timezone.utc)

            # Find all expired token allocations
            expired_transactions = self.db.query(TokenTransaction).filter(
                TokenTransaction.expires_at.isnot(None),
                TokenTransaction.expires_at < now,
                TokenTransaction.transaction_type == 'subscription_allocation'
            ).all()

            total_expired = len(expired_transactions)
            users_affected = set()
            tokens_removed = 0

            for transaction in expired_transactions:
                # Check if this expiration was already processed by _remove_expired_tokens_for_user
                existing_expiration = self.db.query(TokenTransaction).filter(
                    TokenTransaction.user_id == transaction.user_id,
                    TokenTransaction.transaction_type == "expiration",
                    TokenTransaction.created_at > transaction.created_at
                ).first()

                if existing_expiration:
                    # Already processed, skip to prevent double-deduction
                    continue

                # Get user's current balance
                user_token = self.db.query(UserToken).filter(
                    UserToken.user_id == transaction.user_id
                ).first()

                if user_token and user_token.balance >= transaction.amount:
                    # Deduct expired tokens
                    user_token.balance -= transaction.amount
                    tokens_removed += transaction.amount
                    users_affected.add(transaction.user_id)

                    # Create deduction record
                    deduction = TokenTransaction(
                        user_id=transaction.user_id,
                        transaction_type="deduction",
                        amount=-transaction.amount,
                        description=f"Expired subscription tokens (allocated {transaction.created_at.strftime('%Y-%m-%d')})",
                    )
                    self.db.add(deduction)

                    # Mark original transaction as expired (we could add a flag if needed)
                    # For now, we just create a deduction record

            self.db.commit()

            result = {
                "expired_transactions": total_expired,
                "users_affected": len(users_affected),
                "tokens_removed": tokens_removed,
                "timestamp": now,
            }

            logger.info(f"Token cleanup completed: {result}")
            return result

        except Exception as e:
            logger.error(f"Error cleaning up expired tokens: {str(e)}")
            self.db.rollback()
            return {
                "error": str(e),
                "expired_transactions": 0,
                "users_affected": 0,
                "tokens_removed": 0,
            }

    def get_expiring_tokens_count(self, user_id: int, days_threshold: int = 7) -> dict:
        """
        Get count of tokens expiring within the threshold period.
        Useful for warning users about upcoming expiration.
        """
        try:
            threshold_date = datetime.now(timezone.utc) + timedelta(days=days_threshold)

            expiring = self.db.query(TokenTransaction).filter(
                TokenTransaction.user_id == user_id,
                TokenTransaction.expires_at.isnot(None),
                TokenTransaction.expires_at <= threshold_date,
                TokenTransaction.expires_at > datetime.utcnow(),
                TokenTransaction.transaction_type == 'subscription_allocation'
            ).all()

            total_expiring = sum(t.amount for t in expiring)

            return {
                "expiring_count": total_expiring,
                "transactions": len(expiring),
                "threshold_days": days_threshold,
            }

        except Exception as e:
            logger.error(f"Error getting expiring tokens count: {str(e)}")
            return {
                "expiring_count": 0,
                "transactions": 0,
                "error": str(e),
            }

# Pricing tiers configuration
PRICING_TIERS = {
    "starter": {
        "tokens": 100,
        "price": 500,  # $5.00 in cents (USD)
        "description": "Starter Pack - 100 tokens",
    },
    "standard": {
        "tokens": 500,
        "price": 2000,  # $20.00 in cents (25% bonus)
        "description": "Standard Pack - 500 tokens",
    },
    "premium": {
        "tokens": 1500,
        "price": 5000,  # $50.00 in cents (50% bonus)
        "description": "Premium Pack - 1500 tokens",
    },
}


def _with_conversion(tier_config: dict) -> dict:
    tier = tier_config.copy()
    converted_fen, rate = convert_usd_cents_to_cny_fen(tier["price"])
    tier["price_cny"] = converted_fen
    tier["fx_rate"] = float(rate)
    return tier


def get_pricing_tier(tier_name: str) -> dict:
    """Get pricing information for a specific tier including live CNY conversion."""
    config = PRICING_TIERS.get(tier_name.lower())
    if not config:
        return None
    return _with_conversion(config)


def get_all_pricing_tiers() -> dict:
    """Get all available pricing tiers with live CNY conversion."""
    return {name: _with_conversion(config) for name, config in PRICING_TIERS.items()}
