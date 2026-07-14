"""Helpers for reading Gemini SDK responses without triggering SDK warnings."""

from typing import Any


def extract_text_parts(response: Any) -> str:
    """Return text from the first textual candidate, ignoring metadata parts."""
    if not response:
        return ""

    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or [] if content else []
        text_parts = []
        for part in parts:
            text = getattr(part, "text", None)
            if isinstance(text, str):
                text_parts.append(text)
        if text_parts:
            return "".join(text_parts)

    return ""
