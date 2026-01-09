"""Language utilities for request parsing and prompt labels."""

from __future__ import annotations

from typing import Dict

SUPPORTED_LANGUAGES = {"en", "zh", "es", "ko"}

LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English",
    "zh": "中文(简体)",
    "es": "Español",
    "ko": "한국어",
}

LANGUAGE_LABELS: Dict[str, Dict[str, str]] = {
    "en": {"user": "User", "state_prefix": "Current State"},
    "zh": {"user": "用户", "state_prefix": "当前状态"},
    "es": {"user": "Usuario", "state_prefix": "Estado actual"},
    "ko": {"user": "사용자", "state_prefix": "현재 상태"},
}


def normalize_language_code(value: str | None, default: str = "en") -> str:
    """Normalize a language code to a supported primary tag."""
    if not value:
        return default

    primary = value.lower().split("-")[0]
    if primary in SUPPORTED_LANGUAGES:
        return primary

    return default


def parse_accept_language(header_value: str | None, default: str = "en") -> str:
    """Parse an Accept-Language header and return the first supported language."""
    if not header_value:
        return default

    for part in header_value.split(","):
        lang = part.split(";", 1)[0].strip()
        if not lang:
            continue
        normalized = normalize_language_code(lang, default=default)
        if normalized in SUPPORTED_LANGUAGES:
            return normalized

    return default


def get_language_name(code: str) -> str:
    """Return display name for a language code."""
    return LANGUAGE_NAMES.get(code, code)


def get_language_labels(code: str) -> Dict[str, str]:
    """Return labels for prompt composition."""
    return LANGUAGE_LABELS.get(code, LANGUAGE_LABELS["en"])
