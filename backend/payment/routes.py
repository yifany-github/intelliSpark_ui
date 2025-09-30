from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from database import get_db
from auth.routes import get_current_user
from models import User
from schemas import TokenPurchaseRequest, TokenPurchaseResponse, UserTokenBalance, MessageResponse
from payment.stripe_service import StripeService
from payment.token_service import TokenService, get_all_pricing_tiers
from notification_service import get_notification_service
import json
import logging

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
        payment_data = stripe_service.create_payment_intent(
            user_id=current_user.id,
            tier=request.tier
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
                    stripe_payment_intent_id=payment_data["payment_intent_id"]
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
                                "amount": payment_data["amount_cents"] // 100,  # Convert to dollars
                                "tokens": payment_data["tokens"],
                                "tier": payment_data["tier"],
                                "payment_id": payment_data["payment_intent_id"]
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
                                "amount": payment_data["amount_cents"] // 100,
                                "tier": payment_data["tier"],
                                "payment_id": payment_data["payment_intent_id"]
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
                            "payment_id": payment_intent["id"]
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

@router.get("/user/stats")
async def get_user_token_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's token usage statistics"""
    try:
        from models import TokenTransaction, Chat, ChatMessage
        from sqlalchemy import func, and_
        from datetime import datetime, timedelta

        token_service = TokenService(db)
        current_balance = token_service.get_user_balance(current_user.id)

        # Get all transactions
        transactions = db.query(TokenTransaction).filter(
            TokenTransaction.user_id == current_user.id
        ).all()

        # Calculate total purchased (positive amounts from purchases)
        total_purchased = sum(
            t.amount for t in transactions
            if t.transaction_type == 'purchase' and t.amount > 0
        )

        # Calculate total used (negative amounts from deductions)
        total_used = abs(sum(
            t.amount for t in transactions
            if t.transaction_type == 'deduction' and t.amount < 0
        ))

        # Calculate time-based usage
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        weekly_usage = abs(sum(
            t.amount for t in transactions
            if t.transaction_type == 'deduction' and t.created_at >= week_ago
        ))

        monthly_usage = abs(sum(
            t.amount for t in transactions
            if t.transaction_type == 'deduction' and t.created_at >= month_ago
        ))

        # Calculate daily average (based on account age or 30 days, whichever is shorter)
        account_age_days = max(1, (now - current_user.created_at).days)
        days_for_average = min(account_age_days, 30)
        daily_average = total_used / days_for_average if days_for_average > 0 else 0

        # Calculate efficiency score (usage vs purchase ratio, capped at 100%)
        if total_purchased > 0:
            efficiency_score = min(100, int((total_used / total_purchased) * 100))
        else:
            efficiency_score = 0

        # Calculate streak days (consecutive days with at least 1 message)
        streak_days = 0
        check_date = now.date()
        for i in range(365):  # Check up to 1 year back
            day_start = datetime.combine(check_date, datetime.min.time())
            day_end = day_start + timedelta(days=1)

            # Check if user sent any messages on this day
            messages_count = db.query(ChatMessage).join(
                Chat, ChatMessage.chat_id == Chat.id
            ).filter(
                and_(
                    Chat.user_id == current_user.id,
                    ChatMessage.timestamp >= day_start,
                    ChatMessage.timestamp < day_end
                )
            ).count()

            if messages_count > 0:
                streak_days += 1
                check_date = check_date - timedelta(days=1)
            else:
                break

        # Get favorite characters (most chatted with, based on token usage)
        favorite_characters = []
        try:
            from models import Character

            # Get characters with most messages
            character_message_counts = db.query(
                Character.name,
                func.count(ChatMessage.id).label('usage_count')
            ).join(
                Chat, Character.id == Chat.character_id
            ).join(
                ChatMessage, ChatMessage.chat_id == Chat.id
            ).filter(
                and_(
                    Chat.user_id == current_user.id,
                    ChatMessage.role == 'assistant'  # Count AI responses as usage
                )
            ).group_by(
                Character.name
            ).order_by(
                func.count(ChatMessage.id).desc()
            ).limit(5).all()

            favorite_characters = [
                {"character_name": name, "usage_count": count}
                for name, count in character_message_counts
            ]
        except Exception as e:
            logger.error(f"Error calculating favorite characters: {e}")

        # Get daily usage for last 7 days
        usage_by_day = []
        for i in range(6, -1, -1):  # Last 7 days in chronological order
            day = now - timedelta(days=i)
            day_start = datetime.combine(day.date(), datetime.min.time())
            day_end = day_start + timedelta(days=1)

            day_usage = abs(sum(
                t.amount for t in transactions
                if t.transaction_type == 'deduction'
                and day_start <= t.created_at < day_end
            ))

            usage_by_day.append({
                "date": day.strftime("%Y-%m-%d"),
                "usage": day_usage
            })

        return {
            "total_purchased": total_purchased,
            "total_used": total_used,
            "current_balance": current_balance,
            "daily_average": round(daily_average, 1),
            "weekly_usage": weekly_usage,
            "monthly_usage": monthly_usage,
            "favorite_characters": favorite_characters,
            "usage_by_day": usage_by_day,
            "efficiency_score": efficiency_score,
            "streak_days": streak_days
        }

    except Exception as e:
        logger.error(f"Error getting user token stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get token usage statistics"
        )