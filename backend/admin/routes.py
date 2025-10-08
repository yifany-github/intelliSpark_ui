from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import os
from datetime import datetime, timezone
import glob
from pathlib import Path

from database import get_db
from models import Character, Chat, ChatMessage, User, UserToken, TokenTransaction, Notification
from schemas import (
    Character as CharacterSchema, 
    MessageResponse, CharacterCreate, CharacterAdminUpdate
)
from services.character_service import CharacterService, CharacterServiceError
from services.upload_service import UploadService
from services.character_gallery_service import CharacterGalleryService
from services.prompt_engine import create_prompt_preview
from auth.admin_routes import get_current_admin
from auth.admin_jwt import TokenPayload, create_token_pair
from payment.token_service import TokenService
from services.storage_manager import get_storage_manager, StorageManagerError

# Login request schema
class LoginRequest(BaseModel):
    password: str

class SuspendUserRequest(BaseModel):
    reason: Optional[str] = None


class TokenAdjustmentRequest(BaseModel):
    amount: int
    reason: Optional[str] = None


def serialize_admin_user(
    user: User,
    token_balance: Optional[int] = None,
    total_chats: Optional[int] = None
) -> Dict[str, Any]:
    """Serialize a user object for admin responses without sensitive fields."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "provider": user.provider,
        "memory_enabled": user.memory_enabled,
        "email_verified": getattr(user, "email_verified", False),
        "created_at": user.created_at,
        "last_login_at": getattr(user, "last_login_at", None),
        "last_login_ip": getattr(user, "last_login_ip", None),
        "token_balance": token_balance if token_balance is not None else 0,
        "total_chats": total_chats if total_chats is not None else len(getattr(user, "chats", []) or []),
        "is_suspended": getattr(user, "is_suspended", False),
        "suspended_at": getattr(user, "suspended_at", None),
        "suspension_reason": getattr(user, "suspension_reason", None)
    }

# Set up logging
logger = logging.getLogger(__name__)

# Create router (no prefix - main.py handles /api/admin prefix)
router = APIRouter(tags=["admin"])

# Simple admin password (in production, use proper authentication)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable must be set for admin authentication")

# ===== ADMIN AUTH ROUTES =====

@router.post("/login")
async def admin_login(request: LoginRequest):
    """Admin login endpoint"""
    if request.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    token_data = create_token_pair("admin:legacy")

    return {
        "access_token": token_data.access_token,
        "refresh_token": token_data.refresh_token,
        "token_type": token_data.token_type,
        "expires_in": token_data.expires_in,
        "message": "Admin login successful"
    }

# ===== ADMIN SCENES ROUTES (REMOVED) =====
# Scene functionality has been removed as per issue #23

# ===== ADMIN CHARACTERS ROUTES =====

@router.get("/characters")
async def get_admin_characters(
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get all characters for admin (includes private characters; optionally include deleted)"""
    try:
        service = CharacterService(db, admin_context=True)
        return await service.get_all_characters(include_private=True, include_deleted=include_deleted)
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching characters for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch characters")

