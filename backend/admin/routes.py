from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import logging
import os
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import Scene, Character, Chat, ChatMessage, User
from schemas import (
    Scene as SceneSchema, Character as CharacterSchema, 
    MessageResponse, SceneCreate, CharacterCreate
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

# ===== ADMIN SCENES ROUTES =====

@router.get("/scenes", response_model=List[SceneSchema])
async def get_admin_scenes(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Get all scenes for admin"""
    try:
        scenes = db.query(Scene).all()
        return scenes
    except Exception as e:
        logger.error(f"Error fetching scenes for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch scenes")

@router.post("/scenes", response_model=SceneSchema)
async def create_admin_scene(
    scene_data: SceneCreate,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Create a new scene"""
    try:
        scene = Scene(
            name=scene_data.name,
            description=scene_data.description,
            image_url=scene_data.imageUrl,
            location=scene_data.location,
            mood=scene_data.mood,
            rating=scene_data.rating
        )
        
        db.add(scene)
        db.commit()
        db.refresh(scene)
        
        return scene
    except Exception as e:
        logger.error(f"Error creating scene: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create scene")

@router.put("/scenes/{scene_id}", response_model=SceneSchema)
async def update_admin_scene(
    scene_id: int,
    scene_data: SceneCreate,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Update an existing scene"""
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        scene.name = scene_data.name
        scene.description = scene_data.description
        scene.image_url = scene_data.imageUrl
        scene.location = scene_data.location
        scene.mood = scene_data.mood
        scene.rating = scene_data.rating
        
        db.commit()
        db.refresh(scene)
        
        return scene
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scene {scene_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update scene")

@router.delete("/scenes/{scene_id}", response_model=MessageResponse)
async def delete_admin_scene(
    scene_id: int,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Delete a scene"""
    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        
        db.delete(scene)
        db.commit()
        
        return MessageResponse(message="Scene deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting scene {scene_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete scene")

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
            avatar_url=character_data.avatarUrl,
            backstory=character_data.backstory,
            voice_style=character_data.voiceStyle,
            traits=character_data.traits,
            personality_traits=character_data.personalityTraits
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
        character.personality_traits = character_data.personalityTraits
        
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
        total_scenes = db.query(Scene).count()
        total_characters = db.query(Character).count()
        total_chats = db.query(Chat).count()
        total_messages = db.query(ChatMessage).count()
        
        # Get recent activity (last 30 days)
        thirty_days_ago = datetime.now().replace(day=1)  # Simple approximation
        recent_chats = db.query(Chat).filter(
            Chat.created_at >= thirty_days_ago
        ).count()
        
        # Get most popular scenes and characters
        popular_scenes = db.query(
            Scene.name,
            func.count(Chat.id).label('chat_count')
        ).join(Chat).group_by(Scene.id, Scene.name).order_by(
            func.count(Chat.id).desc()
        ).limit(5).all()
        
        popular_characters = db.query(
            Character.name,
            func.count(Chat.id).label('chat_count')
        ).join(Chat).group_by(Character.id, Character.name).order_by(
            func.count(Chat.id).desc()
        ).limit(5).all()
        
        return {
            "totals": {
                "users": total_users,
                "scenes": total_scenes,
                "characters": total_characters,
                "chats": total_chats,
                "messages": total_messages
            },
            "recent_activity": {
                "chats_last_30_days": recent_chats
            },
            "popular_content": {
                "scenes": [{"name": scene.name, "chat_count": scene.chat_count} for scene in popular_scenes],
                "characters": [{"name": char.name, "chat_count": char.chat_count} for char in popular_characters]
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