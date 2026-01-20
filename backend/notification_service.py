from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from uuid import uuid4
from collections import OrderedDict
from string import Template
import logging

from models import Notification, NotificationTemplate, User
from schemas import (
    NotificationCreate, NotificationUpdate, NotificationStats,
    NotificationTemplateCreate, BulkNotificationCreate, AdminNotificationCreate
)

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def create_notification(self, notification_data: NotificationCreate) -> Notification:
        """Create a new notification"""
        db_notification = Notification(
            user_id=notification_data.user_id,
            title=notification_data.title,
            content=notification_data.content,
            type=notification_data.type,
            priority=notification_data.priority,
            action_type=notification_data.action_type,
            action_data=notification_data.action_data,
            meta_data=notification_data.meta_data,
            expires_at=notification_data.expires_at
        )
        
        self.db.add(db_notification)
        self.db.commit()
        self.db.refresh(db_notification)
        
        logger.info(f"Created notification {db_notification.id} for user {notification_data.user_id}")
        return db_notification

    def get_user_notifications(
        self, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 20,
        unread_only: bool = False,
        type_filter: Optional[str] = None
    ) -> List[Notification]:
        """Get notifications for a specific user"""
        query = self.db.query(Notification).filter(Notification.user_id == user_id)
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        if type_filter:
            query = query.filter(Notification.type == type_filter)
        
        # Filter out expired notifications
        query = query.filter(
            or_(
                Notification.expires_at == None,
                Notification.expires_at > datetime.utcnow()
            )
        )
        
        return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    def get_notification_stats(self, user_id: int) -> NotificationStats:
        """Get notification statistics for a user"""
        base_query = self.db.query(Notification).filter(
            and_(
                Notification.user_id == user_id,
                or_(
                    Notification.expires_at == None,
                    Notification.expires_at > datetime.utcnow()
                )
            )
        )
        
        total = base_query.count()
        unread = base_query.filter(Notification.is_read == False).count()
        
        # Count by type
        by_type = {}
        type_counts = self.db.query(Notification.type, func.count(Notification.id)).filter(
            and_(
                Notification.user_id == user_id,
                or_(
                    Notification.expires_at == None,
                    Notification.expires_at > datetime.utcnow()
                )
            )
        ).group_by(Notification.type).all()
        
        for type_name, count in type_counts:
            by_type[type_name] = count
        
        # Count by priority
        by_priority = {}
        priority_counts = self.db.query(Notification.priority, func.count(Notification.id)).filter(
            and_(
                Notification.user_id == user_id,
                or_(
                    Notification.expires_at == None,
                    Notification.expires_at > datetime.utcnow()
                )
            )
        ).group_by(Notification.priority).all()
        
        for priority_name, count in priority_counts:
            by_priority[priority_name] = count
        
        return NotificationStats(
            total=total,
            unread=unread,
            by_type=by_type,
            by_priority=by_priority
        )

    def mark_as_read(self, notification_id: int, user_id: int) -> Optional[Notification]:
        """Mark a notification as read"""
        notification = self.db.query(Notification).filter(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        ).first()
        
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(notification)
            logger.info(f"Marked notification {notification_id} as read for user {user_id}")
        
        return notification

    def mark_all_as_read(self, user_id: int) -> int:
        """Mark all notifications as read for a user"""
        count = self.db.query(Notification).filter(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        
        self.db.commit()
        logger.info(f"Marked {count} notifications as read for user {user_id}")
        return count

    def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """Delete a notification"""
        notification = self.db.query(Notification).filter(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        ).first()
        
        if notification:
            self.db.delete(notification)
            self.db.commit()
            logger.info(f"Deleted notification {notification_id} for user {user_id}")
            return True
        
        return False

    def cleanup_expired_notifications(self) -> int:
        """Remove expired notifications"""
        count = self.db.query(Notification).filter(
            and_(
                Notification.expires_at != None,
                Notification.expires_at < datetime.utcnow()
            )
        ).delete()
        
        self.db.commit()
        logger.info(f"Cleaned up {count} expired notifications")
        return count

    # Template management
    def create_template(self, template_data: NotificationTemplateCreate) -> NotificationTemplate:
        """Create a notification template"""
        db_template = NotificationTemplate(
            name=template_data.name,
            title_template=template_data.title_template,
            content_template=template_data.content_template,
            type=template_data.type,
            priority=template_data.priority,
            action_type=template_data.action_type,
            is_active=template_data.is_active
        )
        
        self.db.add(db_template)
        self.db.commit()
        self.db.refresh(db_template)
        
        logger.info(f"Created notification template: {template_data.name}")
        return db_template

    def get_template(self, template_name: str) -> Optional[NotificationTemplate]:
        """Get a notification template by name"""
        return self.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.name == template_name,
                NotificationTemplate.is_active == True
            )
        ).first()

    def create_from_template(self, template_name: str, user_id: int, variables: Dict[str, Any] = None) -> Optional[Notification]:
        """Create a notification from a template"""
        template = self.get_template(template_name)
        if not template:
            logger.error(f"Template {template_name} not found")
            return None
        
        variables = variables or {}
        
        # Replace variables in title and content
        title = Template(template.title_template).safe_substitute(**variables)
        content = Template(template.content_template).safe_substitute(**variables)
        
        notification_data = NotificationCreate(
            user_id=user_id,
            title=title,
            content=content,
            type=template.type,
            priority=template.priority,
            action_type=template.action_type
        )
        
        return self.create_notification(notification_data)

    def send_bulk_notifications(self, bulk_data: BulkNotificationCreate) -> List[Notification]:
        """Send notifications to multiple users using a template"""
        template = self.get_template(bulk_data.template_name)
        if not template:
            logger.error(f"Template {bulk_data.template_name} not found")
            return []
        
        notifications = []
        variables = bulk_data.variables or {}
        
        for user_id in bulk_data.user_ids:
            notification = self.create_from_template(
                bulk_data.template_name, 
                user_id, 
                variables
            )
            if notification:
                notifications.append(notification)
        
        logger.info(f"Sent {len(notifications)} bulk notifications using template {bulk_data.template_name}")
        return notifications

    def send_admin_notification(self, admin_data: AdminNotificationCreate) -> List[Notification]:
        """Send admin notification to users"""
        notifications = []
        batch_id = str(uuid4())
        
        # If no specific users, send to all users
        if not admin_data.user_ids:
            users = self.db.query(User).all()
            user_ids = [user.id for user in users]
        else:
            user_ids = admin_data.user_ids
        
        target_scope = "all" if not admin_data.user_ids else "specific"
        meta_template = {
            "admin_batch_id": batch_id,
            "target_scope": target_scope,
            "target_count": len(user_ids),
        }
        
        for user_id in user_ids:
            notification_data = NotificationCreate(
                user_id=user_id,
                title=admin_data.title,
                content=admin_data.content,
                type=admin_data.type or 'admin',
                priority=admin_data.priority,
                action_type=admin_data.action_type,
                action_data=admin_data.action_data,
                expires_at=admin_data.expires_at,
                meta_data=meta_template
            )
            
            notification = self.create_notification(notification_data)
            notifications.append(notification)
        
        logger.info(f"Sent admin notification to {len(notifications)} users")
        return notifications

    def _legacy_batch_id(self, notification: Notification) -> str:
        safe_title = notification.title or "untitled"
        timestamp = int(notification.created_at.timestamp()) if notification.created_at else 0
        return f"legacy-{safe_title}-{timestamp}"

    def _resolve_batch_id(self, notification: Notification) -> str:
        meta = notification.meta_data or {}
        batch_id = meta.get("admin_batch_id")
        if not batch_id:
            batch_id = self._legacy_batch_id(notification)
        return batch_id

    def get_admin_notification_batches(self, limit: int = 6) -> List[Dict[str, Any]]:
        """Aggregate recently sent admin notification batches."""
        notifications = (
            self.db.query(Notification)
            .filter(Notification.type == 'admin')
            .order_by(Notification.created_at.desc())
            .limit(limit * 100)
            .all()
        )

        batches: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()

        for notification in notifications:
            meta = notification.meta_data or {}
            batch_id = self._resolve_batch_id(notification)

            if batch_id not in batches:
                target_count = meta.get("target_count")
                if target_count is None:
                    target_count = 1

                batches[batch_id] = {
                    "batch_id": batch_id,
                    "title": notification.title,
                    "content": notification.content,
                    "type": notification.type,
                    "priority": notification.priority,
                    "target_scope": meta.get("target_scope", "specific"),
                    "target_count": target_count,
                    "delivered_count": 0,
                    "read_count": 0,
                    "created_at": notification.created_at,
                }

            batch = batches[batch_id]
            batch["delivered_count"] += 1
            if notification.is_read:
                batch["read_count"] += 1

            if batch["target_count"] < batch["delivered_count"]:
                batch["target_count"] = batch["delivered_count"]

        return list(batches.values())[:limit]

    def get_admin_notification_analytics(self, limit: int = 6) -> Dict[str, Any]:
        """Compute high-level metrics for admin notifications."""
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_users = self.db.query(User).filter(User.is_suspended == False).count()

        admin_rows = (
            self.db.query(Notification)
            .filter(Notification.type == 'admin')
            .all()
        )

        all_batches: Set[str] = set()
        recent_batches_set: Set[str] = set()

        for note in admin_rows:
            batch_id = self._resolve_batch_id(note)
            all_batches.add(batch_id)
            if note.created_at and note.created_at >= week_ago:
                recent_batches_set.add(batch_id)

        recent_batches = self.get_admin_notification_batches(limit)

        return {
            "total_notifications": len(all_batches),
            "total_admin_notifications": len(all_batches),
            "admin_last_7_days": len(recent_batches_set),
            "active_users": active_users,
            "recent_batches": recent_batches,
        }

    # Specialized notification creators
    def create_payment_success_notification(self, user_id: int, amount: int, tokens: int) -> Notification:
        """Create a payment success notification"""
        return self.create_from_template(
            'payment_success',
            user_id,
            {
                'amount': amount,
                'tokens': tokens,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }
        )

    def create_token_low_notification(self, user_id: int, current_balance: int) -> Notification:
        """Create a low token balance notification"""
        return self.create_from_template(
            'token_low',
            user_id,
            {
                'balance': current_balance,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }
        )

    def create_welcome_notification(self, user_id: int, username: str) -> Notification:
        """Create a welcome notification for new users"""
        return self.create_from_template(
            'welcome',
            user_id,
            {
                'username': username,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }
        )

    def create_system_maintenance_notification(self, user_ids: List[int], start_time: str, duration: str) -> List[Notification]:
        """Create system maintenance notifications"""
        bulk_data = BulkNotificationCreate(
            user_ids=user_ids,
            template_name='system_maintenance',
            variables={
                'start_time': start_time,
                'duration': duration
            }
        )
        return self.send_bulk_notifications(bulk_data)

def get_notification_service(db: Session) -> NotificationService:
    """Get notification service instance"""
    return NotificationService(db)
