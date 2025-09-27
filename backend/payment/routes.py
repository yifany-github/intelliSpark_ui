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
from notification_service import get_notification_service
import json
import logging
from typing import List

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
        
        # Handle payment success
        if event["type"] == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
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
                )
                
                if success:
                    logger.info(f"Successfully added {payment_data['tokens']} tokens to user {payment_data['user_id']}")
                    
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
                        logger.info(f"Created payment success notification for user {payment_data['user_id']}")
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
                        logger.info(f"Created payment failed notification for user {payment_data['user_id']}")
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
                "stripe_payment_intent_id": t.stripe_payment_intent_id
            }
            for t in transactions
        ]
        
    except Exception as e:
        logger.error(f"Error getting user transactions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get transaction history"
        )
