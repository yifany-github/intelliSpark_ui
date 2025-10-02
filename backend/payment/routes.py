from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from database import get_db
from auth.routes import get_current_user
from models import User
from schemas import (
    TokenPurchaseRequest,
    TokenPurchaseResponse,
    UserTokenBalance,
    MessageResponse,
    SavedPaymentMethod,
)
from payment.stripe_service import StripeService
from payment.token_service import TokenService, get_all_pricing_tiers
from payment.subscription_service import SubscriptionService, get_all_subscription_plans, get_token_expiration_date
from notification_service import get_notification_service
import json
import logging
from typing import List
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment", tags=["payment"])

@router.post("/create-payment-intent", response_model=TokenPurchaseResponse)
async def create_payment_intent(
    request: TokenPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe payment intent for token purchase"""
    try:
        stripe_service = StripeService()

        customer_id = None
        if request.payment_method == "card":
            if not current_user.stripe_customer_id:
                customer_id = stripe_service.create_customer(
                    email=current_user.email,
                    name=current_user.username,
                )
                if customer_id:
                    current_user.stripe_customer_id = customer_id
                    db.add(current_user)
                    db.commit()
                    db.refresh(current_user)
            else:
                customer_id = current_user.stripe_customer_id

        payment_data = stripe_service.create_payment_intent(
            user_id=current_user.id,
            tier=request.tier,
            payment_method_type=request.payment_method,
            return_url=request.return_url,
            customer_id=customer_id,
            save_payment_method=request.save_payment_method if request.payment_method == "card" else False,
        )
        
        if not payment_data:
            raise HTTPException(
                status_code=400,
                detail="Failed to create payment intent"
            )
        
        return TokenPurchaseResponse(**payment_data)
        
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.get("/saved-payment-methods", response_model=List[SavedPaymentMethod])
async def get_saved_payment_methods(
    current_user: User = Depends(get_current_user),
):
    """Return saved card payment methods for the current user"""
    try:
        if not current_user.stripe_customer_id:
            return []

        stripe_service = StripeService()
        methods = stripe_service.list_saved_payment_methods(current_user.stripe_customer_id) or []
        return [SavedPaymentMethod(**method) for method in methods]
    except Exception as e:
        logger.error(f"Error fetching saved payment methods: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch saved payment methods")

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    try:
        payload = await request.body()
        signature = request.headers.get("stripe-signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing stripe signature")
        
        stripe_service = StripeService()
        if not stripe_service.verify_webhook_signature(payload.decode(), signature):
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse the event
        event = json.loads(payload.decode())
        event_id = event.get("id")  # Stripe's unique event ID (evt_xxxxx)
        event_type = event.get("type")

        logger.info(f"Webhook event: {event_type}")

        # Handle payment success (for one-time token purchases, not subscriptions)
        if event["type"] == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]

            # Skip if this is a subscription payment (handled by invoice.paid instead)
            if payment_intent.get("invoice"):
                logger.debug(f"Skipping payment_intent.succeeded for subscription invoice")
            else:
                payment_data = stripe_service.handle_payment_success(payment_intent)

                if payment_data:
                    # Add tokens to user account
                    token_service = TokenService(db)
                    success = token_service.add_tokens(
                        user_id=payment_data["user_id"],
                        amount=payment_data["tokens"],
                        description=f"Purchased {payment_data['tokens']} tokens ({payment_data['tier']} tier)",
                        stripe_payment_intent_id=payment_data["payment_intent_id"],
                        payment_method=payment_data.get("payment_method"),
                        stripe_event_id=event_id,
                    )

                    if success:
                        logger.info(f"Added {payment_data['tokens']} tokens to user {payment_data['user_id']} (one-time purchase)")

                        # Create payment success notification
                        try:
                            notification_service = get_notification_service(db)
                            notification_service.create_from_template(
                                template_name="payment_success",
                                user_id=payment_data["user_id"],
                                variables={
                                    "amount": (payment_data.get("amount_cents") or payment_data.get("amount", 0)) // 100,
                                    "tokens": payment_data["tokens"],
                                    "tier": payment_data["tier"],
                                    "payment_id": payment_data["payment_intent_id"],
                                    "payment_method": payment_data.get("payment_method", "card"),
                                }
                            )
                        except Exception as e:
                            logger.error(f"Failed to create payment success notification: {str(e)}")
                    else:
                        logger.error(f"Failed to add tokens to user {payment_data['user_id']}")

                        # Create payment failed notification
                        try:
                            notification_service = get_notification_service(db)
                            notification_service.create_from_template(
                                template_name="payment_failed",
                                user_id=payment_data["user_id"],
                                variables={
                                    "amount": (payment_data.get("amount_cents") or payment_data.get("amount", 0)) // 100,
                                    "tier": payment_data["tier"],
                                    "payment_id": payment_data["payment_intent_id"],
                                    "payment_method": payment_data.get("payment_method", "card"),
                                }
                            )
                        except Exception as e:
                            logger.error(f"Failed to create payment failed notification: {str(e)}")
        
        # Handle payment failure
        elif event["type"] == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            logger.warning(f"Payment failed for payment intent: {payment_intent['id']}")

            # Extract user ID from metadata if available
            if payment_intent.get("metadata") and payment_intent["metadata"].get("user_id"):
                user_id = int(payment_intent["metadata"]["user_id"])

                # Create payment failed notification
                try:
                    notification_service = get_notification_service(db)
                    notification_service.create_from_template(
                        template_name="payment_failed",
                        user_id=user_id,
                        variables={
                            "amount": payment_intent["amount"] // 100,  # Convert to dollars
                            "payment_id": payment_intent["id"],
                            "payment_method": payment_intent.get("payment_method_types", ["card"])[0],
                        }
                    )
                    logger.info(f"Created payment failed notification for user {user_id}")
                except Exception as e:
                    logger.error(f"Failed to create payment failed notification: {str(e)}")

        # Handle invoice.paid (used for subscription provisioning)
        elif event["type"] == "invoice.paid":
            invoice = event["data"]["object"]
            billing_reason = invoice.get("billing_reason")
            customer_id = invoice.get("customer")

            # Only process subscription invoices
            if billing_reason in ("subscription_create", "subscription_cycle"):
                try:
                    import stripe
                    subscription_service = SubscriptionService(db)
                    token_service = TokenService(db)

                    # List all active subscriptions for this customer
                    subscriptions = stripe.Subscription.list(customer=customer_id, status="active", limit=10)

                    if subscriptions.data:
                        # Get the most recent active subscription
                        subscription = subscriptions.data[0]
                        metadata = dict(subscription.metadata) if subscription.metadata else {}
                        user_id = metadata.get("user_id")
                        tier = metadata.get("tier")

                        if user_id and tier:
                            # Get or create subscription record in our DB
                            db_subscription = subscription_service.get_user_subscription(int(user_id))

                            if not db_subscription:
                                # Create new subscription record
                                db_subscription = subscription_service.create_subscription(
                                    user_id=int(user_id),
                                    stripe_subscription_id=subscription.id,
                                    stripe_customer_id=customer_id,
                                    plan_tier=tier,
                                    status=subscription.status,
                                    current_period_start=datetime.fromtimestamp(subscription.current_period_start),
                                    current_period_end=datetime.fromtimestamp(subscription.current_period_end),
                                )
                            else:
                                # Update tier if it changed (handles downgrades at period end)
                                if db_subscription.plan_tier != tier:
                                    from payment.subscription_service import SUBSCRIPTION_PLANS
                                    new_plan = SUBSCRIPTION_PLANS.get(tier)
                                    if new_plan:
                                        old_tier = db_subscription.plan_tier
                                        db_subscription.plan_tier = tier
                                        db_subscription.monthly_token_allowance = new_plan["monthly_tokens"]
                                        db.commit()
                                        logger.info(f"Subscription tier changed from {old_tier} to {tier} for user {user_id}")

                            # Allocate tokens if needed
                            if db_subscription and subscription_service.should_allocate_tokens(db_subscription):
                                expiration_date = get_token_expiration_date()
                                success = token_service.add_tokens(
                                    user_id=int(user_id),
                                    amount=db_subscription.monthly_token_allowance,
                                    description=f"Monthly subscription allocation ({db_subscription.plan_tier} plan)",
                                    expires_at=expiration_date,
                                    subscription_id=db_subscription.id,
                                    stripe_event_id=event_id,
                                )

                                if success:
                                    subscription_service.mark_tokens_allocated(
                                        db_subscription.id,
                                        db_subscription.monthly_token_allowance
                                    )
                                    logger.info(f"Allocated {db_subscription.monthly_token_allowance} tokens to user {user_id} from subscription")
                        else:
                            logger.warning(f"Subscription {subscription.id} missing user_id or tier in metadata")
                    else:
                        logger.warning(f"No active subscriptions found for customer {customer_id}")

                except Exception as e:
                    logger.error(f"Error processing invoice.paid: {str(e)}", exc_info=True)

        # Handle subscription invoice payment succeeded (not used - using invoice.paid instead)
        elif event["type"] == "invoice.payment_succeeded":
            # Token allocation happens in invoice.paid webhook handler above
            pass

        # Handle subscription cancellation
        elif event["type"] == "customer.subscription.deleted":
            subscription_obj = event["data"]["object"]
            subscription_service = SubscriptionService(db)
            subscription_service.update_subscription_status(
                stripe_subscription_id=subscription_obj["id"],
                status="canceled"
            )
            logger.info(f"Subscription {subscription_obj['id']} canceled")

        # Handle subscription updates
        elif event["type"] == "customer.subscription.updated":
            subscription_obj = event["data"]["object"]
            subscription_service = SubscriptionService(db)

            # Update subscription status in our database if period fields are available
            if subscription_obj.get("current_period_start") and subscription_obj.get("current_period_end"):
                subscription_service.update_subscription_status(
                    stripe_subscription_id=subscription_obj["id"],
                    status=subscription_obj["status"],
                    current_period_start=datetime.fromtimestamp(subscription_obj["current_period_start"]),
                    current_period_end=datetime.fromtimestamp(subscription_obj["current_period_end"]),
                )
                logger.info(f"Subscription {subscription_obj['id']} updated to status {subscription_obj['status']}")

        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error handling webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook handling failed")

@router.get("/user/tokens", response_model=UserTokenBalance)
async def get_user_tokens(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's token balance"""
    try:
        # Add no-cache headers to prevent stale data
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        token_service = TokenService(db)
        balance = token_service.get_user_balance(current_user.id)
        
        # Get token record for timestamps
        from models import UserToken
        user_token = db.query(UserToken).filter(UserToken.user_id == current_user.id).first()
        
        if not user_token:
            # This shouldn't happen after TokenService.get_user_balance, but just in case
            user_token = UserToken(user_id=current_user.id, balance=0)
            db.add(user_token)
            db.commit()
            db.refresh(user_token)
        
        return UserTokenBalance(
            user_id=current_user.id,
            balance=balance,
            created_at=user_token.created_at,
            updated_at=user_token.updated_at
        )
        
    except Exception as e:
        logger.error(f"Error getting user tokens: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get token balance"
        )

@router.get("/pricing-tiers")
async def get_pricing_tiers():
    """Get all available pricing tiers"""
    try:
        return get_all_pricing_tiers()
    except Exception as e:
        logger.error(f"Error getting pricing tiers: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get pricing tiers"
        )

@router.get("/user/transactions")
async def get_user_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's token transaction history"""
    try:
        token_service = TokenService(db)
        transactions = token_service.get_user_transactions(current_user.id)

        return [
            {
                "id": t.id,
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "description": t.description,
                "created_at": t.created_at,
                "stripe_payment_intent_id": t.stripe_payment_intent_id,
                "expires_at": t.expires_at,
            }
            for t in transactions
        ]

    except Exception as e:
        logger.error(f"Error getting user transactions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get transaction history"
        )


# ============ Subscription Endpoints ============

@router.get("/subscription-plans")
async def get_subscription_plans():
    """Get all available subscription plans"""
    try:
        return get_all_subscription_plans()
    except Exception as e:
        logger.error(f"Error getting subscription plans: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get subscription plans"
        )


@router.post("/create-subscription")
async def create_subscription(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        tier = request.get("tier")
        price_id = request.get("price_id")  # Stripe Price ID from frontend

        if not tier or not price_id:
            raise HTTPException(status_code=400, detail="Missing tier or price_id")

        stripe_service = StripeService()
        subscription_service = SubscriptionService(db)

        # Get or create Stripe customer
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer_id = stripe_service.create_customer(
                email=current_user.email,
                name=current_user.username,
            )
            if not customer_id:
                raise HTTPException(status_code=500, detail="Failed to create customer")

            current_user.stripe_customer_id = customer_id
            db.add(current_user)
            db.commit()

        # Create subscription
        subscription_data = stripe_service.create_subscription(
            customer_id=customer_id,
            price_id=price_id,
            user_id=current_user.id,
            tier=tier,
        )

        if not subscription_data:
            raise HTTPException(status_code=500, detail="Failed to create subscription")

        return {
            "client_secret": subscription_data["client_secret"],
            "subscription_id": subscription_data["subscription_id"],
            "status": subscription_data["status"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")


@router.get("/user/subscription")
async def get_user_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's subscription status"""
    try:
        subscription_service = SubscriptionService(db)
        subscription = subscription_service.get_user_subscription(current_user.id)

        if not subscription:
            return {"has_subscription": False}

        return {
            "has_subscription": True,
            "subscription": {
                "id": subscription.id,
                "plan_tier": subscription.plan_tier,
                "status": subscription.status,
                "monthly_token_allowance": subscription.monthly_token_allowance,
                "tokens_allocated_this_period": subscription.tokens_allocated_this_period,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
            }
        }

    except Exception as e:
        logger.error(f"Error getting user subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get subscription")


@router.post("/update-subscription")
async def update_subscription(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's subscription to a different plan (upgrade/downgrade)"""
    try:
        new_tier = request.get("tier")
        new_price_id = request.get("price_id")

        if not new_tier or not new_price_id:
            raise HTTPException(status_code=400, detail="Missing tier or price_id")

        subscription_service = SubscriptionService(db)
        subscription = subscription_service.get_user_subscription(current_user.id)

        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")

        # Get plan configs to compare tiers
        from payment.subscription_service import SUBSCRIPTION_PLANS
        old_plan = SUBSCRIPTION_PLANS.get(subscription.plan_tier)
        new_plan = SUBSCRIPTION_PLANS.get(new_tier)

        if not old_plan or not new_plan:
            raise HTTPException(status_code=400, detail="Invalid plan tier")

        # Determine if this is an upgrade or downgrade
        is_upgrade = new_plan["price"] > old_plan["price"]

        stripe_service = StripeService()

        if is_upgrade:
            # UPGRADE: Immediate change with proration
            result = stripe_service.update_subscription(
                subscription_id=subscription.stripe_subscription_id,
                new_price_id=new_price_id,
                new_tier=new_tier,
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to update subscription in Stripe")

            # Update our DB immediately
            subscription.plan_tier = new_tier
            subscription.monthly_token_allowance = new_plan["monthly_tokens"]
            db.commit()

            # Allocate new tier tokens immediately
            token_service = TokenService(db)
            expiration_date = get_token_expiration_date()

            # Reset allocation counter since we're giving new tier tokens
            subscription_service.reset_period_allocation(subscription.id)

            token_service.add_tokens(
                user_id=current_user.id,
                amount=new_plan["monthly_tokens"],
                description=f"Upgraded to {new_tier} plan - immediate token allocation",
                expires_at=expiration_date,
                subscription_id=subscription.id,
            )

            subscription_service.mark_tokens_allocated(subscription.id, new_plan["monthly_tokens"])

            logger.info(f"User {current_user.id} upgraded from {old_plan['name']} to {new_plan['name']}")

            return {
                "status": "success",
                "message": f"Upgraded to {new_plan['name']}",
                "immediate": True,
                "tokens_allocated": new_plan["monthly_tokens"]
            }

        else:
            # DOWNGRADE: Schedule for end of period
            result = stripe_service.update_subscription(
                subscription_id=subscription.stripe_subscription_id,
                new_price_id=new_price_id,
                new_tier=new_tier,
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to schedule downgrade in Stripe")

            # Mark in our DB that downgrade is scheduled (will take effect at next renewal)
            # Note: We don't change plan_tier yet - that happens when the next invoice.paid fires
            logger.info(f"User {current_user.id} scheduled downgrade from {old_plan['name']} to {new_plan['name']} at period end")

            return {
                "status": "success",
                "message": f"Downgrade to {new_plan['name']} scheduled for end of current period",
                "immediate": False,
                "effective_date": subscription.current_period_end
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")


@router.post("/cancel-subscription")
async def cancel_subscription(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel user's subscription"""
    try:
        cancel_immediately = request.get("cancel_immediately", False)

        subscription_service = SubscriptionService(db)
        subscription = subscription_service.get_user_subscription(current_user.id)

        if not subscription:
            raise HTTPException(status_code=404, detail="No active subscription found")

        stripe_service = StripeService()
        success = stripe_service.cancel_subscription(
            subscription_id=subscription.stripe_subscription_id,
            cancel_at_period_end=not cancel_immediately,
        )

        if success:
            subscription_service.cancel_subscription(
                stripe_subscription_id=subscription.stripe_subscription_id,
                cancel_at_period_end=not cancel_immediately,
            )
            return {"status": "success", "message": "Subscription canceled"}
        else:
            raise HTTPException(status_code=500, detail="Failed to cancel subscription")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")
