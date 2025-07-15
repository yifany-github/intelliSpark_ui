from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from auth.routes import get_current_user
from models import User
from schemas import (
    Notification, NotificationCreate, NotificationUpdate, NotificationStats,
    NotificationTemplate, NotificationTemplateCreate, BulkNotificationCreate,
    AdminNotificationCreate, MessageResponse
)
from notification_service import get_notification_service, NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/", response_model=List[Notification])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    type_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notifications for the current user"""
    service = get_notification_service(db)
    notifications = service.get_user_notifications(
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
        type_filter=type_filter
    )
    return notifications

@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notification statistics for the current user"""
    service = get_notification_service(db)
    return service.get_notification_stats(current_user.id)

@router.patch("/{notification_id}/read", response_model=Notification)
async def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    service = get_notification_service(db)
    notification = service.mark_as_read(notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification

@router.patch("/read-all", response_model=MessageResponse)
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read for the current user"""
    service = get_notification_service(db)
    count = service.mark_all_as_read(current_user.id)
    
    return MessageResponse(message=f"Marked {count} notifications as read")

@router.delete("/{notification_id}", response_model=MessageResponse)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    service = get_notification_service(db)
    success = service.delete_notification(notification_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return MessageResponse(message="Notification deleted successfully")

# Admin routes (require admin authentication)
@router.post("/admin/send", response_model=List[Notification])
async def send_admin_notification(
    admin_data: AdminNotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send admin notification to users (admin only)"""
    # TODO: Add admin role check
    # For now, allow all authenticated users to send admin notifications
    service = get_notification_service(db)
    notifications = service.send_admin_notification(admin_data)
    
    return notifications

@router.post("/admin/bulk", response_model=List[Notification])
async def send_bulk_notifications(
    bulk_data: BulkNotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send bulk notifications using a template (admin only)"""
    # TODO: Add admin role check
    service = get_notification_service(db)
    notifications = service.send_bulk_notifications(bulk_data)
    
    return notifications

@router.post("/admin/templates", response_model=NotificationTemplate)
async def create_notification_template(
    template_data: NotificationTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a notification template (admin only)"""
    # TODO: Add admin role check
    service = get_notification_service(db)
    template = service.create_template(template_data)
    
    return template

@router.get("/admin/templates/{template_name}", response_model=NotificationTemplate)
async def get_notification_template(
    template_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a notification template (admin only)"""
    # TODO: Add admin role check
    service = get_notification_service(db)
    template = service.get_template(template_name)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

@router.post("/admin/cleanup", response_model=MessageResponse)
async def cleanup_expired_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clean up expired notifications (admin only)"""
    # TODO: Add admin role check
    service = get_notification_service(db)
    count = service.cleanup_expired_notifications()
    
    return MessageResponse(message=f"Cleaned up {count} expired notifications")

# Public routes for creating specific types of notifications
@router.post("/system/welcome", response_model=Notification)
async def create_welcome_notification(
    user_id: int,
    username: str,
    db: Session = Depends(get_db)
):
    """Create a welcome notification for a new user"""
    service = get_notification_service(db)
    notification = service.create_welcome_notification(user_id, username)
    
    if not notification:
        raise HTTPException(status_code=500, detail="Failed to create welcome notification")
    
    return notification

@router.post("/system/payment-success", response_model=Notification)
async def create_payment_success_notification(
    user_id: int,
    amount: int,
    tokens: int,
    db: Session = Depends(get_db)
):
    """Create a payment success notification"""
    service = get_notification_service(db)
    notification = service.create_payment_success_notification(user_id, amount, tokens)
    
    if not notification:
        raise HTTPException(status_code=500, detail="Failed to create payment success notification")
    
    return notification

@router.post("/system/token-low", response_model=Notification)
async def create_token_low_notification(
    user_id: int,
    current_balance: int,
    db: Session = Depends(get_db)
):
    """Create a low token balance notification"""
    service = get_notification_service(db)
    notification = service.create_token_low_notification(user_id, current_balance)
    
    if not notification:
        raise HTTPException(status_code=500, detail="Failed to create token low notification")
    
    return notification