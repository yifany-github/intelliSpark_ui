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

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from auth.routes import get_current_user
from services.character_service import CharacterService, CharacterServiceError
from services.upload_service import UploadService
from schemas import Character as CharacterSchema, CharacterCreate
from models import User

# Create router with prefix and tags
router = APIRouter(prefix="/characters", tags=["characters"])

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


@router.get("")
async def get_characters(db: Session = Depends(get_db)):
    """Get all characters"""
    try:
        service = CharacterService(db)
        return await service.get_all_characters()
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{character_id}", response_model=CharacterSchema)
async def get_character(character_id: int, db: Session = Depends(get_db)):
    """Get character by ID"""
    try:
        service = CharacterService(db)
        character = await service.get_character(character_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        return character
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=CharacterSchema)
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
        
        return character
    except CharacterServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))


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