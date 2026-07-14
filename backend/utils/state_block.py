"""Parse / strip [[STATE_UPDATE]] blocks from model replies.

Models often emit malformed open tags like ``[[STATE_UPDATE]{...}``
(missing one ``]``). Extractors must tolerate that or the block leaks into chat UI.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Tuple

# Accept [[STATE_UPDATE]] or malformed [[STATE_UPDATE]
_OPEN = r"\[\[STATE_UPDATE\]\]?"
_CLOSE = r"\[\[/?STATE_UPDATE\]\]"
_BLOCK_RE = re.compile(rf"{_OPEN}(?P<content>.*?){_CLOSE}", re.DOTALL | re.IGNORECASE)
_OPEN_RE = re.compile(_OPEN, re.IGNORECASE)


def extract_state_update(response_text: str) -> Tuple[str, Dict[str, Any]]:
    """Return (cleaned_prose, state_dict). Always strips any STATE block from prose."""
    if not response_text:
        return "", {}

    matches = list(_BLOCK_RE.finditer(response_text))
    state_update: Dict[str, Any] = {}

    if matches:
        raw_content = matches[0].group("content") or ""
        if raw_content:
            start = raw_content.find("{")
            end = raw_content.rfind("}")
            if start != -1 and end != -1 and start < end:
                candidate = raw_content[start : end + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        state_update = parsed
                except json.JSONDecodeError:
                    pass
        cleaned = _BLOCK_RE.sub("", response_text).strip()
        return cleaned, state_update

    # Open tag present but no/invalid close — drop from first open to end
    open_match = _OPEN_RE.search(response_text)
    if open_match:
        return response_text[: open_match.start()].strip(), {}

    return response_text, {}
