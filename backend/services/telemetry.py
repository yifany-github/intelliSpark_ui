"""Telemetry helpers used across backend services."""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def log_chat_generation_attempt(
    *,
    chat_id: int,
    chat_uuid: Optional[str],
    user_id: int,
    character_id: Optional[int],
    breaker_state: str,
    attempt: int,
    max_attempts: int,
    latency_ms: float,
    result: str,
    error_code: Optional[str] = None,
    retry_after_seconds: Optional[float] = None,
) -> None:
    """Emit structured log for chat generation events without leaking PII."""

    payload = {
        "event": "chat_generation_attempt",
        "chat_id": chat_id,
        "chat_uuid": chat_uuid,
        "user_id": user_id,
        "character_id": character_id,
        "breaker_state": breaker_state,
        "attempt": attempt,
        "max_attempts": max_attempts,
        "latency_ms": round(latency_ms, 2),
        "result": result,
    }

    if error_code:
        payload["error_code"] = error_code
    if retry_after_seconds is not None:
        payload["retry_after_seconds"] = retry_after_seconds

    logger.info("chat_generation_attempt %s", payload)
