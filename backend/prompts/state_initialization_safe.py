"""SAFE-oriented state initialization prompt builder."""

from __future__ import annotations

from textwrap import dedent
from typing import Iterable

from . import PromptBundle

SAFE_STATE_KEYS: Iterable[str] = ("衣着", "仪态", "情绪", "环境", "动作", "语气", "好感度", "信任度", "兴奋度", "疲惫度")


def build_state_initialization_prompt_safe(
    *,
    character_name: str,
    persona_prompt: str | None,
    avatar_url: str | None,
    language: str = "zh",
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

    if language == "en":
        system_instruction = dedent(
            f"""
            You are a narrative designer. Generate a safe-for-all-ages state JSON for the character.

            Output requirements:
            - Output ONLY a JSON object, no extra text.
            - JSON must contain the following keys: [{key_list}]
            - Keep the keys exactly as listed (do NOT translate keys).

            State field formats:

            1. Quantified states (must include value and description):
               - 情绪: {{"value": 5-7, "description": "specific description"}}  (0=deeply depressed, 5=calm, 10=delighted)
               - 好感度: {{"value": 3-5, "description": "specific description"}}  (0=disgust, 3-4=first meeting, 5=neutral, 10=deep love)
               - 信任度: {{"value": 2-4, "description": "specific description"}}  (0=no trust, 3-4=guarded, 10=complete trust)
               - 兴奋度: {{"value": 4-6, "description": "specific description"}}  (0=flat, 5=steady, 10=highly excited)
               - 疲惫度: {{"value": 2-4, "description": "specific description"}}  (0=energetic, 5=normal, 10=exhausted)

            2. Descriptive states (plain strings):
               - 衣着、仪态、环境、动作、语气: natural, safe descriptions only

            Language requirements:
            - All descriptions MUST be in English.

            Example format:
            {{
              "衣着": "A soft-toned dress that looks neat and comfortable",
              "仪态": "Relaxed posture, confident and natural",
              "情绪": {{"value": 6, "description": "Cheerful mood, looking forward to talking"}},
              "好感度": {{"value": 4, "description": "Polite and friendly, still a bit distant"}},
              "信任度": {{"value": 3, "description": "Slightly cautious, trust needs time"}},
              "环境": "A warm, well-lit indoor space",
              "动作": "Hands relaxed at her sides",
              "语气": "Warm and gentle, with a hint of excitement"
            }}
            """
        ).strip()

        user_prompt = dedent(
            f"""
            Character name: {character_name}
            Character persona / prompt:
            {persona_section}

            Character avatar: {avatar_hint}

            Provide the initial state JSON following the rules above.
            """
        ).strip()
    else:
        system_instruction = dedent(
            f"""
            你是一名叙事设计师，需要为角色生成一份适合全年龄向的状态 JSON。

            输出要求：
            - 仅输出一个 JSON 对象，不包含其它解释文字。
            - JSON 必须包含以下键：[{key_list}]
            - 键名必须保持原样，不要翻译键名。

            **状态字段格式：**

            1. **量化状态**（必须包含 value 和 description）：
               - 情绪: {{"value": 5-7, "description": "具体描述"}}  (0=极度沮丧, 5=平静, 10=欢欣雀跃)
               - 好感度: {{"value": 3-5, "description": "具体描述"}}  (0=厌恶, 3-4=初次见面, 5=中立, 10=深爱)
               - 信任度: {{"value": 2-4, "description": "具体描述"}}  (0=完全不信任, 3-4=略有戒备, 10=完全信任)
               - 兴奋度: {{"value": 4-6, "description": "具体描述"}}  (0=冷淡, 5=平稳, 10=极度兴奋)
               - 疲惫度: {{"value": 2-4, "description": "具体描述"}}  (0=精力充沛, 5=正常, 10=筋疲力尽)

            2. **描述性状态**（纯文本字符串）：
               - 衣着、仪态、环境、动作、语气：直接给出自然的中文描述

            - 初始状态应该设置为合理的起始值（如好感度3-5，信任度2-4，情绪5-7）
            - 用词需完全符合安全审查标准，避免任何露骨、擦边或暗示性描述。
            - 如果缺少信息，也需要给出合理的想象，保持设定连贯。

            示例格式：
            {{
              "衣着": "白色连衣裙，色调温和",
              "仪态": "站姿放松，自信自然",
              "情绪": {{"value": 6, "description": "心情愉悦，对交流充满期待"}},
              "好感度": {{"value": 4, "description": "初次见面，保持礼貌的距离感"}},
              "信任度": {{"value": 3, "description": "略有戒备，需要时间建立信任"}},
              "环境": "温暖明亮的室内空间",
              "动作": "双手自然垂放",
              "语气": "亲切柔和，带着一丝兴奋"
            }}
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
