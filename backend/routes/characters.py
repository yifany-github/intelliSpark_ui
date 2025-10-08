"""
Character Routes for IntelliSpark AI Chat Application

This module contains HTTP route handlers for character-related operations.
All business logic is delegated to the CharacterService and UploadService.

Routes:
- GET /characters - Get all characters
- GET /characters/{character_id} - Get specific character
- POST /characters - Create new character
- POST /characters/upload-avatar - Upload character avatar
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth.routes import get_current_user
from services.character_service import CharacterService, CharacterServiceError
from services.upload_service import UploadService
from services.character_gallery_service import CharacterGalleryService
from services.avatar_generation_service import AvatarGenerationService
from schemas import Character as CharacterSchema, CharacterCreate, CharacterUpdate, DefaultAvatar
from models import User
from routes.admin import is_admin
from pathlib import Path
import os

# Create router with prefix and tags
router = APIRouter(prefix="/characters", tags=["characters"])

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


@router.get("/default-avatars")
async def get_default_avatars():
    """Get list of default avatar options for character creation"""
    try:
        # Define default avatars with metadata
        default_avatars = [
            {
                "id": "elara",
                "name": "Elara",
                "url": "/assets/characters_img/Elara.jpeg",
                "thumbnail_url": "/assets/characters_img/Elara.jpeg",
                "category": "female_safe",
                "gender": "female",
                "style": "Fantasy Elf",
                "nsfw_level": 0
            },
            {
                "id": "elarad",
                "name": "Elarad",
                "url": "/assets/characters_img/Elarad.jpeg",
                "thumbnail_url": "/assets/characters_img/Elarad.jpeg",
                "category": "male_safe",
                "gender": "male",
                "style": "Fantasy Warrior",
                "nsfw_level": 0
            },
            {
                "id": "huangrong_1",
                "name": "Huang Rong (Style 1)",
                "url": "/assets/characters_img/黄蓉1.png",
                "thumbnail_url": "/assets/characters_img/黄蓉1.png",
                "category": "female_safe",
                "gender": "female",
                "style": "Traditional Chinese",
                "nsfw_level": 0
            },
            {
                "id": "huangrong_2",
                "name": "Huang Rong (Style 2)",
                "url": "/assets/characters_img/黄蓉2.png",
                "thumbnail_url": "/assets/characters_img/黄蓉2.png",
                "category": "female_safe",
                "gender": "female",
                "style": "Traditional Chinese",
                "nsfw_level": 0
            },
            {
                "id": "huangrong_9",
                "name": "Huang Rong (Style 9)",
                "url": "/assets/characters_img/黄蓉9.png",
                "thumbnail_url": "/assets/characters_img/黄蓉9.png",
                "category": "female_safe",
                "gender": "female",
                "style": "Traditional Chinese",
                "nsfw_level": 0
            },
            {
                "id": "huangrong_10",
                "name": "Huang Rong (Style 10)",
                "url": "/assets/characters_img/黄蓉10.png",
                "thumbnail_url": "/assets/characters_img/黄蓉10.png",
                "category": "female_safe",
                "gender": "female",
                "style": "Traditional Chinese",
                "nsfw_level": 0
            }
        ]

        return {"avatars": default_avatars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get default avatars: {str(e)}")


@router.get("")
async def get_characters(db: Session = Depends(get_db)):
    """Get all characters with creator usernames"""
    try:
        service = CharacterService(db)
        characters = await service.get_all_characters()
        return characters
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{character_id}")
async def get_character(character_id: int, db: Session = Depends(get_db)):
    """Get character by ID with creator username"""
    try:
        service = CharacterService(db)
        character = await service.get_character(character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        return character
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_character(
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new character"""
    try:
        service = CharacterService(db)
        success, character, error = await service.create_character(character_data, current_user.id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        # Return the raw dict directly to bypass Pydantic schema conversion
        return character
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-avatar")
@limiter.limit("5/minute")  # Maximum 5 generations per minute per IP
@limiter.limit("20/hour")   # Maximum 20 generations per hour per IP
async def generate_character_avatar(
    request: Request,
    prompt: str = Form(...),
    character_name: str = Form(...),
    gender: str = Form("female"),
    style: str = Form("fantasy"),
    current_user: User = Depends(get_current_user)
):
    """
    Generate character avatar using AI (Perchance)

    Args:
        prompt: Description or custom prompt for avatar generation
        character_name: Character name (used for filename)
        gender: Character gender (female/male/neutral)
        style: Art style (fantasy/realistic/anime/chinese/scifi/medieval)

    Returns:
        Generated avatar URL

    Rate Limits:
        - 5 generations per minute per IP
        - 20 generations per hour per IP
    """
    try:
        service = AvatarGenerationService()
        success, avatar_url, error = await service.generate_avatar(
            prompt=prompt,
            character_name=character_name,
            gender=gender,
            style=style
        )

        if not success:
            raise HTTPException(status_code=500, detail=error or "Failed to generate avatar")

        return {
            "avatarUrl": avatar_url,
            "message": "Avatar generated successfully",
            "style": style,
            "gender": gender
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Avatar generation failed: {str(e)}")


@router.post("/upload-avatar")
@limiter.limit("10/minute")  # Maximum 10 uploads per minute per IP
@limiter.limit("100/hour")   # Maximum 100 uploads per hour per IP
async def upload_character_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload character avatar with security validation.
    
    Security Features:
    - File type validation (MIME + magic bytes)
    - Size limits (5MB maximum)
    - Image dimension validation (4096x4096 max)
    - Auto-resize for optimization (>1024px)
    - Rate limiting (10/min, 100/hour per IP)
    - Secure filename generation
    - Path traversal protection
    """
    try:
        upload_service = UploadService()
        success, upload_data, error = await upload_service.process_avatar_upload(
            file, current_user.id, request, "character_avatar"
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return upload_data
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Upload processing failed")


# Character Gallery Routes

@router.get("/{character_id}/gallery")
async def get_character_gallery(
    character_id: int,
    db: Session = Depends(get_db)
):
    """Get character gallery data with all images"""
    try:
        gallery_service = CharacterGalleryService(db)
        # For user-facing gallery, ensure avatar/profile appears first in images
        gallery_data = await gallery_service.get_character_gallery(character_id, include_avatar_in_images=True)
        return gallery_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get character gallery: {str(e)}")


@router.post("/{character_id}/gallery/images")
@limiter.limit("10/minute")
async def upload_gallery_image(
    request: Request,
    character_id: int,
    file: UploadFile = File(...),
    category: str = Form("general"),
    is_primary: bool = Form(False),
    alt_text: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload new image to character gallery (admin only)"""
    try:
        # Admin authorization required for gallery management
        if not is_admin(current_user):
            raise HTTPException(status_code=403, detail="Admin access required for gallery management")
        
        # Process image upload
        upload_service = UploadService()
        success, upload_data, error = await upload_service.process_avatar_upload(
            file, current_user.id, request, "character_gallery", character_id
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        # Create gallery image record
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
        
        success, gallery_image_data, error = await gallery_service.add_gallery_image(
            character_id, image_data, current_user.id, is_primary
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return {
            "message": "Gallery image uploaded successfully",
            "image": gallery_image_data,
            "upload_info": upload_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gallery image upload failed: {str(e)}")


@router.put("/{character_id}/gallery/images/{image_id}/primary")
async def set_primary_gallery_image(
    character_id: int,
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set a gallery image as the primary image (admin only)"""
    # Admin authorization required
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required for gallery management")
    
    try:
        gallery_service = CharacterGalleryService(db)
        success, error = await gallery_service.update_primary_image(character_id, image_id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return {"message": f"Image {image_id} set as primary for character {character_id}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set primary image: {str(e)}")


@router.delete("/{character_id}/gallery/images/{image_id}")
async def delete_gallery_image(
    character_id: int,
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a gallery image (soft delete, admin only)"""
    # Admin authorization required
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required for gallery management")
    
    try:
        gallery_service = CharacterGalleryService(db)
        success, error = await gallery_service.delete_gallery_image(character_id, image_id)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return {"message": f"Gallery image {image_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete gallery image: {str(e)}")


class ImageOrderItem(BaseModel):
    image_id: int
    display_order: int

@router.put("/{character_id}/gallery/reorder")
async def reorder_gallery_images(
    character_id: int,
    image_order: List[ImageOrderItem],  # Validated payload
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder gallery images (admin only)"""
    # Admin authorization required
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required for gallery management")
    
    try:
        gallery_service = CharacterGalleryService(db)
        # Convert to list[dict] for service compatibility
        payload = [item.dict() for item in image_order]
        success, error = await gallery_service.reorder_gallery_images(character_id, payload)
        
        if not success:
            raise HTTPException(status_code=400, detail=error)
        
        return {"message": f"Gallery images reordered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reorder gallery images: {str(e)}")


# User Character Management Routes

@router.get("/users/me")
async def get_my_characters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get characters created by the current user"""
    try:
        service = CharacterService(db)
        characters = await service.get_user_characters(current_user.id)
        return characters
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{character_id}")
async def update_character(
    character_id: int,
    character_data: CharacterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update character (owner or admin only)"""
    try:
        service = CharacterService(db)
        success, character, error = await service.update_character(
            character_id, character_data, current_user.id, is_admin(current_user)
        )
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            elif "can only edit" in error or "can only modify" in error:
                raise HTTPException(status_code=403, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return character
    except HTTPException:
        raise
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{character_id}/publish")
async def toggle_character_publish(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle character public/private status (owner or admin only)"""
    try:
        service = CharacterService(db)
        success, character, error = await service.toggle_character_publish(
            character_id, current_user.id, is_admin(current_user)
        )
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            elif "can only" in error:
                raise HTTPException(status_code=403, detail=error)
            else:
                raise HTTPException(status_code=400, detail=error)
        
        return character
    except HTTPException:
        raise
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{character_id}")
async def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete character (owner or admin only)"""
    try:
        service = CharacterService(db)
        success, error = await service.delete_character(
            character_id, current_user.id, is_admin(current_user)
        )
        
        if not success:
            if error == "Character not found":
                raise HTTPException(status_code=404, detail=error)
            elif "can only delete" in error:
                raise HTTPException(status_code=403, detail=error)
            elif "Cannot delete character" in error:
                raise HTTPException(status_code=400, detail=error)
            else:
                raise HTTPException(status_code=500, detail=error)
        
        return {"message": f"Character {character_id} deleted successfully"}
    except HTTPException:
        raise
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gallery/stats")
async def get_gallery_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall gallery statistics (admin only)"""
    # Admin authorization required
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required for gallery management")
    
    try:
        gallery_service = CharacterGalleryService(db)
        stats = await gallery_service.get_gallery_stats()
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get gallery stats: {str(e)}")
