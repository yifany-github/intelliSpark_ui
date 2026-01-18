from dataclasses import dataclass

from .tts_prompt import build_tts_prompt


@dataclass
class PromptBundle:
    """Represents a pair of system instruction and user prompt."""

    system_instruction: str
    user_prompt: str


__all__ = ["PromptBundle", "build_tts_prompt"]
