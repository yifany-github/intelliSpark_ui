"""
User Preferences Routes for IntelliSpark AI Chat Application

This module handles user preference management, including AI model selection
and other personalization settings.

Routes:
- GET /preferences - Get user preferences
- POST /preferences/ai-model - Set preferred AI model
- GET /available-models - Get available AI models for selection
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import logging

from database import get_db
from auth.routes import get_current_user
from backend.services.ai_model_manager import get_ai_model_manager, ModelProvider
from models import User
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router with prefix and tags
router = APIRouter(prefix="/preferences", tags=["user-preferences"])

# Pydantic models
class AIModelPreferenceRequest(BaseModel):
    model: str

class UserPreferencesResponse(BaseModel):
    preferred_ai_model: str
    memory_enabled: bool
    user_id: int
    username: str

class AvailableModelInfo(BaseModel):
    value: str
    name: str
    description: str
    is_available: bool
    is_default: bool

class AvailableModelsResponse(BaseModel):
    models: List[AvailableModelInfo]
    user_preferred: str

@router.get("", response_model=UserPreferencesResponse)
async def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user preferences including AI model selection"""
    try:
        return UserPreferencesResponse(
            preferred_ai_model=current_user.preferred_ai_model or 'gemini',
            memory_enabled=current_user.memory_enabled,
            user_id=current_user.id,
            username=current_user.username
        )
    except Exception as e:
        logger.error(f"Error getting user preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user preferences")

@router.post("/ai-model")
async def set_preferred_ai_model(
    request: AIModelPreferenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set user's preferred AI model"""
    try:
        # Validate model name
        try:
            ModelProvider(request.model)  # This will raise ValueError if invalid
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid AI model: {request.model}")
        
        # Check if model is available and enabled
        ai_manager = await get_ai_model_manager()
        model_status = ai_manager.get_model_status()
        
        if request.model not in model_status:
            raise HTTPException(status_code=400, detail=f"Unknown AI model: {request.model}")
        
        model_info = model_status[request.model]
        if not model_info["enabled"]:
            raise HTTPException(status_code=400, detail=f"AI model {request.model} is currently disabled")
        
        if not model_info["is_available"]:
            raise HTTPException(status_code=400, detail=f"AI model {request.model} is currently unavailable")
        
        # Update user preference with proper transaction handling
        try:
            current_user.preferred_ai_model = request.model
            db.commit()
            db.refresh(current_user)
            
            logger.info(f"User {current_user.username} set preferred AI model to: {request.model}")
            
            return {
                "message": f"Preferred AI model set to {request.model}",
                "preferred_model": request.model,
                "model_name": model_info["service_name"]
            }
        except Exception as db_error:
            db.rollback()
            logger.error(f"Database error while setting preferred AI model: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to save preferred AI model")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting preferred AI model: {e}")
        raise HTTPException(status_code=500, detail="Failed to set preferred AI model")

@router.get("/available-models", response_model=AvailableModelsResponse)
async def get_available_ai_models(
    current_user: User = Depends(get_current_user)
):
    """Get list of available AI models for user selection"""
    try:
        ai_manager = await get_ai_model_manager()
        model_status = ai_manager.get_model_status()
        admin_settings = ai_manager.get_admin_settings()
        
        available_models = []
        
        # Model descriptions for user-friendly display
        model_descriptions = {
            "gemini": "Google Gemini - Advanced conversational AI with excellent character roleplay capabilities",
            "grok": "xAI Grok - Alternative AI model with unique personality and different conversation style"
        }
        
        for model_key, status_info in model_status.items():
            # Only show enabled models to users
            if status_info["enabled"]:
                available_models.append(AvailableModelInfo(
                    value=model_key,
                    name=status_info["service_name"],
                    description=model_descriptions.get(model_key, f"{status_info['service_name']} AI model"),
                    is_available=status_info["is_available"],
                    is_default=status_info["is_default"]
                ))
        
        # Sort by availability first, then by default status
        available_models.sort(key=lambda x: (not x.is_available, not x.is_default))
        
        user_preferred = current_user.preferred_ai_model or admin_settings["default_model"]
        
        return AvailableModelsResponse(
            models=available_models,
            user_preferred=user_preferred
        )
        
    except Exception as e:
        logger.error(f"Error getting available AI models: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available AI models")

@router.post("/memory-enabled")
async def set_memory_enabled(
    enabled: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set user's memory enabled preference"""
    try:
        # Update memory preference with proper transaction handling
        try:
            current_user.memory_enabled = enabled
            db.commit()
            db.refresh(current_user)
            
            logger.info(f"User {current_user.username} set memory enabled to: {enabled}")
            
            return {
                "message": f"Memory {'enabled' if enabled else 'disabled'}",
                "memory_enabled": enabled
            }
        except Exception as db_error:
            db.rollback()
            logger.error(f"Database error while setting memory preference: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to save memory preference")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting memory enabled: {e}")
        raise HTTPException(status_code=500, detail="Failed to set memory preference")
