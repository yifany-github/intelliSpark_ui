from __future__ import annotations
from typing import Optional
import logging

try:
    from google import genai
except Exception:  # pragma: no cover
    genai = None

from config import settings

logger = logging.getLogger(__name__)


def generate_text_with_gemini(prompt: str, model: str = "gemini-2.0-flash-001") -> Optional[str]:
    """Best-effort Gemini call; returns None on failure."""
    if genai is None:
        logger.warning("google-genai not installed; skipping real generation")
        return None
    api_key = settings.gemini_api_key
    if not api_key:
        logger.warning("No GEMINI_API_KEY; skipping real generation")
        return None
    try:
        client = genai.Client(api_key=api_key)
        res = client.models.generate_content(model=model, contents=prompt)
        if res and getattr(res, "text", None):
            return res.text.strip()
    except Exception as e:
        logger.error(f"Gemini generation failed: {e}")
    return None

