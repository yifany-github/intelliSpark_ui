"""
Admin Routes for IntelliSpark AI Chat Application

This module contains administrative routes for managing the application,
including AI model configuration and system settings.

Routes:
- GET /admin/ai-models/status - Get status of all AI models
- POST /admin/ai-models/{model}/enable - Enable/disable specific AI model
- POST /admin/ai-models/default - Set default AI model
- GET /admin/ai-models/settings - Get admin AI settings
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging

from database import get_db
from auth.routes import get_current_user
from backend.services.ai_model_manager import get_ai_model_manager, ModelProvider
from models import User
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Create router with prefix and tags
router = APIRouter(prefix="/admin", tags=["admin"])

# Pydantic models for request/response
class ModelToggleRequest(BaseModel):
    enabled: bool

class DefaultModelRequest(BaseModel):
    model: str

class ModelStatusResponse(BaseModel):
    models: Dict[str, Dict[str, Any]]
    settings: Dict[str, Any]

def is_admin(current_user: User) -> bool:
    """
    Check if current user has admin privileges
    
    Uses the is_admin field in the User model for secure role-based access control.
    """
    return getattr(current_user, 'is_admin', False)

@router.get("/ai-models/status", response_model=ModelStatusResponse)
async def get_ai_models_status(
    current_user: User = Depends(get_current_user)
):
    """Get status of all AI models (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        ai_manager = await get_ai_model_manager()
        model_status = ai_manager.get_model_status()
        admin_settings = ai_manager.get_admin_settings()
        
        return ModelStatusResponse(
            models=model_status,
            settings=admin_settings
        )
    except Exception as e:
        logger.error(f"Error getting AI model status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI model status")

@router.post("/ai-models/{model}/toggle")
async def toggle_ai_model(
    model: str,
    request: ModelToggleRequest,
    current_user: User = Depends(get_current_user)
):
    """Enable or disable specific AI model (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Validate model name
        try:
            model_provider = ModelProvider(model)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid model: {model}")
        
        ai_manager = await get_ai_model_manager()
        success = ai_manager.set_model_enabled(model_provider, request.enabled)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to {'enable' if request.enabled else 'disable'} model {model}")
        
        action = "enabled" if request.enabled else "disabled"
        logger.info(f"Admin {current_user.username} {action} AI model: {model}")
        
        return {"message": f"Model {model} {action} successfully", "model": model, "enabled": request.enabled}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling AI model {model}: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle AI model")

@router.post("/ai-models/default")
async def set_default_ai_model(
    request: DefaultModelRequest,
    current_user: User = Depends(get_current_user)
):
    """Set default AI model (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Validate model name
        try:
            model_provider = ModelProvider(request.model)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid model: {request.model}")
        
        ai_manager = await get_ai_model_manager()
        success = ai_manager.set_default_model(model_provider)
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to set default model to {request.model}")
        
        logger.info(f"Admin {current_user.username} set default AI model to: {request.model}")
        
        return {"message": f"Default model set to {request.model} successfully", "default_model": request.model}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting default AI model to {request.model}: {e}")
        raise HTTPException(status_code=500, detail="Failed to set default AI model")

@router.get("/ai-models/settings")
async def get_ai_admin_settings(
    current_user: User = Depends(get_current_user)
):
    """Get admin AI settings (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        ai_manager = await get_ai_model_manager()
        settings = ai_manager.get_admin_settings()
        
        return {"settings": settings}
        
    except Exception as e:
        logger.error(f"Error getting admin AI settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to get admin settings")

@router.get("/system/info")
async def get_system_info(
    current_user: User = Depends(get_current_user)
):
    """Get system information (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        ai_manager = await get_ai_model_manager()
        model_status = ai_manager.get_model_status()
        
        # Count available models
        available_models = sum(1 for status in model_status.values() if status["is_available"])
        total_models = len(model_status)
        
        system_info = {
            "ai_models": {
                "total": total_models,
                "available": available_models,
                "models": model_status
            },
            "admin_user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email
            }
        }
        
        return {"system_info": system_info}
        
    except Exception as e:
        logger.error(f"Error getting system info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system information")
