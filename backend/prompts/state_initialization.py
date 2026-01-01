"""NSFW-oriented state initialization prompt builder."""

from __future__ import annotations

from textwrap import dedent
from typing import Iterable

from . import PromptBundle

STATE_KEYS: Iterable[str] = ("胸部", "下体", "衣服", "姿势", "情绪", "环境", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度")


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
        - JSON 必须包含以下键：[{key_list}]

        **状态字段格式：**

        1. **量化状态**（必须包含 value 和 description）：
           - 情绪: {{"value": 5-7, "description": "具体描述"}}  (0=极度沮丧, 5=平静, 10=狂喜)
           - 好感度: {{"value": 4-6, "description": "具体描述"}}  (0=厌恶, 5=中立, 10=深爱)
           - 信任度: {{"value": 3-5, "description": "具体描述"}}  (0=完全不信任, 10=完全信任)
           - 兴奋度: {{"value": 4-6, "description": "具体描述"}}  (0=冷淡, 10=极度兴奋)
           - 疲惫度: {{"value": 2-4, "description": "具体描述"}}  (0=精力充沛, 10=筋疲力尽)
           - 欲望值: {{"value": 4-6, "description": "具体描述"}}  (0=无欲, 10=强烈渴望)
           - 敏感度: {{"value": 5-7, "description": "具体描述"}}  (0=无感, 10=极度敏感)

        2. **描述性状态**（纯文本字符串）：
           - 胸部、下体、衣服、姿势、环境：给出露骨、细节鲜明的描述

        - 初始状态应该设置为合理的起始值（如好感度4-6，信任度3-5，欲望值4-6）
        - 允许使用露骨词汇，保持细节鲜明、感官丰富，并且与角色设定吻合。
        - 如果某个维度没有信息，也要给出合理的默认描述，避免空字符串或笼统词语。

        示例格式：
        {{
          "胸部": "柔软饱满，布料轻贴，伴随呼吸微微起伏",
          "下体": "带着余热与敏感，隐约透出渴望",
          "衣服": "贴身衣物略显凌乱，勾勒出诱人曲线",
          "姿势": "身体微微前倾，呈现出主动亲近的姿态",
          "情绪": {{"value": 6, "description": "期待、雀跃并带着羞怯的悸动"}},
          "好感度": {{"value": 5, "description": "对你充满好奇，愿意进一步了解"}},
          "信任度": {{"value": 4, "description": "在这个私密空间中略显放松"}},
          "兴奋度": {{"value": 5, "description": "内心涌动着期待感"}},
          "欲望值": {{"value": 4, "description": "身体开始感受到微妙的渴望"}},
          "敏感度": {{"value": 6, "description": "肌肤对触碰的反应敏锐"}},
          "环境": "私密空间光线暖柔，空气中弥漫甜香"
        }}
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
