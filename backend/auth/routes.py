from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
import logging

from database import get_db
from models import User
from schemas import User as UserSchema
from backend.services.upload_service import UploadService
from utils.character_utils import resolve_asset_url
from auth.supabase_auth import (
    decode_supabase_token,
    ensure_user_is_active,
    record_successful_login,
    sync_user_from_supabase_payload,
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Security scheme
security = HTTPBearer()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency to retrieve the authenticated user via Supabase JWT."""
    token = credentials.credentials
    payload = decode_supabase_token(token)
    user = sync_user_from_supabase_payload(db, payload)
    ensure_user_is_active(user)

    client_ip = request.client.host if request.client else None
    try:
        record_successful_login(db, user, client_ip)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to record login metadata for user %s: %s", getattr(user, "id", "unknown"), exc)

    return user


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.post("/logout")
async def logout():
    """Placeholder logout endpoint (Supabase manages sessions client-side)."""
    return {"message": "Successfully logged out"}


@router.get("/me/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's statistics"""
    try:
        from models import Chat, ChatMessage, Character
        from sqlalchemy import func, distinct

        # Get total chats count
        total_chats = db.query(Chat).filter(Chat.user_id == current_user.id).count()

        # Get total messages count (explicitly specify join condition)
        total_messages = db.query(ChatMessage).join(
            Chat, ChatMessage.chat_id == Chat.id
        ).filter(
            Chat.user_id == current_user.id
        ).count()

        # Get unique characters chatted with
        unique_characters = db.query(distinct(Chat.character_id)).filter(
            Chat.user_id == current_user.id
        ).count()

        # Get user's created characters count
        created_characters = db.query(Character).filter(
            Character.created_by == current_user.id,
            Character.is_deleted == False
        ).count()

        # Get recent activity (last 5 chat sessions)
        recent_chats = db.query(Chat).filter(
            Chat.user_id == current_user.id
        ).order_by(Chat.created_at.desc()).limit(5).all()

        recent_activity = []
        for chat in recent_chats:
            character = db.query(Character).filter(Character.id == chat.character_id).first()
            if character:
                recent_activity.append({
                    "type": "chat",
                    "character_name": character.name,
                    "character_avatar": character.avatar_url,
                    "created_at": chat.created_at.isoformat() if chat.created_at else None,
                    "updated_at": chat.updated_at.isoformat() if chat.updated_at else None
                })

        return {
            "total_chats": total_chats,
            "total_messages": total_messages,
            "unique_characters": unique_characters,
            "created_characters": created_characters,
            "recent_activity": recent_activity,
            "member_since": current_user.created_at.isoformat() if current_user.created_at else None
        }

    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user statistics"
        )


@router.get("/check-username")
async def check_username(username: str, db: Session = Depends(get_db)):
    """Check if username is available"""
    try:
        # Check if username exists
        existing_user = db.query(User).filter(User.username == username).first()
        return {"available": existing_user is None}
    except Exception as e:
        logger.error(f"Error checking username: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check username availability"
        )


@router.put("/profile", response_model=UserSchema)
async def update_profile(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    age: Optional[int] = Form(None),
    preset_avatar_id: Optional[int] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    try:
        # Check if username is being changed and if it's taken
        if username != current_user.username:
            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )

        # Check if email is being changed and if it's taken
        normalized_email = email.strip().lower()
        if normalized_email != (current_user.email or ""):
            existing_email = db.query(User).filter(User.email == normalized_email).first()
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )

        # Validate age if provided
        if age is not None and (age < 13 or age > 120):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Age must be between 13 and 120"
            )

        # Update basic fields
        current_user.username = username
        current_user.email = normalized_email
        current_user.age = age

        # Handle avatar update
        if preset_avatar_id is not None:
            # Use preset avatar
            preset_path = f"/assets/user_avatar_img/avatar_{preset_avatar_id}.png"
            current_user.avatar_url = resolve_asset_url(preset_path)
        elif avatar is not None:
            upload_service = UploadService()
            success, upload_data, error = await upload_service.process_avatar_upload(
                file=avatar,
                user_id=current_user.id,
                request=request,
                upload_type="user_profile",
            )

            if not success or not upload_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error or "Failed to upload avatar"
                )

            current_user.avatar_url = upload_data.get("url") or upload_data.get("avatarUrl")

        # Commit changes
        db.commit()
        db.refresh(current_user)

        logger.info(f"Profile updated for user: {current_user.email}")
        return current_user

    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already taken"
        )
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
