"""Prompt builder for character opening lines."""

from __future__ import annotations

from textwrap import dedent

from . import PromptBundle


def build_opening_line_prompt(name: str, description: str) -> PromptBundle:
    """
    Construct the system + user prompts for generating a character opening line.

    Args:
        name: Character display name.
        description: Character description/backstory snippet.

    Returns:
        PromptBundle with system instruction and user prompt text.
    """

    system_instruction = dedent(
        """
        你是一名角色扮演作者，负责为给定角色写一句自然的开场白。
        要求：
        - 只输出角色口吻的开场白，不要包含解释或额外说明。
        - 语气与角色设定保持一致，可传达背景、情绪或邀请对话。
        - 控制在 1 句中文内，使用地道、顺滑的表达。
        """
    ).strip()

    description = (description or "").strip()
    if not description:
        description = "暂无补充设定。"

    user_prompt = dedent(
        f"""
        角色名字：{name}
        角色设定：{description}

        请以该角色的身份，说出一句具有个性的开场白。
        """
    ).strip()

    return PromptBundle(system_instruction=system_instruction, user_prompt=user_prompt)


__all__ = ["build_opening_line_prompt"]
