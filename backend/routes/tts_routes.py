"""TTS Routes for generating speech audio from AI chat messages."""

import json
import logging
import os
from typing import Optional

import anyio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.routes import get_current_user
from config import settings
from google.genai import types
from database import SessionLocal, get_async_db
from models import Chat, ChatMessage, Character, User
from payment.token_service import TokenService
from prompts.tts_prompt import build_tts_prompt
from services.gemini_service_new import GeminiService, AIServiceError
from services.upload_service import UploadService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat/messages", tags=["tts"])

TTS_TOKEN_COST = 20
TTS_BLOCKED_STATUS = "blocked"
TTS_READY_STATUS = "ready"
TTS_FAILED_STATUS = "failed"


def _parse_state_snapshot(raw_snapshot: Optional[str]) -> dict:
    if not raw_snapshot:
        return {}
    try:
        parsed = json.loads(raw_snapshot)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    if isinstance(parsed, dict):
        return parsed
    return {}


def _normalize_state_value(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    if value <= 0:
        return 0.0
    if value <= 1:
        return min(1.0, value)
    if value <= 10:
        return value / 10
    if value <= 100:
        return value / 100
    return min(1.0, value / 100)


def _read_state_number(snapshot: dict, key: str) -> Optional[float]:
    value = snapshot.get(key)
    if isinstance(value, dict):
        raw = value.get("value")
        if isinstance(raw, (int, float)):
            return _normalize_state_value(float(raw))
        return None
    if isinstance(value, (int, float)):
        return _normalize_state_value(float(value))
    return None


def _read_state_text(snapshot: dict, key: str) -> Optional[str]:
    value = snapshot.get(key)
    if isinstance(value, dict):
        raw = value.get("description") or value.get("value")
        if isinstance(raw, str):
            return raw.strip()
        return None
    if isinstance(value, str):
        return value.strip()
    return None


def _derive_tone_hints(snapshot: dict, character: Optional[Character]) -> list[str]:
    hints: list[str] = []

    def add_hint(text: str) -> None:
        normalized = text.strip()
        if normalized and normalized not in hints:
            hints.append(normalized)

    for key in ("语气", "情绪"):
        text_hint = _read_state_text(snapshot, key)
        if text_hint:
            add_hint(text_hint)

    excitement = _read_state_number(snapshot, "兴奋度")
    desire = _read_state_number(snapshot, "欲望值")
    fatigue = _read_state_number(snapshot, "疲惫度")
    trust = _read_state_number(snapshot, "信任度")
    favor = _read_state_number(snapshot, "好感度")

    if excitement is not None and excitement >= 0.7:
        add_hint("兴奋、娇喘更明显、语速略快、声线更黏")
    if desire is not None and desire >= 0.7:
        add_hint("欲望强烈、低哑、喘息明显、挑逗")
    if fatigue is not None and fatigue >= 0.7:
        add_hint("慵懒、气息更轻")
    if trust is not None and trust >= 0.7:
        add_hint("亲密、依恋、语气更软")
    if favor is not None and favor >= 0.7:
        add_hint("撒娇、黏人、亲昵")

    if character and getattr(character, "nsfw_level", 0) > 0:
        add_hint("语气淫靡、性感、露骨挑逗")

    return hints


def _select_voice_name(character: Optional[Character]) -> Optional[str]:
    env_default = os.getenv("GEMINI_TTS_VOICE", "").strip()
    if env_default:
        return env_default

    if not character or not getattr(character, "gender", None):
        return None

    gender = str(character.gender).strip().lower()
    age_value = getattr(character, "age", None)
    mature_threshold_raw = os.getenv("GEMINI_TTS_MATURE_AGE", "30").strip()
    try:
        mature_threshold = int(mature_threshold_raw)
    except ValueError:
        mature_threshold = 30
    is_mature = isinstance(age_value, int) and age_value >= mature_threshold

    female_tokens = {"female", "woman", "girl", "f", "女", "女性", "女生"}
    male_tokens = {"male", "man", "boy", "m", "男", "男性", "男生"}
    neutral_tokens = {"neutral", "non-binary", "nb", "中性", "未知"}

    if gender in female_tokens:
        return "Gacrux" if is_mature else "Kore"
    if gender in male_tokens:
        return "Algieba" if is_mature else "Schedar"
    if gender in neutral_tokens:
        return "Schedar"
    return None


def _build_tts_safety_settings(
    character: Optional[Character],
) -> Optional[list[types.SafetySetting]]:
    raw_flag = os.getenv("GEMINI_TTS_ALLOW_NSFW", "").strip().lower()
    if raw_flag in {"0", "false", "no"}:
        return None
    allow_nsfw = True if raw_flag == "" else raw_flag in {"1", "true", "yes"}
    if not allow_nsfw:
        return None
    if not character or getattr(character, "nsfw_level", 0) <= 0:
        return None

    return [
        types.SafetySetting(
            category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold=types.HarmBlockThreshold.BLOCK_NONE,
        )
    ]


def _is_tts_blocked_error(error_text: str) -> bool:
    if not error_text:
        return False
    lowered = error_text.lower()
    return any(
        token in lowered
        for token in (
            "blocked",
            "prohibited_content",
            "blocklist",
            "safety",
        )
    )


async def _has_sufficient_tokens(user_id: int, amount: int) -> bool:
    def _worker() -> bool:
        with SessionLocal() as sync_session:
            token_service = TokenService(sync_session)
            return token_service.has_sufficient_balance(user_id, amount)

    return await anyio.to_thread.run_sync(_worker)


async def _deduct_tokens(user_id: int, amount: int, description: str) -> bool:
    def _worker() -> bool:
        with SessionLocal() as sync_session:
            token_service = TokenService(sync_session)
            return token_service.deduct_tokens(user_id, amount, description)

    return await anyio.to_thread.run_sync(_worker)


@router.post("/{message_id}/tts")
async def generate_message_tts(
    message_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    """Generate TTS audio for a specific AI chat message."""
    stmt = select(ChatMessage).where(
        ChatMessage.id == message_id,
        ChatMessage.user_id == current_user.id,
    )
    message = (await db.execute(stmt)).scalars().first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.role != "assistant":
        raise HTTPException(status_code=400, detail="TTS is only available for AI messages")

    if message.audio_url:
        if message.audio_status != TTS_READY_STATUS or message.audio_error:
            message.audio_status = TTS_READY_STATUS
            message.audio_error = None
            await db.commit()
        return {"audioUrl": message.audio_url}

    if message.audio_status == TTS_BLOCKED_STATUS:
        detail = message.audio_error or "TTS blocked for this response"
        raise HTTPException(status_code=422, detail=detail)

    if not await _has_sufficient_tokens(current_user.id, TTS_TOKEN_COST):
        raise HTTPException(status_code=402, detail="Insufficient tokens")

    gemini_service = GeminiService(api_key=settings.gemini_api_key)
    await gemini_service.initialize()
    if not gemini_service.is_available:
        raise HTTPException(status_code=503, detail="Gemini TTS unavailable")

    character = None
    if message.chat_id:
        chat = await db.get(Chat, message.chat_id)
        if chat:
            character = await db.get(Character, chat.character_id)

    tts_prompt = build_tts_prompt(
        message.content,
        character_name=getattr(character, "name", None) if character else None,
        voice_style=getattr(character, "voice_style", None) if character else None,
        conversation_style=getattr(character, "conversation_style", None) if character else None,
        gender=getattr(character, "gender", None) if character else None,
        nsfw_level=getattr(character, "nsfw_level", None) if character else None,
        tone_hints=_derive_tone_hints(
            _parse_state_snapshot(message.state_snapshot),
            character,
        ),
    )
    safety_settings = _build_tts_safety_settings(character)
    voice_name = _select_voice_name(character)
    voice_config = {"voice_name": voice_name} if voice_name else None

    try:
        audio_bytes = await gemini_service.generate_speech(
            tts_prompt,
            voice_config=voice_config,
            safety_settings=safety_settings,
        )
    except AIServiceError as exc:
        error_text = str(exc)
        logger.error("Gemini TTS failed for message %s: %s", message_id, error_text)
        if _is_tts_blocked_error(error_text):
            message.audio_status = TTS_BLOCKED_STATUS
            message.audio_error = error_text
            await db.commit()
            raise HTTPException(status_code=422, detail="TTS blocked for this response")

        message.audio_status = TTS_FAILED_STATUS
        message.audio_error = error_text
        await db.commit()
        raise HTTPException(status_code=502, detail="TTS generation failed")

    mime_type = gemini_service.last_audio_mime_type or "audio/wav"

    upload_service = UploadService()
    success, upload_data, error = await upload_service.save_chat_audio(
        audio_bytes,
        current_user.id,
        mime_type=mime_type,
        message_id=message.id,
    )
    if not success:
        logger.error("Chat audio upload failed for message %s: %s", message_id, error)
        message.audio_status = TTS_FAILED_STATUS
        message.audio_error = error or "Failed to store audio"
        await db.commit()
        raise HTTPException(status_code=500, detail=error or "Failed to store audio")

    deduction_description = f"TTS generation for message {message_id}"
    if not await _deduct_tokens(current_user.id, TTS_TOKEN_COST, deduction_description):
        storage_path = upload_data.get("storagePath") if isinstance(upload_data, dict) else None
        if storage_path:
            try:
                await upload_service.storage.delete_object(storage_path)
            except Exception as exc:
                logger.warning("Failed to delete chat audio after token failure: %s", exc)
        raise HTTPException(status_code=402, detail="Insufficient tokens")

    message.audio_url = upload_data["url"]
    message.audio_status = TTS_READY_STATUS
    message.audio_error = None
    await db.commit()

    return {"audioUrl": message.audio_url}
