from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from pydantic import BaseModel
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
    MessageResponse, CharacterCreate, CharacterAdminUpdate
)
from services.character_service import CharacterService, CharacterServiceError
from services.upload_service import UploadService
from services.character_gallery_service import CharacterGalleryService
from services.prompt_engine import create_prompt_preview

# Login request schema
class LoginRequest(BaseModel):
    password: str

# Set up logging
logger = logging.getLogger(__name__)

# Create router (no prefix - main.py handles /api/admin prefix)
router = APIRouter(tags=["admin"])

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

@router.get("/characters")
async def get_admin_characters(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Get all characters for admin (includes private characters)"""
    try:
        service = CharacterService(db, admin_context=True)
        return await service.get_all_characters(include_private=True)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
):
    """Delete a character (admin context)"""
    try:
        service = CharacterService(db, admin_context=True)
        success, error = await service.admin_delete_character(character_id)
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return {"message": "Character deleted successfully"}
    except HTTPException:
        raise
    except CharacterServiceError as e:
        logger.error(f"Character service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting character {character_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete character")

@router.patch("/characters/{character_id}/admin-settings")
async def update_character_admin_settings(
    character_id: int,
    update_data: CharacterAdminUpdate,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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

# ===== PERSONA PROMPT PREVIEW ENDPOINT =====

@router.get("/characters/{character_id}/prompt")
async def get_character_prompt_preview(
    character_id: int,
    preview: bool = True,
    chat_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token)
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
        
        # Generate prompt preview using PromptEngine
        from services.prompt_engine import create_prompt_preview
        from prompts.system import SYSTEM_PROMPT
        
        preview_result = create_prompt_preview(
            character=character,
            sample_chat=sample_chat,
            system_prompt=SYSTEM_PROMPT
        )
        
        return {
            "character_id": character_id,
            "character_name": character.name,
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
