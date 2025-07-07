from sqlalchemy.orm import Session
from backend.models import UserToken, TokenTransaction, User
from backend.database import get_db
from typing import Optional
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
    
    def add_tokens(self, user_id: int, amount: int, description: str = None, stripe_payment_intent_id: str = None) -> bool:
        """Add tokens to user's balance"""
        try:
            # Get or create user token record
            user_token = self.db.query(UserToken).filter(UserToken.user_id == user_id).first()
            if not user_token:
                user_token = UserToken(user_id=user_id, balance=0)
                self.db.add(user_token)
            
            # Update balance
            user_token.balance += amount
            
            # Create transaction record
            transaction = TokenTransaction(
                user_id=user_id,
                transaction_type="purchase",
                amount=amount,
                description=description or f"Purchased {amount} tokens",
                stripe_payment_intent_id=stripe_payment_intent_id
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
        """Deduct tokens from user's balance"""
        try:
            user_token = self.db.query(UserToken).filter(UserToken.user_id == user_id).first()
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

# Pricing tiers configuration
PRICING_TIERS = {
    "starter": {
        "tokens": 100,
        "price": 500,  # $5.00 in cents
        "description": "Starter Pack - 100 tokens"
    },
    "standard": {
        "tokens": 500,
        "price": 2000,  # $20.00 in cents (25% bonus)
        "description": "Standard Pack - 500 tokens"
    },
    "premium": {
        "tokens": 1500,
        "price": 5000,  # $50.00 in cents (50% bonus)
        "description": "Premium Pack - 1500 tokens"
    }
}

def get_pricing_tier(tier_name: str) -> dict:
    """Get pricing information for a specific tier"""
    return PRICING_TIERS.get(tier_name.lower())

def get_all_pricing_tiers() -> dict:
    """Get all available pricing tiers"""
    return PRICING_TIERS