"""Prompt builder for Gemini TTS generation."""

from __future__ import annotations

import re
from typing import Optional


def _extract_dialogue(text: str) -> list[str]:
    if not text:
        return []

    matches: list[tuple[int, str]] = []
    patterns = [
        re.compile(r"“([^”]+)”", re.DOTALL),
        re.compile(r"\"([^\"]+)\"", re.DOTALL),
    ]

    for pattern in patterns:
        for match in pattern.finditer(text):
            segment = match.group(1).strip()
            if segment:
                matches.append((match.start(), segment))

    if not matches:
        return []

    matches.sort(key=lambda item: item[0])
    return [segment for _, segment in matches]


def _strip_state_update(text: str) -> str:
    if not text:
        return ""
    pattern = r"\[\[STATE_UPDATE\]\].*?\[\[/STATE_UPDATE\]\]"
    cleaned = re.sub(pattern, "", text, flags=re.DOTALL).strip()
    if "[[STATE_UPDATE]]" in cleaned:
        cleaned = cleaned.split("[[STATE_UPDATE]]", 1)[0].strip()
    return cleaned


def build_tts_prompt(
    text: str,
    *,
    character_name: Optional[str] = None,
    voice_style: Optional[str] = None,
    conversation_style: Optional[str] = None,
    gender: Optional[str] = None,
    nsfw_level: Optional[int] = None,
    tone_hints: Optional[list[str]] = None,
    dialogue_only: bool = True,
) -> str:
    """Build a TTS prompt that preserves the original text."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""

    content = _strip_state_update(cleaned)
    if dialogue_only:
        dialogue = _extract_dialogue(content)
        if dialogue:
            content = "\n\n".join(dialogue)

    style_descriptor = "，".join(
        part
        for part in [
            voice_style.strip() if voice_style else "",
            conversation_style.strip() if conversation_style else "",
        ]
        if part
    )

    tone_lines: list[str] = []
    if nsfw_level and nsfw_level > 0:
        gender_value = (gender or "").strip().lower()
        female_tokens = {"female", "woman", "girl", "f", "女", "女性", "女生"}
        male_tokens = {"male", "man", "boy", "m", "男", "男性", "男生"}

        if gender_value in male_tokens:
            tone_lines = [
                "语速：快，停顿短促但有张力",
                "音色：温暖、亲近、清晰、带轻微磁性",
                "情绪：暧昧、挑逗、带强烈吸引力",
                "呼吸：气息更重，带轻微喘息感",
            ]
        else:
            tone_lines = [
                "语速：快，断句更勾人，停顿短促带情绪",
                "音色：低哑、亲密、带气息感，贴近但吐字清晰",
                "情绪：暧昧、挑逗、带强烈吸引力",
                "呼吸：带轻微喘息感，气息更热",
            ]
    else:
        tone_lines = [
            "语速：快，吐字清晰，不拖音",
            "音色：自然、有温度",
            "情绪：自然、友好、专注",
        ]

    if tone_hints:
        cleaned_hints = [hint.strip() for hint in tone_hints if hint and hint.strip()]
        if cleaned_hints:
            tone_lines.append("动态提示：" + "；".join(cleaned_hints[:2]))

    header_lines: list[str] = ["# DIRECTOR'S NOTES"]
    if character_name:
        header_lines.insert(0, f"# AUDIO PROFILE\n角色：{character_name}")
        if style_descriptor:
            header_lines.insert(1, f"风格：{style_descriptor}")
    elif style_descriptor:
        header_lines.insert(1, f"风格：{style_descriptor}")

    prompt_sections = [
        "\n".join(header_lines),
        "\n".join(tone_lines),
        "",
        "# TRANSCRIPT",
        content,
    ]

    return "\n".join(prompt_sections)


__all__ = ["build_tts_prompt"]
