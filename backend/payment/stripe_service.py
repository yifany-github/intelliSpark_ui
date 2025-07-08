import stripe
import os
from typing import Optional, Dict, Any
import logging
from payment.token_service import get_pricing_tier
from config import settings

logger = logging.getLogger(__name__)

# Configure Stripe API key
stripe.api_key = settings.stripe_secret_key

class StripeService:
    def __init__(self):
        self.webhook_secret = settings.stripe_webhook_secret
        
    def create_payment_intent(self, user_id: int, tier: str) -> Optional[Dict[str, Any]]:
        """Create a Stripe payment intent for token purchase"""
        try:
            pricing_info = get_pricing_tier(tier)
            if not pricing_info:
                logger.error(f"Invalid pricing tier: {tier}")
                return None
            
            # Create payment intent
            intent = stripe.PaymentIntent.create(
                amount=pricing_info["price"],  # Amount in cents
                currency="usd",
                metadata={
                    "user_id": str(user_id),
                    "tier": tier,
                    "tokens": str(pricing_info["tokens"]),
                    "type": "token_purchase"
                },
                description=f"Token purchase - {pricing_info['description']}"
            )
            
            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": pricing_info["price"],
                "tokens": pricing_info["tokens"]
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating payment intent: {str(e)}")
            return None
    
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """Verify Stripe webhook signature"""
        try:
            stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return True
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid webhook signature")
            return False
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {str(e)}")
            return False
    
    def handle_payment_success(self, payment_intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle successful payment from webhook"""
        try:
            metadata = payment_intent.get("metadata", {})
            return {
                "user_id": int(metadata.get("user_id")),
                "tokens": int(metadata.get("tokens")),
                "tier": metadata.get("tier"),
                "payment_intent_id": payment_intent.get("id"),
                "amount": payment_intent.get("amount")
            }
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Error parsing payment intent metadata: {str(e)}")
            return None
    
    def refund_payment(self, payment_intent_id: str, amount: Optional[int] = None) -> bool:
        """Refund a payment"""
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                amount=amount  # If None, refunds full amount
            )
            return refund.status == "succeeded"
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating refund: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error creating refund: {str(e)}")
            return False
    
    def get_payment_intent(self, payment_intent_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve payment intent details"""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                "id": intent.id,
                "status": intent.status,
                "amount": intent.amount,
                "currency": intent.currency,
                "metadata": intent.metadata
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error retrieving payment intent: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving payment intent: {str(e)}")
            return None