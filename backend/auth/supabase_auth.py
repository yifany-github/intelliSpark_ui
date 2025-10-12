"""Supabase authentication helpers for verifying access tokens and syncing users."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from models import User

logger = logging.getLogger(__name__)

_SUPABASE_JWT_ALGORITHM = "HS256"
_LOGIN_UPDATE_INTERVAL_MINUTES = 10


def decode_supabase_token(token: str) -> Dict[str, Any]:
    """Decode and verify a Supabase JWT access token."""
    secret = settings.supabase_jwt_secret
    if not secret:
        logger.error("Supabase JWT secret missing; cannot verify access token")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase authentication not configured",
        )

    audience = settings.supabase_jwt_audience
    options: Optional[Dict[str, Any]] = None
    kwargs: Dict[str, Any] = {}
    if audience:
        kwargs["audience"] = audience
    else:
        options = {"verify_aud": False}

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[_SUPABASE_JWT_ALGORITHM],
            options=options,
            **kwargs,
        )
    except JWTError as exc:  # pragma: no cover - jose normalises errors
        logger.warning("Failed Supabase token verification: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return payload


def sync_user_from_supabase_payload(db: Session, payload: Dict[str, Any]) -> User:
    """Ensure a local User exists for the Supabase identity referenced in the payload."""
    supabase_user_id = payload.get("sub")
    email = _normalise_email(payload.get("email"))
    provider = _extract_provider(payload)
    metadata = _extract_user_metadata(payload)

    # Prefer explicit username metadata, otherwise derive from email or user id
    raw_username = metadata.get("username") or metadata.get("preferred_username")
    if not raw_username:
        raw_username = metadata.get("full_name") or metadata.get("name")
    username_hint = raw_username or (email.split("@")[0] if email else None) or _short_id(supabase_user_id)

    user: Optional[User] = None
    if supabase_user_id:
        user = db.query(User).filter(User.auth_user_id == supabase_user_id).first()

    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user and supabase_user_id and user.auth_user_id != supabase_user_id:
            user.auth_user_id = supabase_user_id

    created = False
    needs_commit = False

    if not user:
        generated_username = _ensure_unique_username(db, username_hint)
        user = User(
            username=generated_username,
            email=email,
            password="",  # Supabase manages passwords; keep legacy column non-null
            provider=provider,
            auth_user_id=supabase_user_id,
            email_verified=_is_email_verified(payload),
        )
        db.add(user)
        created = True
        needs_commit = True
    else:
        if supabase_user_id and user.auth_user_id != supabase_user_id:
            user.auth_user_id = supabase_user_id
            needs_commit = True
        if email and user.email != email:
            user.email = email
            needs_commit = True
        if provider and user.provider != provider:
            user.provider = provider
            needs_commit = True
        if _is_email_verified(payload) and not user.email_verified:
            user.email_verified = True
            needs_commit = True

    if needs_commit:
        try:
            db.commit()
        except Exception as exc:
            db.rollback()

            # Handle unique constraint races gracefully by refetching the persisted row
            from sqlalchemy.exc import IntegrityError

            if isinstance(exc, IntegrityError):
                lookup = None
                if supabase_user_id:
                    lookup = db.query(User).filter(User.auth_user_id == supabase_user_id).first()
                if not lookup and email:
                    lookup = db.query(User).filter(User.email == email).first()
                if lookup:
                    user = lookup
                else:
                    raise
            else:
                raise
        db.refresh(user)

    if created:
        _assign_welcome_tokens(db, user.id)

    return user


def ensure_user_is_active(user: Optional[User]) -> None:
    """Raise if the user account is suspended."""
    if not user:
        return
    if getattr(user, "is_suspended", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact support.",
        )


def record_successful_login(db: Session, user: Optional[User], client_ip: Optional[str]) -> None:
    """Record metadata about a successful authenticated request."""
    if not user:
        return

    now = datetime.now(timezone.utc)
    last_login_at = user.last_login_at
    if last_login_at is not None:
        if last_login_at.tzinfo is None:
            last_login_at = last_login_at.replace(tzinfo=timezone.utc)
        if now - last_login_at < timedelta(minutes=_LOGIN_UPDATE_INTERVAL_MINUTES):
            return

    user.last_login_at = now
    if client_ip:
        user.last_login_ip = client_ip

    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


# --- internal helpers -----------------------------------------------------

def _assign_welcome_tokens(db: Session, user_id: int) -> None:
    try:
        from payment.token_service import TokenService  # Local import to avoid cycle

        token_service = TokenService(db)
        token_service.add_tokens(user_id, 10, "Welcome bonus - 10 free tokens")
    except Exception as exc:
        logger.warning("Failed to assign welcome tokens to user %s: %s", user_id, exc)


def _ensure_unique_username(db: Session, base_username: Optional[str]) -> str:
    base = _sanitise_username(base_username) if base_username else "user"
    candidate = base
    counter = 1

    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base}_{counter}"
        counter += 1

    return candidate


def _sanitise_username(username: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", username).strip("_")
    return cleaned.lower() or "user"


def _extract_provider(payload: Dict[str, Any]) -> str:
    app_metadata = payload.get("app_metadata") or {}
    provider = app_metadata.get("provider") or payload.get("provider")
    if isinstance(provider, str) and provider:
        return provider
    return "supabase"


def _extract_user_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    metadata = payload.get("user_metadata") or payload.get("userMeta") or {}
    if not isinstance(metadata, dict):
        return {}
    return metadata


def _is_email_verified(payload: Dict[str, Any]) -> bool:
    if payload.get("email_confirmed") or payload.get("email_confirmed_at"):
        return True
    app_metadata = payload.get("app_metadata") or {}
    if app_metadata.get("email_confirmed") or app_metadata.get("email_confirmed_at"):
        return True
    return False


def _normalise_email(raw: Any) -> Optional[str]:
    if isinstance(raw, str):
        return raw.strip().lower() or None
    return None


def _short_id(identifier: Optional[str]) -> str:
    if isinstance(identifier, str) and identifier:
        return identifier[:8]
    return "user"
