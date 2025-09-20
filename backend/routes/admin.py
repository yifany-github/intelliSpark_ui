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

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from pathlib import Path
import yaml
import shutil
import logging

from database import get_db
from auth.routes import get_current_user
from services.ai_model_manager import get_ai_model_manager, ModelProvider
from services.story_service import StoryService
from models import User
from pydantic import BaseModel
from schemas import StoryMetadataSchema
from admin.routes import verify_admin_token

STORY_STORAGE_PATH = Path(__file__).resolve().parent.parent / "story_engine" / "stories"
STORY_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

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


class StoryPackBase(BaseModel):
    title: Optional[str] = None
    locale: Optional[str] = None
    coverImage: Optional[str] = None


class StoryPackCreateRequest(StoryPackBase):
    id: str
    title: str
    storyYaml: str
    rolesYaml: str
    rulesYaml: Optional[str] = None


class StoryPackUpdateRequest(StoryPackBase):
    storyYaml: str
    rolesYaml: str
    rulesYaml: Optional[str] = None


class StoryPackDetailResponse(BaseModel):
    metadata: StoryMetadataSchema
    storyYaml: str
    rolesYaml: str
    rulesYaml: Optional[str] = None

def is_admin(current_user: User) -> bool:
    """
    Check if current user has admin privileges
    
    Uses the is_admin field in the User model for secure role-based access control.
    """
    return getattr(current_user, 'is_admin', False)


def _normalize_story_id(raw_id: str) -> str:
    story_id = (raw_id or "").strip()
    if not story_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Story id cannot be empty")
    normalized = story_id.lower()
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-_")
    if any(ch not in allowed for ch in normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Story id must contain only lowercase letters, numbers, hyphen, or underscore",
        )
    return normalized


def _load_yaml_from_string(content: str, context: str) -> Dict[str, Any]:
    try:
        loaded = yaml.safe_load(content) or {}
    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid YAML provided for {context}: {exc}"
        ) from exc
    if not isinstance(loaded, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{context} must be a YAML mapping",
        )
    return loaded


def _write_yaml_file(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(data, handle, allow_unicode=True, sort_keys=False)


def _write_raw_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        handle.write(content if content.endswith("\n") else f"{content}\n")


def _read_text(path: Path) -> str:
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story file not found")
    return path.read_text(encoding="utf-8")


@router.get("/stories", response_model=List[StoryMetadataSchema])
def admin_list_stories(
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token),
):
    service = StoryService(db)
    metadata = service.list_stories()
    return [
        StoryMetadataSchema.model_validate(meta.model_dump(by_alias=True))
        for meta in metadata
    ]


@router.get("/stories/{story_id}", response_model=StoryPackDetailResponse)
def admin_get_story(
    story_id: str,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token),
):
    normalized_id = _normalize_story_id(story_id)
    story_dir = STORY_STORAGE_PATH / normalized_id
    story_yaml = _read_text(story_dir / "story.yaml")
    roles_yaml = _read_text(story_dir / "roles.yaml")
    rules_path = story_dir / "rules.yaml"
    rules_yaml = rules_path.read_text(encoding="utf-8") if rules_path.exists() else None

    service = StoryService(db)
    pack = service.get_story(normalized_id)
    start_scene = next((scene for scene in pack.scenes if scene.id == pack.start_scene), None)
    metadata_payload = {
        "id": pack.id,
        "title": pack.title,
        "locale": pack.locale,
        "startScene": pack.start_scene,
        "summary": getattr(start_scene, "desc", None),
        "coverImage": getattr(pack, "cover_image", None),
        "roles": [
            {
                "id": role.id,
                "name": role.name,
                "traits": list(role.traits or []),
                "inventory": list(role.inventory or []),
            }
            for role in pack.roles
        ],
    }

    return StoryPackDetailResponse(
        metadata=StoryMetadataSchema.model_validate(metadata_payload),
        storyYaml=story_yaml,
        rolesYaml=roles_yaml,
        rulesYaml=rules_yaml,
    )


@router.post("/stories", response_model=StoryMetadataSchema, status_code=status.HTTP_201_CREATED)
def admin_create_story(
    payload: StoryPackCreateRequest,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token),
):
    story_id = _normalize_story_id(payload.id)
    story_dir = STORY_STORAGE_PATH / story_id
    if story_dir.exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Story id already exists")

    story_data = _load_yaml_from_string(payload.storyYaml, "story blueprint")
    roles_data = _load_yaml_from_string(payload.rolesYaml, "roles definition")
    if "roles" not in roles_data or not isinstance(roles_data.get("roles"), list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="roles.yaml must define a 'roles' list")

    story_data["id"] = story_id
    story_data["title"] = payload.title
    if payload.locale is not None:
        story_data["locale"] = payload.locale
    if payload.coverImage is not None:
        story_data["coverImage"] = payload.coverImage

    _write_yaml_file(story_dir / "story.yaml", story_data)
    _write_yaml_file(story_dir / "roles.yaml", roles_data)

    if payload.rulesYaml and payload.rulesYaml.strip():
        rules_data = _load_yaml_from_string(payload.rulesYaml, "rules definition")
        _write_yaml_file(story_dir / "rules.yaml", rules_data)

    service = StoryService(db)
    service.refresh_cache()
    metadata = service.list_stories()
    created = next((meta for meta in metadata if meta.id == story_id), None)
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load created story")
    return StoryMetadataSchema.model_validate(created.model_dump(by_alias=True))


@router.put("/stories/{story_id}", response_model=StoryMetadataSchema)
def admin_update_story(
    story_id: str,
    payload: StoryPackUpdateRequest,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token),
):
    normalized_id = _normalize_story_id(story_id)
    story_dir = STORY_STORAGE_PATH / normalized_id
    if not story_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    story_data = _load_yaml_from_string(payload.storyYaml, "story blueprint")
    roles_data = _load_yaml_from_string(payload.rolesYaml, "roles definition")
    if "roles" not in roles_data or not isinstance(roles_data.get("roles"), list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="roles.yaml must define a 'roles' list")

    story_data["id"] = normalized_id
    if "title" in payload.model_fields_set and payload.title is not None:
        story_data["title"] = payload.title
    if "locale" in payload.model_fields_set:
        story_data["locale"] = payload.locale
    if "coverImage" in payload.model_fields_set:
        story_data["coverImage"] = payload.coverImage

    _write_yaml_file(story_dir / "story.yaml", story_data)
    _write_yaml_file(story_dir / "roles.yaml", roles_data)

    rules_path = story_dir / "rules.yaml"
    if "rulesYaml" in payload.model_fields_set:
        if payload.rulesYaml and payload.rulesYaml.strip():
            rules_data = _load_yaml_from_string(payload.rulesYaml, "rules definition")
            _write_yaml_file(rules_path, rules_data)
        elif rules_path.exists():
            rules_path.unlink()

    service = StoryService(db)
    service.refresh_cache()
    metadata = service.list_stories()
    updated = next((meta for meta in metadata if meta.id == normalized_id), None)
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load updated story")
    return StoryMetadataSchema.model_validate(updated.model_dump(by_alias=True))


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_story(
    story_id: str,
    db: Session = Depends(get_db),
    _: HTTPAuthorizationCredentials = Depends(verify_admin_token),
):
    normalized_id = _normalize_story_id(story_id)
    story_dir = STORY_STORAGE_PATH / normalized_id
    if not story_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    shutil.rmtree(story_dir)
    service = StoryService(db)
    service.refresh_cache()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

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
