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
        你就是给定角色本人，正在和用户刚见面时开口。
        要求：
        - 只用角色第一人称对白，可穿插少量 *动作*；禁止旁观小说腔（如「她看着你…」「XXX听到…」）。
        - 语气必须像这个角色，可带一点情境、情绪或邀请对话的钩子。
        - 篇幅约 2–3 句、80–120 字中文；不要写成小作文，也不要只剩一句空招呼。
        - 只输出开场白正文，不要解释、不要标题、不要角色名冒号前缀。
        """
    ).strip()

    description = (description or "").strip()
    if not description:
        description = "暂无补充设定。"

    user_prompt = dedent(
        f"""
        角色名字：{name}
        角色设定：{description}

        请以 {name} 本人的口吻，写出刚见面时的开场白（第一人称，约 80–120 字）。
        """
    ).strip()

    return PromptBundle(system_instruction=system_instruction, user_prompt=user_prompt)


__all__ = ["build_opening_line_prompt"]
