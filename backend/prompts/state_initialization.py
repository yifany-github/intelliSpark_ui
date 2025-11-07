"""NSFW-oriented state initialization prompt builder."""

from __future__ import annotations

from textwrap import dedent
from typing import Iterable

from . import PromptBundle

STATE_KEYS: Iterable[str] = ("胸部", "下体", "衣服", "姿势", "情绪", "环境")


def build_state_initialization_prompt(
    *,
    character_name: str,
    persona_prompt: str | None,
    avatar_url: str | None,
) -> PromptBundle:
    """
    Construct prompt bundle for generating an initial NSFW state JSON.

    Args:
        character_name: Display name of the character.
        persona_prompt: Persona/backstory text highlighting personality and scenario.
        avatar_url: URL to the character avatar (used for visual context hints).
    """

    persona_prompt = (persona_prompt or "").strip()
    persona_section = persona_prompt if persona_prompt else "（暂无额外设定，按常规成熟女性塑造。）"

    avatar_hint = (avatar_url or "").strip() or "（Avatar URL 未提供）"

    key_list = ", ".join(STATE_KEYS)

    system_instruction = dedent(
        f"""
        你是一名成人向角色扮演导演，需要根据角色设定输出当前角色的状态 JSON。

        输出要求：
        - 仅输出一个 JSON 对象，不要包含解释或额外文本。
        - JSON 必须包含以下六个键：[{key_list}]
        - 每个键的取值是描述性的中文短段，体现角色此刻的身体状态、情绪与环境。
        - 允许使用露骨词汇，保持细节鲜明、感官丰富，并且与角色设定吻合。
        - 如果某个维度没有信息，也要给出合理的默认描述，避免空字符串或笼统词语。
        """
    ).strip()

    user_prompt = dedent(
        f"""
        角色名字：{character_name}
        角色 persona / prompt：
        {persona_section}

        角色头像：{avatar_hint}

        请结合角色人格与头像信息，推导其初始状态，输出符合上述规则的 JSON。
        """
    ).strip()

    return PromptBundle(system_instruction=system_instruction, user_prompt=user_prompt)


__all__ = ["STATE_KEYS", "build_state_initialization_prompt"]
