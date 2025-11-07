from dataclasses import dataclass


@dataclass
class PromptBundle:
    """Represents a pair of system instruction and user prompt."""

    system_instruction: str
    user_prompt: str


__all__ = ["PromptBundle"]
