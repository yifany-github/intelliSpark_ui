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

# 阶段 → 短提醒词映射
STAGE_REMINDERS = {
    "其他": "",  # 无风险，不注入
    "插入前": "",  # 低风险，不注入
    "准备插入": "禁止假设用户状态",
    "插入时": "禁止假设用户状态，只描写观察到的动作",
    "抽插时": "严禁写'你快射了'等假设用户状态的内容",
    "角色高潮（自然发生）": "角色可以高潮，但禁止假设用户也高潮",
}


def get_stage_reminder(stage: str) -> str:
    """
    获取阶段对应的提醒词

    Args:
        stage: 检测到的性行为阶段

    Returns:
        格式化的提醒词，如果无需提醒则返回空字符串
    """
    reminder_text = STAGE_REMINDERS.get(stage, "")

    if not reminder_text:
        return ""

    # 格式化为提醒块
    return f"[当前阶段：{stage} - 提醒：{reminder_text}]"