@router.post("/characters")
async def create_admin_character(
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Create a new character (admin context)"""
    try:
        # Admin creates character with user_id = 0 (system/admin created)
        service = CharacterService(db, admin_context=True)
        success, character, error = await service.create_character(character_data, user_id=0)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return character
    except HTTPException:
        raise
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating character: {e}")
        raise HTTPException(status_code=500, detail="Failed to create character")

# Note: Prompt preview endpoint is defined later with extended functionality

@router.get("/characters/{character_id}/gallery")
async def get_admin_character_gallery(
    character_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get character gallery data (admin context)"""
    try:
        gallery_service = CharacterGalleryService(db)
        # Admin management should list only DB-backed gallery images (no avatar injection)
        return await gallery_service.get_character_gallery(character_id, include_avatar_in_images=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get character gallery: {str(e)}")

@router.post("/characters/{character_id}/gallery/images")
async def admin_upload_gallery_image(
    request: Request,
    character_id: int,
    file: UploadFile = File(...),
    category: str = Form("general"),
    is_primary: bool = Form(False),
    alt_text: str = Form(None),
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Upload a gallery image (admin context, uses admin token)"""
    try:
        upload_service = UploadService()
        success, upload_data, error = await upload_service.process_avatar_upload(
            file, user_id=0, request=request, upload_type="character_gallery", character_id=character_id
        )
        if not success:
            raise HTTPException(status_code=400, detail=error)

        gallery_service = CharacterGalleryService(db)
        image_data = {
            "image_url": upload_data.get("url") or upload_data.get("avatarUrl"),
            "thumbnail_url": upload_data.get("thumbnailUrl"),
            "alt_text": alt_text or f"Gallery image for character {character_id}",
            "category": category,
            "file_size": upload_data.get("size"),
            "dimensions": upload_data.get("dimensions"),
            "file_format": upload_data.get("filename", "").split(".")[-1].lower() if "." in upload_data.get("filename", "") else None
        }

        # uploaded_by=None to avoid FK issues in admin context
        ok, gallery_image_data, svc_err = await gallery_service.add_gallery_image(
            character_id, image_data, uploaded_by=None, is_primary=is_primary
        )
        if not ok:
            raise HTTPException(status_code=400, detail=svc_err)

        return {
            "message": "Gallery image uploaded successfully",
            "image": gallery_image_data,
            "upload_info": upload_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gallery image upload failed: {str(e)}")

@router.put("/characters/{character_id}/gallery/images/{image_id}/primary")
async def admin_set_primary_gallery_image(
    character_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Set primary gallery image (admin context)"""
    try:
        gallery_service = CharacterGalleryService(db)
        ok, err = await gallery_service.update_primary_image(character_id, image_id)
        if not ok:
            raise HTTPException(status_code=400, detail=err)
        return {"message": f"Image {image_id} set as primary for character {character_id}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set primary image: {str(e)}")

@router.delete("/characters/{character_id}/gallery/images/{image_id}")
async def admin_delete_gallery_image(
    character_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Delete a gallery image (admin context, soft delete)"""
    try:
        gallery_service = CharacterGalleryService(db)
        ok, err = await gallery_service.delete_gallery_image(character_id, image_id)
        if not ok:
            raise HTTPException(status_code=400, detail=err)
        return {"message": f"Gallery image {image_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete gallery image: {str(e)}")

@router.put("/characters/{character_id}/gallery/reorder")
async def admin_reorder_gallery_images(
    character_id: int,
    image_order: List[Dict[str, int]],
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Reorder gallery images (admin context)"""
    try:
        gallery_service = CharacterGalleryService(db)
        ok, err = await gallery_service.reorder_gallery_images(character_id, image_order)
        if not ok:
            raise HTTPException(status_code=400, detail=err)
        return {"message": "Gallery images reordered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reorder gallery images: {str(e)}")

@router.put("/characters/{character_id}")
async def update_admin_character(
    character_id: int,
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Update an existing character (admin context)"""
    try:
        service = CharacterService(db, admin_context=True)
        success, character, error = await service.admin_update_character(character_id, character_data)
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return character
    except HTTPException:
        raise
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update character")

@router.delete("/characters/{character_id}")
async def delete_admin_character(
    character_id: int,
    force: bool = False,
    reason: str = None,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Delete a character (admin context)
    - Default: soft delete with optional reason
    - force=true: hard delete (irreversible)
    """
    try:
        service = CharacterService(db, admin_context=True)
        if force:
            success, error = await service.admin_delete_character(character_id)
            action = "hard-deleted"
        else:
            # creds subject is not mapped; rely on admin token presence, deleted_by left null or 0
            admin_user_id = None
            success, error = await service.admin_soft_delete_character(character_id, admin_user_id or 0, reason)
            action = "soft-deleted"
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return {"message": f"Character {action} successfully"}
    except HTTPException:
        raise
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete character")

@router.post("/characters/{character_id}/restore")
async def restore_admin_character(
    character_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Restore a soft-deleted character (admin only)"""
    try:
        service = CharacterService(db, admin_context=True)
        success, error = await service.admin_restore_character(character_id)
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        return {"message": "Character restored successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore character")

@router.get("/characters/{character_id}/impact")
async def get_character_impact(
    character_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get impact summary before deletion (admin only)"""
    try:
        service = CharacterService(db, admin_context=True)
        success, impact, error = await service.get_character_impact(character_id)
        if not success:
            raise HTTPException(status_code=400, detail=error)
        return impact
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting impact for character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get character impact")

@router.patch("/characters/{character_id}/admin-settings")
async def update_character_admin_settings(
    character_id: int,
    update_data: CharacterAdminUpdate,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Update character admin-only settings (featured status, analytics, etc.)"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Update admin-controlled fields
        update_dict = update_data.dict(exclude_unset=True, by_alias=True)
        for field, value in update_dict.items():
            if hasattr(character, field) and value is not None:
                setattr(character, field, value)
        
        db.commit()
        db.refresh(character)
        
        # Return updated character with proper field mapping
        character_dict = {
            "id": character.id,
            "name": character.name,
            "description": character.description,
            "avatarUrl": character.avatar_url,
            "backstory": character.backstory,
            "voiceStyle": character.voice_style,
            "traits": character.traits,
            "category": character.category,
            "gender": character.gender,
            "isPublic": character.is_public,
            "isFeatured": character.is_featured,
            "viewCount": character.view_count,
            "likeCount": character.like_count,
            "chatCount": character.chat_count,
            "trendingScore": float(character.trending_score),
            "lastActivity": character.last_activity,
            "createdAt": character.created_at,
            "createdBy": character.created_by
        }
        
        return character_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating character admin settings {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update character admin settings")

@router.post("/characters/{character_id}/toggle-featured")
async def toggle_character_featured(
    character_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Toggle character featured status for Editor's Choice"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Toggle featured status
        character.is_featured = not character.is_featured
        db.commit()
        
        return {
            "message": f"Character {'featured' if character.is_featured else 'unfeatured'} successfully",
            "characterId": character_id,
            "isFeatured": character.is_featured
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling character featured status {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle featured status")

# ===== ADMIN CHARACTER STATS =====

@router.get("/characters/stats")
async def get_admin_character_stats(
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get character statistics for admin dashboard"""
    try:
        service = CharacterService(db, admin_context=True)
        return await service.get_admin_character_stats()
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching character stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch character statistics")

# ===== ADMIN USERS & STATS ROUTES =====

@router.get("/users")
async def get_admin_users(
    search: Optional[str] = None,
    status: Optional[str] = None,
    provider: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get paginated users with admin metadata"""
    try:
        limit = max(1, min(limit, 100))
        offset = max(offset, 0)

        query = db.query(User)

        if search:
            pattern = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(User.username).like(pattern),
                    func.lower(User.email).like(pattern)
                )
            )

        if status == "suspended":
            query = query.filter(User.is_suspended.is_(True))
        elif status == "active":
            query = query.filter(or_(User.is_suspended.is_(False), User.is_suspended.is_(None)))

        if provider:
            query = query.filter(User.provider == provider)

        total = query.count()
        users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

        user_ids = [user.id for user in users]

        token_map = {}
        chat_counts = {}
        if user_ids:
            token_rows = db.query(UserToken.user_id, UserToken.balance).filter(UserToken.user_id.in_(user_ids)).all()
            token_map = {row.user_id: row.balance for row in token_rows}

            chat_rows = db.query(Chat.user_id, func.count(Chat.id).label('chat_count')) \
                .filter(Chat.user_id.in_(user_ids)) \
                .group_by(Chat.user_id) \
                .all()
            chat_counts = {row.user_id: row.chat_count for row in chat_rows}

        user_data = [
            serialize_admin_user(
                user,
                token_balance=token_map.get(user.id, 0),
                total_chats=chat_counts.get(user.id, 0)
            )
            for user in users
        ]

        return {
            "data": user_data,
            "meta": {
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        logger.error(f"Error fetching users for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.get("/users/{user_id}")
async def get_admin_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get detailed information for a specific user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_service = TokenService(db)
    token_balance = token_service.get_user_balance(user.id)
    total_chats = db.query(Chat).filter(Chat.user_id == user.id).count()

    recent_chats = db.query(Chat, Character.name) \
        .join(Character, Character.id == Chat.character_id, isouter=True) \
        .filter(Chat.user_id == user.id) \
        .order_by(Chat.created_at.desc()).limit(5).all()
    recent_chat_payload = []
    for chat, character_name in recent_chats:
        recent_chat_payload.append({
            "id": chat.id,
            "uuid": chat.uuid,
            "title": chat.title,
            "character_id": chat.character_id,
            "character_name": character_name,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at
        })

    recent_transactions = db.query(TokenTransaction).filter(TokenTransaction.user_id == user.id) \
        .order_by(TokenTransaction.created_at.desc()).limit(5).all()
    recent_token_payload = [
        {
            "id": txn.id,
            "transaction_type": txn.transaction_type,
            "amount": txn.amount,
            "description": txn.description,
            "created_at": txn.created_at
        }
        for txn in recent_transactions
    ]

    unread_notifications = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read.is_(False)
    ).count()

    payload = serialize_admin_user(
        user,
        token_balance=token_balance,
        total_chats=total_chats
    )
    payload.update({
        "recent_chats": recent_chat_payload,
        "recent_token_transactions": recent_token_payload,
        "unread_notifications": unread_notifications
    })

    return payload


@router.get("/users/{user_id}/chats/{chat_id}")
async def get_admin_chat_detail(
    user_id: int,
    chat_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get chat details and messages for admin review"""
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    character = db.query(Character).filter(Character.id == chat.character_id).first()

    messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat.id).order_by(ChatMessage.id).all()

    return {
        "chat": {
            "id": chat.id,
            "uuid": str(chat.uuid) if chat.uuid else None,
            "title": chat.title,
            "character_id": chat.character_id,
            "character_name": character.name if character else None,
            "created_at": chat.created_at.isoformat() + "Z" if chat.created_at else None,
            "updated_at": chat.updated_at.isoformat() + "Z" if chat.updated_at else None,
        },
        "character": {
            "id": character.id,
            "name": character.name,
        } if character else None,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "timestamp": message.timestamp.isoformat() + "Z" if message.timestamp else None
            }
            for message in messages
        ]
    }


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    payload: SuspendUserRequest,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Suspend a user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if getattr(user, "is_suspended", False):
        return {
            "message": "User already suspended",
            "user": serialize_admin_user(
                user,
                token_balance=TokenService(db).get_user_balance(user.id),
                total_chats=db.query(Chat).filter(Chat.user_id == user.id).count()
            )
        }

    user.is_suspended = True
    user.suspended_at = datetime.now(timezone.utc)
    user.suspension_reason = payload.reason

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"Admin {admin_user.sub} suspended user {user.id}")
    token_balance = TokenService(db).get_user_balance(user.id)
    total_chats = db.query(Chat).filter(Chat.user_id == user.id).count()

    return {
        "message": "User suspended",
        "user": serialize_admin_user(user, token_balance=token_balance, total_chats=total_chats)
    }


@router.post("/users/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Restore a suspended user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not getattr(user, "is_suspended", False):
        return {
            "message": "User already active",
            "user": serialize_admin_user(
                user,
                token_balance=TokenService(db).get_user_balance(user.id),
                total_chats=db.query(Chat).filter(Chat.user_id == user.id).count()
            )
        }

    user.is_suspended = False
    user.suspended_at = None
    user.suspension_reason = None

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"Admin {admin_user.sub} unsuspended user {user.id}")
    token_balance = TokenService(db).get_user_balance(user.id)
    total_chats = db.query(Chat).filter(Chat.user_id == user.id).count()

    return {
        "message": "User unsuspended",
        "user": serialize_admin_user(user, token_balance=token_balance, total_chats=total_chats)
    }


@router.post("/users/{user_id}/tokens")
async def adjust_user_tokens(
    user_id: int,
    payload: TokenAdjustmentRequest,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Add or deduct tokens from a user balance"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.amount == 0:
        raise HTTPException(status_code=400, detail="Amount must be non-zero")

    token_service = TokenService(db)
    description = payload.reason or "Admin adjustment"

    if payload.amount > 0:
        success = token_service.add_tokens(user_id, payload.amount, description)
        action = "added"
    else:
        success = token_service.deduct_tokens(user_id, abs(payload.amount), description)
        action = "deducted"

    if not success:
        raise HTTPException(status_code=400, detail="Unable to adjust tokens (insufficient balance?)")

    balance = token_service.get_user_balance(user_id)
    total_chats = db.query(Chat).filter(Chat.user_id == user_id).count()

    logger.info(f"Admin {admin_user.sub} {action} {payload.amount} tokens for user {user.id}")
    return {
        "message": f"Successfully {action} {abs(payload.amount)} tokens",
        "token_balance": balance,
        "user": serialize_admin_user(user, token_balance=balance, total_chats=total_chats)
    }

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get admin statistics"""
    try:
        # Get basic counts
        total_users = db.query(User).count()
        total_characters = db.query(Character).count()
        total_chats = db.query(Chat).count()
        total_messages = db.query(ChatMessage).count()
        
        # Get recent activity (last 30 days)
        thirty_days_ago = datetime.now().replace(day=1)  # Simple approximation
        recent_chats = db.query(Chat).filter(
            Chat.created_at >= thirty_days_ago
        ).count()
        
        # Get most popular characters
        popular_characters = db.query(
            Character.name,
            func.count(Chat.id).label('chat_count')
        ).join(Chat).group_by(Character.id, Character.name).order_by(
            func.count(Chat.id).desc()
        ).limit(5).all()
        
        # Get user engagement statistics
        # Fix: Use subquery to calculate average messages per chat correctly
        # Specify explicit join condition to avoid ambiguity with multiple foreign keys
        chat_message_counts = db.query(
            func.count(ChatMessage.id).label('message_count')
        ).join(Chat, ChatMessage.chat_id == Chat.id).group_by(Chat.id).subquery()
        
        avg_messages_per_chat = db.query(
            func.avg(chat_message_counts.c.message_count)
        ).scalar() or 0
        
        return {
            "totals": {
                "users": total_users,
                "characters": total_characters,
                "chats": total_chats,
                "messages": total_messages
            },
            "recent_activity": {
                "chats_last_30_days": recent_chats
            },
            "popular_content": {
                "characters": [{"name": char.name, "chat_count": char.chat_count} for char in popular_characters]
            },
            "engagement": {
                "avg_messages_per_chat": round(avg_messages_per_chat, 2) if avg_messages_per_chat else 0
            }
        }
    except Exception as e:
        logger.error(f"Error fetching admin stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch admin statistics")

# ===== ADMIN PAYMENT MONITORING =====

@router.get("/payments")
async def get_admin_payments(
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get payment monitoring data (placeholder)"""
    try:
        # This is a placeholder for payment monitoring
        # In a real implementation, you would integrate with your payment provider
        return {
            "total_revenue": 0,
            "active_subscriptions": 0,
            "recent_payments": [],
            "payment_methods": {
                "credit_card": 0,
                "paypal": 0,
                "stripe": 0
            },
            "monthly_revenue": [
                {"month": "2024-01", "revenue": 0},
                {"month": "2024-02", "revenue": 0},
                {"month": "2024-03", "revenue": 0}
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching payment data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch payment data")

# ===== ASSET MANAGEMENT ROUTES =====

@router.get("/assets/images")
async def get_asset_images(
    asset_type: str = "characters",  # Only "characters" now supported
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Get available images from attached_assets directory"""
    try:
        storage = get_storage_manager()

        if asset_type != "characters":
            raise HTTPException(status_code=400, detail="Invalid asset type. Only 'characters' is supported")

        supported_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp')

        if storage.using_supabase:
            objects = await storage.list_objects('characters_img')
            images = []
            for obj in objects:
                path = obj.get('path')
                if not path or not path.lower().endswith(supported_extensions):
                    continue
                filename = Path(path).name
                images.append({
                    "filename": filename,
                    "name": Path(filename).stem,
                    "url": storage.build_public_url(path),
                    "size": obj.get('size', 0)
                })
            images.sort(key=lambda x: x['filename'])
            return {"images": images}

        # Local filesystem fallback mirrors previous behaviour
        fly_volume_path = Path("/app/attached_assets")
        local_dev_path = Path(__file__).resolve().parent.parent.parent / "attached_assets"

        is_deployed = (
            os.getenv('FLY_APP_NAME') is not None or
            Path('/.dockerenv').exists() or
            fly_volume_path.exists()
        )

        assets_dir = fly_volume_path if (is_deployed and fly_volume_path.exists()) else local_dev_path
        image_dir = assets_dir / "characters_img"
        if not image_dir.exists():
            image_dir.mkdir(parents=True, exist_ok=True)
            return {"images": []}

        image_paths = []
        for pattern in supported_extensions:
            image_paths.extend(glob.glob(str(image_dir / pattern)))
            image_paths.extend(glob.glob(str(image_dir / pattern.upper())))

        images = []
        for image_file in image_paths:
            file_path = Path(image_file)
            relative_path = f"/assets/{asset_type}_img/{file_path.name}"
            images.append(
                {
                    "filename": file_path.name,
                    "name": file_path.stem,
                    "url": relative_path,
                    "size": file_path.stat().st_size if file_path.exists() else 0,
                }
            )

        images.sort(key=lambda x: x['filename'])
        return {"images": images}

    except StorageManagerError as error:
        logger.error(f"Storage error fetching asset images: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")
    except Exception as e:
        logger.error(f"Error fetching asset images: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")

@router.post("/assets/images/upload")
async def upload_asset_image(
    request: Request,
    file: UploadFile = File(...),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """Upload an admin-curated character image to /attached_assets/characters_img.

    Returns a JSON with url (under /assets/characters_img/...), filename, size, etc.
    """
    try:
        upload_service = UploadService()
        # Use special upload type to target characters_img directory
        success, data, error = await upload_service.process_avatar_upload(
            file=file,
            user_id=0,  # system/admin
            request=request,
            upload_type="admin_character_asset",
        )
        if not success:
            raise HTTPException(status_code=400, detail=error)
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading admin asset image: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")

# ===== PERSONA PROMPT PREVIEW ENDPOINT =====

@router.get("/characters/{character_id}/prompt")
async def get_character_prompt_preview(
    character_id: int,
    preview: bool = True,
    chat_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """
    Get compiled prompt preview for a character.
    
    Returns compiled system text, token estimate, and metadata about which fields were used.
    This endpoint shows exactly what the LLM will see when chatting with this character.
    """
    try:
        # Get character from database
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        # Optional: Get sample chat context if chat_id provided
        sample_chat = None
        if chat_id:
            chat_messages = db.query(ChatMessage).filter(
                ChatMessage.chat_id == chat_id
            ).order_by(ChatMessage.timestamp.desc()).limit(10).all()
            sample_chat = list(reversed(chat_messages))  # Chronological order
        
        # Generate prompt preview using PromptEngine with selected system prompt
        from services.prompt_engine import create_prompt_preview
        from utils.prompt_selector import select_system_prompt, get_prompt_type
        
        # Get appropriate system prompt based on character's NSFW level
        selected_system_prompt, prompt_type = select_system_prompt(character)
        
        preview_result = create_prompt_preview(
            character=character,
            sample_chat=sample_chat,
            system_prompt=selected_system_prompt
        )
        
        return {
            "character_id": character_id,
            "character_name": character.name,
            "prompt_type": prompt_type,  # Include which system prompt was used
            "system_text": preview_result["system_text"],
            "token_counts": preview_result["token_counts"],
            "used_fields": preview_result["used_fields"],
            "validation_warnings": preview_result.get("validation_warnings", []),
            "preview_info": preview_result["preview_info"],
            "sections": preview_result.get("sections", {}),
            "sample_context": {
                "messages_count": len(sample_chat) if sample_chat else 0,
                "chat_id": chat_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating prompt preview for character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate prompt preview")
