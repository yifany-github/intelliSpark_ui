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
    language: str = "zh",
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

    if language == "en":
        system_instruction = dedent(
            f"""
            You are an adult roleplay director. Based on the character persona, output the character's current state as JSON.

            Output requirements:
            - Output ONLY a JSON object, no extra text.
            - JSON must contain the following keys: [{key_list}]
            - Keep the keys exactly as listed (do NOT translate keys).

            State field formats:

            1. Quantified states (must include value and description):
               - 情绪: {{"value": 5-7, "description": "specific description"}}  (0=deeply depressed, 5=calm, 10=ecstatic)
               - 好感度: {{"value": 4-6, "description": "specific description"}}  (0=disgust, 5=neutral, 10=deep love)
               - 信任度: {{"value": 3-5, "description": "specific description"}}  (0=no trust, 10=complete trust)
               - 兴奋度: {{"value": 4-6, "description": "specific description"}}  (0=flat, 10=highly aroused)
               - 疲惫度: {{"value": 2-4, "description": "specific description"}}  (0=energetic, 10=exhausted)
               - 欲望值: {{"value": 4-6, "description": "specific description"}}  (0=no desire, 10=intense craving)
               - 敏感度: {{"value": 5-7, "description": "specific description"}}  (0=insensitive, 10=highly sensitive)

            2. Descriptive states (plain strings):
               - 胸部、下体、衣服、姿势、环境: explicit, vivid descriptions

            Language requirements:
            - All descriptions MUST be in English.

            Example format:
            {{
              "胸部": "Soft and full, fabric clings lightly as her breath rises",
              "下体": "Warm and sensitive, a subtle ache hinting at need",
              "衣服": "Tight garments slightly rumpled, tracing a tempting curve",
              "姿势": "Leaning forward, body angled toward you in quiet invitation",
              "情绪": {{"value": 6, "description": "Eager and fluttering, a shy thrill behind her smile"}},
              "好感度": {{"value": 5, "description": "Curious about you, willing to grow closer"}},
              "信任度": {{"value": 4, "description": "Relaxing in this private space, still a little guarded"}},
              "兴奋度": {{"value": 5, "description": "A steady, rising anticipation"}},
              "欲望值": {{"value": 4, "description": "A faint, growing hunger she tries to hide"}},
              "敏感度": {{"value": 6, "description": "Skin quick to respond, breath catching easily"}},
              "环境": "Soft, warm lighting in a private space, air sweet with perfume"
            }}
            """
        ).strip()

        user_prompt = dedent(
            f"""
            Character name: {character_name}
            Character persona / prompt:
            {persona_section}

            Character avatar: {avatar_hint}

            Infer the initial state and output JSON following the rules above.
            """
        ).strip()
    else:
        system_instruction = dedent(
            f"""
            你是一名成人向角色扮演导演，需要根据角色设定输出当前角色的状态 JSON。

            输出要求：
            - 仅输出一个 JSON 对象，不要包含解释或额外文本。
            - JSON 必须包含以下键：[{key_list}]
            - 键名必须保持原样，不要翻译键名。

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
