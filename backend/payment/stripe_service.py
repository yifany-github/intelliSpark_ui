import stripe
from typing import Optional, Dict, Any, List
import logging
from payment.token_service import get_pricing_tier
from utils.exchange_rates import convert_usd_cents_to_cny_fen
from config import settings

logger = logging.getLogger(__name__)

# Configure Stripe API key
stripe.api_key = settings.stripe_secret_key

class StripeService:
    def __init__(self):
        self.webhook_secret = settings.stripe_webhook_secret
        
    def create_payment_intent(
        self,
        user_id: int,
        tier: str,
        payment_method_type: str = "card",
        return_url: Optional[str] = None,
        customer_id: Optional[str] = None,
        save_payment_method: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Create a Stripe payment intent for token purchase"""
        try:
            pricing_info = get_pricing_tier(tier)
            if not pricing_info:
                logger.error(f"Invalid pricing tier: {tier}")
                return None

            supported_methods = {"card", "wechat_pay", "alipay"}
            if payment_method_type not in supported_methods:
                logger.error(f"Unsupported payment method type: {payment_method_type}")
                return None

            metadata = {
                "user_id": str(user_id),
                "tier": tier,
                "tokens": str(pricing_info["tokens"]),
                "type": "token_purchase",
                "payment_method": payment_method_type,
            }

            if return_url:
                metadata["return_url"] = return_url

            if customer_id:
                metadata["stripe_customer_id"] = customer_id

            # Determine amount/currency based on payment method
            amount = pricing_info["price"]
            currency = "usd"
            payment_method_options: Dict[str, Any] = {}

            if payment_method_type == "wechat_pay":
                currency = "cny"
                amount = pricing_info.get("price_cny", pricing_info["price"])
                payment_method_options["wechat_pay"] = {"client": "web"}
                metadata["fx_rate_usd_cny"] = str(pricing_info["fx_rate"])
                metadata["usd_amount_cents"] = str(pricing_info["price"])
            elif payment_method_type == "alipay":
                currency = "cny"
                amount, fx_rate = convert_usd_cents_to_cny_fen(pricing_info["price"])
                payment_method_options["alipay"] = {}
                metadata["fx_rate_usd_cny"] = str(fx_rate)
                metadata["usd_amount_cents"] = str(pricing_info["price"])

            # Create payment intent
            intent_kwargs = {
                "amount": amount,
                "currency": currency,
                "payment_method_types": [payment_method_type],
                "payment_method_options": payment_method_options or None,
                "metadata": metadata,
                "description": f"Token purchase - {pricing_info['description']}",
            }

            if customer_id:
                intent_kwargs["customer"] = customer_id

            if payment_method_type == "card" and save_payment_method and customer_id:
                intent_kwargs["setup_future_usage"] = "off_session"

            intent = stripe.PaymentIntent.create(**intent_kwargs)

            if payment_method_type == "wechat_pay":
                intent = stripe.PaymentIntent.confirm(
                    intent.id,
                    payment_method_data={"type": "wechat_pay"},
                    payment_method_options={"wechat_pay": {"client": "web"}}
                )

            next_action = None
            if getattr(intent, "next_action", None):
                try:
                    next_action = intent.next_action.to_dict_recursive()
                except AttributeError:
                    next_action = dict(intent.next_action)

            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": amount,
                "tokens": pricing_info["tokens"],
                "currency": currency,
                "payment_method": payment_method_type,
                "next_action": next_action,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating payment intent: {str(e)}")
            return None

    def create_customer(self, *, email: Optional[str], name: Optional[str]) -> Optional[str]:
        try:
            customer = stripe.Customer.create(
                email=email or None,
                name=name or None,
            )
            return customer.id
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating customer: {str(e)}")
            return None

    def list_saved_payment_methods(self, customer_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
            result = []
            for pm in methods.data:
                card = getattr(pm, "card", None)
                if not card:
                    continue
                result.append({
                    "id": pm.id,
                    "brand": card.brand,
                    "last4": card.last4,
                    "exp_month": card.exp_month,
                    "exp_year": card.exp_year,
                    "is_default": False,
                })
            return result
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error listing payment methods: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error listing payment methods: {str(e)}")
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
                "amount": payment_intent.get("amount"),
                "amount_cents": payment_intent.get("amount"),
                "currency": payment_intent.get("currency"),
                "payment_method": metadata.get("payment_method", "card"),
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
