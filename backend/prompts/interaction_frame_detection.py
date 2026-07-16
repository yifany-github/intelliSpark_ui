"""LLM prompt for structured Interaction Frame director (#276).

Mirrors sexual_stage_detection.py: short objective classification, not prose.
Gender must never decide who penetrates / ejaculates.
"""


def build_interaction_frame_detection_prompt(conversation: str) -> str:
    """
    Build prompt that returns a single JSON object for InteractionFrame fields.

    Args:
        conversation: Recent dialogue (prefer last 6–8 turns; assistant truncatable).
    """
    return f"""判断本轮性爱互动主客体（客观事实，不是猜测用户幻想）。

只输出一行 JSON，不要 markdown，不要解释。字段与取值：
{{
  "act_type": "penetration"|"oral"|"manual"|"none",
  "character_role": "actor"|"receiver"|"mutual"|"unknown",
  "user_role": "actor"|"receiver"|"mutual"|"unknown",
  "release_actor": "character"|"user"|"unknown",
  "release_target": "character"|"user"|"external"|"unknown",
  "confidence": 0.0到1.0的数,
  "evidence": "explicit_current"|"recent_context"|"unknown"
}}

规则：
1. evidence 优先级：当前用户句明确 > 最近几轮上下文 > unknown
2. 性别绝不决定谁插入、谁被插入、谁射；只看对话证据
3. 角色=actor 表示角色在插入/主动抽送；receiver 表示角色被进入
4. 用户问「射在里面可以吗/内射吗」时：
   - 若角色已是插入方 → release_actor=character, release_target=user
   - 若用户已是插入方 → release_actor=user, release_target=character
   - 证据不足 → release 保持 unknown（禁止默认女角被内射）
5. 非插入/释放场景：act_type=none，角色与释放多为 unknown
6. 中途角色互换：以当前明确句为准覆盖旧上下文

示例A（男角插入中 + 用户问内射）:
用户: 进来
角色: *我整根没入你体内抽送* 我快要……
用户: 射在里面可以吗？
输出: {{"act_type":"penetration","character_role":"actor","user_role":"receiver","release_actor":"character","release_target":"user","confidence":0.92,"evidence":"explicit_current"}}

示例B（女角被插入 + 用户问内射）:
用户: *慢慢插入*
角色: *穴口被你撑开，含着你的肉棒*
用户: 射在里面可以吗？
输出: {{"act_type":"penetration","character_role":"receiver","user_role":"actor","release_actor":"user","release_target":"character","confidence":0.9,"evidence":"explicit_current"}}

示例C（早聊）:
用户: 今天天气不错
角色: *笑* 是啊
输出: {{"act_type":"none","character_role":"unknown","user_role":"unknown","release_actor":"unknown","release_target":"unknown","confidence":0.0,"evidence":"unknown"}}

示例D（互换）:
角色: *我的肉棒抽送顶进你*
用户: 换过来，我插你
输出: {{"act_type":"penetration","character_role":"receiver","user_role":"actor","release_actor":"unknown","release_target":"unknown","confidence":0.85,"evidence":"explicit_current"}}

当前对话:
{conversation}

只输出 JSON:"""
