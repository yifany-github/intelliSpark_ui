from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import logging
import os
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import glob
from pathlib import Path

from database import get_db
from models import Character, Chat, ChatMessage, User
from schemas import (
    Character as CharacterSchema, 
    MessageResponse, CharacterCreate
)

# Login request schema
class LoginRequest(BaseModel):
    password: str

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/admin", tags=["admin"])

# Security
security = HTTPBearer()

# Simple admin password (in production, use proper authentication)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin authentication token"""
    if credentials.credentials != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials

# ===== ADMIN AUTH ROUTES =====

@router.post("/login")
async def admin_login(request: LoginRequest):
    """Admin login endpoint"""
    if request.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    return {
        "access_token": ADMIN_PASSWORD,
        "token_type": "bearer",
        "message": "Admin login successful"
    }

# ===== ADMIN SCENES ROUTES (REMOVED) =====
# Scene functionality has been removed as per issue #23

# ===== ADMIN CHARACTERS ROUTES =====

@router.get("/characters", response_model=List[CharacterSchema])
async def get_admin_characters(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Get all characters for admin"""
    try:
        characters = db.query(Character).all()
        return characters
    except Exception as e:
        logger.error(f"Error fetching characters for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch characters")

@router.post("/characters", response_model=CharacterSchema)
async def create_admin_character(
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Create a new character"""
    try:
        character = Character(
            name=character_data.name,
            description=character_data.description,
            avatar_url=character_data.avatarUrl,
            backstory=character_data.backstory,
            voice_style=character_data.voiceStyle,
            traits=character_data.traits,
            personality_traits=character_data.personalityTraits or {},  # Default to empty dict if None
            category=character_data.category,
            gender=character_data.gender,
            conversation_style=character_data.conversationStyle,
            is_public=character_data.isPublic,
            nsfw_level=character_data.nsfwLevel
        )
        
        db.add(character)
        db.commit()
        db.refresh(character)
        
        return character
    except Exception as e:
        logger.error(f"Error creating character: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create character")

@router.put("/characters/{character_id}", response_model=CharacterSchema)
async def update_admin_character(
    character_id: int,
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Update an existing character"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        character.name = character_data.name
        character.avatar_url = character_data.avatarUrl
        character.backstory = character_data.backstory
        character.voice_style = character_data.voiceStyle
        character.traits = character_data.traits
        character.personality_traits = character_data.personalityTraits or {}
        
        db.commit()
        db.refresh(character)
        
        return character
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating character {character_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update character")

@router.delete("/characters/{character_id}", response_model=MessageResponse)
async def delete_admin_character(
    character_id: int,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Delete a character"""
    try:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        
        db.delete(character)
        db.commit()
        
        return MessageResponse(message="Character deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting character {character_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete character")

# ===== ADMIN USERS & STATS ROUTES =====

@router.get("/users")
async def get_admin_users(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Get all users for admin"""
    try:
        users = db.query(User).all()
        # Convert to dict to avoid password exposure
        user_list = []
        for user in users:
            user_dict = {
                "id": user.id,
                "username": user.username,
                "nsfw_level": user.nsfw_level,
                "context_window_length": user.context_window_length,
                "temperature": user.temperature,
                "memory_enabled": user.memory_enabled,
                "created_at": user.created_at,
                "total_chats": len(user.chats)
            }
            user_list.append(user_dict)
        
        return user_list
    except Exception as e:
        logger.error(f"Error fetching users for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
        avg_messages_per_chat = db.query(
            func.avg(func.count(ChatMessage.id))
        ).join(Chat).group_by(Chat.id).scalar() or 0
        
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Get available images from attached_assets directory"""
    try:
        # Get the project root directory (go up from backend/admin to project root)
        current_dir = Path(__file__).resolve().parent.parent.parent
        assets_dir = current_dir / "attached_assets"
        
        if asset_type == "characters":
            image_dir = assets_dir / "characters_img"
        else:
            raise HTTPException(status_code=400, detail="Invalid asset type. Only 'characters' is supported")
        
        if not image_dir.exists():
            # Create directory if it doesn't exist
            image_dir.mkdir(parents=True, exist_ok=True)
            return {"images": []}
        
        # Supported image extensions
        supported_extensions = ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp"]
        
        images = []
        for ext in supported_extensions:
            image_files = glob.glob(str(image_dir / ext))
            image_files.extend(glob.glob(str(image_dir / ext.upper())))
            
            for image_file in image_files:
                file_path = Path(image_file)
                relative_path = f"/assets/{asset_type}_img/{file_path.name}"
                images.append({
                    "filename": file_path.name,
                    "name": file_path.stem,  # filename without extension
                    "url": relative_path,
                    "size": file_path.stat().st_size if file_path.exists() else 0
                })
        
        # Sort by filename
        images.sort(key=lambda x: x['filename'])
        
        return {"images": images}
    
    except Exception as e:
        logger.error(f"Error fetching asset images: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")

@router.post("/assets/images/upload")
async def upload_asset_image(
    # This is a placeholder for future file upload functionality
    # In a real implementation, you would handle file uploads here
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Upload image to attached_assets directory (placeholder)"""
    try:
        # This is a placeholder for file upload functionality
        # You would typically use FastAPI's File and UploadFile here
        return {
            "message": "File upload functionality not yet implemented. Please manually place images in /attached_assets/characters_img/ directory."
        }
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")