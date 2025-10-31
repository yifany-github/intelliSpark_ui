"""SAFE-oriented state initialization prompt builder."""

from __future__ import annotations

from textwrap import dedent
from typing import Iterable

from . import PromptBundle

SAFE_STATE_KEYS: Iterable[str] = ("衣着", "仪态", "情绪", "环境", "动作", "语气")


def build_state_initialization_prompt_safe(
    *,
    character_name: str,
    persona_prompt: str | None,
    avatar_url: str | None,
) -> PromptBundle:
    """
    Construct prompt bundle for generating an initial SAFE state JSON.

    Args:
        character_name: Display name of the character.
        persona_prompt: Persona/backstory text highlighting personality and scenario.
        avatar_url: URL to the character avatar (used for visual context hints).
    """

    persona_prompt = (persona_prompt or "").strip()
    persona_section = persona_prompt if persona_prompt else "（暂无额外设定，按日常生活化角色塑造。）"

    avatar_hint = (avatar_url or "").strip() or "（Avatar URL 未提供）"

    key_list = ", ".join(SAFE_STATE_KEYS)

    system_instruction = dedent(
        f"""
        你是一名叙事设计师，需要为角色生成一份适合全年龄向的状态 JSON。

        输出要求：
        - 仅输出一个 JSON 对象，不包含其它解释文字。
        - JSON 必须包含以下键：[{key_list}]
        - 对每个键给出自然、正面的中文描述，呈现人物当下的穿着、举止、心情与互动氛围。
        - 用词需完全符合安全审查标准，避免任何露骨、擦边或暗示性描述。
        - 如果缺少信息，也需要给出合理的想象，保持设定连贯。
        """
    ).strip()

    user_prompt = dedent(
        f"""
        角色名字：{character_name}
        角色 persona / prompt：
        {persona_section}

        角色头像：{avatar_hint}

        请结合角色气质与头像，给出符合上述规则的初始状态 JSON。
        """
    ).strip()

    return PromptBundle(system_instruction=system_instruction, user_prompt=user_prompt)


__all__ = ["SAFE_STATE_KEYS", "build_state_initialization_prompt_safe"]
