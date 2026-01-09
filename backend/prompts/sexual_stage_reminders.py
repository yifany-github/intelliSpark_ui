"""
性行为阶段提醒词映射

目的：在高风险阶段注入SHORT负面约束，防止AI假设用户状态

设计原则：
1. SHORT：10-20字，简短直接
2. 负面约束："禁止写X"，不是正面示例
3. 只在高风险阶段注入
4. 强化系统提示中的规则，让AI保持reactive（观察）而非predictive（预测）

阶段名称与system.py 148-162行完全一致
"""

from utils.language_utils import normalize_language_code

# 阶段 → 短提醒词映射（多语言）
STAGE_REMINDERS_BY_LANG = {
    "zh": {
        "其他": "",
        "插入前": "",
        "准备插入": "禁止假设用户状态",
        "插入时": "禁止假设用户状态，只描写观察到的动作",
        "抽插时": "严禁写'你快射了'等假设用户状态的内容",
        "角色高潮（自然发生）": "角色可以高潮，但禁止假设用户也高潮",
    },
    "en": {
        "其他": "",
        "插入前": "",
        "准备插入": "Do not assume the user's state.",
        "插入时": "Do not assume the user's state; describe only observed actions.",
        "抽插时": "Never say 'you're about to climax' or similar assumptions.",
        "角色高潮（自然发生）": "The character may climax; do not assume the user does.",
    },
    "es": {
        "其他": "",
        "插入前": "",
        "准备插入": "No asumas el estado del usuario.",
        "插入时": "No asumas el estado del usuario; describe solo lo observado.",
        "抽插时": "No digas 'estás a punto de correrte' ni hagas suposiciones.",
        "角色高潮（自然发生）": "El personaje puede llegar al clímax; no asumas que el usuario también.",
    },
    "ko": {
        "其他": "",
        "插入前": "",
        "准备插入": "사용자 상태를 추측하지 마세요.",
        "插入时": "사용자 상태를 추측하지 말고 관찰된 행동만 묘사하세요.",
        "抽插时": "‘곧 사정할 것 같아’ 같은 가정은 금지입니다.",
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


def get_stage_reminder(stage: str, language: str = "zh") -> str:
    """
    获取阶段对应的提醒词

    Args:
        stage: 检测到的性行为阶段

    Returns:
        格式化的提醒词，如果无需提醒则返回空字符串
    """
    lang = normalize_language_code(language or "zh")
    reminders = STAGE_REMINDERS_BY_LANG.get(lang, STAGE_REMINDERS_BY_LANG["en"])
    reminder_text = reminders.get(stage, "")

    if not reminder_text:
        return ""

    if lang == "zh":
        return f"[当前阶段：{stage} - 提醒：{reminder_text}]"

    labels = STAGE_LABELS_BY_LANG.get(lang, STAGE_LABELS_BY_LANG["en"])
    stage_label = labels.get(stage, stage)
    return f"[Stage: {stage_label} - Reminder: {reminder_text}]"
