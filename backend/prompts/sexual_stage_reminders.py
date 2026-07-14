"""
性行为阶段提醒词映射

目的：在高风险阶段注入SHORT负面约束，防止AI假设用户状态

设计原则：
1. SHORT：10-20字，简短直接
2. 负面约束："禁止写X"，不是正面示例
3. 只在高风险阶段注入
4. 强化系统提示中的规则，让AI保持reactive（观察）而非predictive（预测）
5. 主客体由 Interaction Frame 决定；禁止默认「角色被插入」

阶段名称与system.py完全一致
"""

from __future__ import annotations

from typing import Any, Optional

from utils.language_utils import normalize_language_code

# 阶段 → 短提醒词映射（多语言）
# 负面约束保留用户 agency；同时提醒保持角色反应密度（不是空禁止）
STAGE_REMINDERS_BY_LANG = {
    "zh": {
        "其他": "",
        "插入前": "",
        "准备插入": "禁止假设用户状态；写清角色此刻的身体反应",
        "插入时": "禁止假设用户状态；按互动主客体写即时感受与动作",
        "抽插时": "严禁写'你快射了'；用角色身体反应承接用户节奏",
        "角色高潮（自然发生）": "角色可以高潮；禁止假设用户也高潮",
    },
    "en": {
        "其他": "",
        "插入前": "",
        "准备插入": "Do not assume the user's state; detail the character's body reaction.",
        "插入时": "Do not assume the user's state; write sensation per interaction roles.",
        "抽插时": "Never say 'you're about to climax'; match the user's rhythm through the character's body.",
        "角色高潮（自然发生）": "The character may climax; do not assume the user does.",
    },
    "es": {
        "其他": "",
        "插入前": "",
        "准备插入": "No asumas el estado del usuario; detalla la reacción corporal del personaje.",
        "插入时": "No asumas el estado del usuario; escribe según los roles de interacción.",
        "抽插时": "No digas 'estás a punto de correrte'; sigue el ritmo del usuario con el cuerpo del personaje.",
        "角色高潮（自然发生）": "El personaje puede llegar al clímax; no asumas que el usuario también.",
    },
    "ko": {
        "其他": "",
        "插入前": "",
        "准备插入": "사용자 상태를 추측하지 말고 캐릭터의 신체 반응을 구체적으로 쓰세요.",
        "插入时": "사용자 상태를 추측하지 말고 상호작용 역할에 맞춰 감각을 쓰세요.",
        "抽插时": "‘곧 사정할 것 같아’ 금지. 사용자 리듬에 맞춰 캐릭터 신체 반응으로 이어가세요.",
        "角色高潮（自然发生）": "캐릭터는 절정 가능하나 사용자의 절정은 가정하지 마세요.",
    },
}

STAGE_LABELS_BY_LANG = {
    "en": {
        "其他": "Other",
        "插入前": "Before insertion",
        "准备插入": "Preparing to insert",
        "插入时": "During insertion",
        "抽插时": "Thrusting",
        "角色高潮（自然发生）": "Character climax (natural)",
    },
    "es": {
        "其他": "Otro",
        "插入前": "Antes de la penetración",
        "准备插入": "Preparando la penetración",
        "插入时": "Durante la penetración",
        "抽插时": "Movimiento de penetración",
        "角色高潮（自然发生）": "Clímax del personaje (natural)",
    },
    "ko": {
        "其他": "기타",
        "插入前": "삽입 전",
        "准备插入": "삽입 준비",
        "插入时": "삽입 중",
        "抽插时": "추삽 중",
        "角色高潮（自然发生）": "캐릭터 절정(자연 발생)",
    },
}


def _role_overlay(stage: str, frame: Any, language: str) -> str:
    """Short role-aware overlay; never defaults female-receiver."""
    if frame is None or stage not in {"准备插入", "插入时", "抽插时", "角色高潮（自然发生）"}:
        return ""
    char_role = getattr(frame, "character_role", "unknown")
    release_actor = getattr(frame, "release_actor", "unknown")
    release_target = getattr(frame, "release_target", "unknown")

    if language == "zh":
        if release_actor == "character" and release_target == "user":
            return "释放=角色→用户体内；禁止写成「你想射就射吧」"
        if release_actor == "user" and release_target == "character":
            return "释放=用户→角色体内；角色写承受，勿改成角色在射"
        if char_role == "actor":
            return "角色是插入方：写主动推进；禁止默认角色被插入"
        if char_role == "receiver":
            return "角色是被插入方：写被进入的即时感受"
        return "主客体不明：勿默认女角被插入"
    if release_actor == "character" and release_target == "user":
        return "Release=character into user; never 'you can cum if you want'."
    if release_actor == "user" and release_target == "character":
        return "Release=user into character; character receives, does not ejaculate instead."
    if char_role == "actor":
        return "Character is penetrator; do not default to character being penetrated."
    if char_role == "receiver":
        return "Character is receiver; write being entered."
    return "Roles unknown; do not default female-receiver template."


def get_stage_reminder(
    stage: str,
    language: str = "zh",
    interaction_frame: Optional[Any] = None,
) -> str:
    """
    获取阶段对应的提醒词

    Args:
        stage: 检测到的性行为阶段
        language: 输出语言
        interaction_frame: optional InteractionFrame for role-aware overlay

    Returns:
        格式化的提醒词，如果无需提醒则返回空字符串
    """
    lang = normalize_language_code(language or "zh")
    reminders = STAGE_REMINDERS_BY_LANG.get(lang, STAGE_REMINDERS_BY_LANG["en"])
    reminder_text = reminders.get(stage, "")
    overlay = _role_overlay(stage, interaction_frame, lang if lang in STAGE_REMINDERS_BY_LANG else "en")

    if not reminder_text and not overlay:
        return ""

    parts = [p for p in (reminder_text, overlay) if p]
    combined = "；".join(parts) if lang == "zh" else "; ".join(parts)

    if lang == "zh":
        return f"[当前阶段：{stage} - 提醒：{combined}]"

    labels = STAGE_LABELS_BY_LANG.get(lang, STAGE_LABELS_BY_LANG["en"])
    stage_label = labels.get(stage, stage)
    return f"[Stage: {stage_label} - Reminder: {combined}]"
