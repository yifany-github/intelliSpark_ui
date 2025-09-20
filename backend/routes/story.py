"""Story-related API routes for multi-role sessions."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.routes import get_current_user
from database import get_db
from models import StorySession, User
from schemas import (
    StoryMetadataSchema,
    StorySessionCreateRequest,
    StorySessionResponse,
    StoryTurnRequest,
    StoryTurnResponse,
)
try:
    from services.story_service import (
        StoryPackNotFound,
        StoryService,
        StoryServiceError,
        StorySessionNotFound,
    )
except ModuleNotFoundError:  # pragma: no cover - fallback for packaged imports
    from backend.services.story_service import (
        StoryPackNotFound,
        StoryService,
        StoryServiceError,
        StorySessionNotFound,
    )

router = APIRouter(tags=["stories"])


def _get_service(db: Session) -> StoryService:
    return StoryService(db)


def _ensure_session_owner(session: StorySession, user: User) -> None:
    if session.user_id and session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _session_to_dict(
    session: StorySession,
    choices: Optional[List[Dict[str, Any]]] = None,
    intro: Optional[Any] = None,
) -> Dict[str, Any]:
    state_data = session.state or {}
    intro_background = None
    intro_role = None

    if intro is not None:
        intro_background = getattr(intro, "background", None) or getattr(intro, "intro_narration", None)
        intro_role = getattr(intro, "role_intro", None) or getattr(intro, "roleIntro", None)

    if isinstance(state_data, dict):
        variables = state_data.get("variables") if isinstance(state_data.get("variables"), dict) else {}
        meta = variables.get("__meta") if isinstance(variables.get("__meta"), dict) else {}
        stored_intro = meta.get("intro") if isinstance(meta.get("intro"), dict) else {}
        intro_background = intro_background or stored_intro.get("background")
        intro_role = intro_role or stored_intro.get("roleIntro")

    return {
        "id": str(session.id),
        "storyId": session.story_id,
        "userRole": session.user_role,
        "state": session.state,
        "createdAt": session.created_at,
        "updatedAt": session.updated_at,
        "choices": choices or [],
        "introNarration": intro_background,
        "roleIntro": intro_role,
    }


@router.get("/stories", response_model=List[StoryMetadataSchema])
def list_stories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = _get_service(db)
    metadata = service.list_stories()
    return [
        StoryMetadataSchema.model_validate(meta.model_dump(by_alias=True))
        for meta in metadata
    ]


@router.post("/stories/{story_id}/sessions", response_model=StorySessionResponse)
def create_story_session(
    story_id: str,
    payload: StorySessionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = _get_service(db)
    try:
        session, intro = service.create_session(
            story_id=story_id,
            user_id=current_user.id,
            user_role=payload.userRole or None,
            user=current_user,
        )
    except StoryPackNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except StoryServiceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    choices = service.get_available_choices(session)
    return StorySessionResponse.model_validate(_session_to_dict(session, choices, intro))


@router.get("/story-sessions/{session_id}", response_model=StorySessionResponse)
def get_story_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = _get_service(db)
    try:
        session = service.get_session(session_id)
    except StorySessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    _ensure_session_owner(session, current_user)
    choices = service.get_available_choices(session)
    return StorySessionResponse.model_validate(_session_to_dict(session, choices))


@router.post("/story-sessions/{session_id}/turn", response_model=StoryTurnResponse)
def submit_story_turn(
    session_id: str,
    payload: StoryTurnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = _get_service(db)
    try:
        session = service.get_session(session_id)
    except StorySessionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    _ensure_session_owner(session, current_user)

    try:
        result = service.run_turn(
            session_id=session.id,
            user_role=payload.userRole or session.user_role or current_user.username,
            user_text=payload.text,
            user=current_user,
        )
    except StoryServiceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return StoryTurnResponse.model_validate(result.model_dump(by_alias=True))
