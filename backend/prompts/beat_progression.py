"""Beat progression from conversation history — keep the user in a human scene."""

from __future__ import annotations

import re
from typing import Any, Sequence, Tuple

# User short "keep going" cues — often misread as "keep my solo show going"
CONTINUE_CUES = (
    "继续",
    "再继续",
    "接着",
    "然后呢",
    "然后",
    "go on",
    "continue",
    "keep going",
    "more",
    "再说",
    "往下",
)

SOLO_MARKERS = (
    "自己玩",
    "自己摸",
    "自己插",
    "自己揉",
    "你听",
    "听我叫",
    "听我的叫声",
    "隔着布料",
    "手指慢慢",
    "两根手指",
)

USER_SLOT_CUES = (
    "你呢",
    "过来",
    "靠近",
    "伸手",
    "摸摸",
    "碰我",
    "抱我",
    "帮我",
    "你来",
    "对你",
    "被你",
    "你的手",
    "你碰",
    "你弄",
    "坐过来",
    "come here",
    "touch me",
    "your turn",
)

USER_ACTION_MARKERS = (
    "*",
    "我摸",
    "我抱",
    "我亲",
    "我按",
    "我插",
    "我脱",
    "靠近你",
    "把手",
    "吻",
)

# Soft intimacy advances (not full execute commands) — classic RP escalation
INTIMACY_PUSH_MARKERS = (
    "想亲",
    "亲你",
    "吻你",
    "接吻",
    "想抱",
    "抱你",
    "抱紧",
    "想摸",
    "摸你",
    "靠近我",
    "靠过来",
    "贴过来",
    "喜欢你",
    "爱你",
    "想你",
    "可以亲",
    "亲一下",
    "吻一下",
    "kiss",
    "hug me",
    "hold me",
    "come closer",
)

# Persona signals that identity/role conflicts with desire (standard dramatic conflict)
ROLE_CONFLICT_MARKERS = (
    "姨妈",
    "继母",
    "公公",
    "婆婆",
    "嫂子",
    "姐夫",
    "岳母",
    "岳父",
    "禁忌",
    "乱伦",
    "Desire vs Role",
    "欲望 vs",
    "身份",
    "名分",
    "忠贞",
    "靖哥哥",
    "有夫",
    "人妇",
    "师生",
    "上司",
    "俘虏",
    "不该",
    "越界",
    "道德",
)

# Everyday / relational content the smut-machine voice tends to skip
MUNDANE_MARKERS = (
    "洗澡",
    "洗了",
    "饿",
    "累",
    "睡",
    "工作",
    "今天",
    "你好吗",
    "想你了",
    "想我了吗",
    "吃饭",
    "回家",
    "冷",
    "热",
    "味道",
    "香水",
    "衣服",
    "脱衣服",  # still a request — but often paired with mundane
)

SMUT_TEMPLATE_MARKERS = (
    "蜜穴",
    "乳尖",
    "娇喘",
    "水润",
    "湿透",
    "饱满",
    "曲线",
    "淫靡",
    "颤抖",
    "红晕",
    "丁字裤",
    "含进去",
    "抽插",
)


def _msg_text(message: Any) -> str:
    return (getattr(message, "content", None) or "").strip()


def _msg_role(message: Any) -> str:
    return (getattr(message, "role", None) or "").strip().lower()


def iter_history(messages: Sequence[Any], *, limit: int = 8) -> Tuple[Tuple[str, str], ...]:
    """Recent (role, text) pairs from chat history — source of truth for beat inference."""
    pairs = []
    for message in messages:
        role = _msg_role(message)
        if role not in {"user", "assistant"}:
            continue
        text = _msg_text(message)
        if text:
            pairs.append((role, text))
    return tuple(pairs[-limit:])


def last_user_text(messages: Sequence[Any]) -> str:
    for role, text in reversed(iter_history(messages, limit=20)):
        if role == "user":
            return text
    return ""


def last_assistant_text(messages: Sequence[Any]) -> str:
    for role, text in reversed(iter_history(messages, limit=20)):
        if role == "assistant":
            return text
    return ""


def is_continue_cue(text: str) -> bool:
    cleaned = re.sub(r"\s+", "", (text or "").lower())
    if not cleaned:
        return False
    if len(cleaned) <= 12 and any(cue in cleaned for cue in CONTINUE_CUES):
        return True
    return cleaned in {"继续", "接着", "然后呢", "continue", "more"}


def looks_like_solo_performance(text: str) -> bool:
    body = text or ""
    hits = sum(1 for marker in SOLO_MARKERS if marker in body)
    return hits >= 2


def has_user_action_slot(text: str) -> bool:
    body = (text or "").lower()
    return any(cue.lower() in body for cue in USER_SLOT_CUES)


def user_described_action(text: str) -> bool:
    body = text or ""
    if "*" in body and body.count("*") >= 2:
        return True
    return any(marker in body for marker in USER_ACTION_MARKERS)


def user_pushes_intimacy(text: str) -> bool:
    """User is escalating closeness / romance / soft NSFW — not just chatting."""
    body = (text or "").strip()
    if not body:
        return False
    compact = re.sub(r"\s+", "", body.lower())
    if any(m.lower() in compact for m in INTIMACY_PUSH_MARKERS):
        return True
    # Short physical invitations
    if len(compact) <= 16 and any(m in compact for m in ("亲", "吻", "抱", "贴", "靠近")):
        return True
    # Observational arousal tease (light stimulus, still intimacy beat)
    if any(
        m in compact
        for m in ("怎么湿", "湿湿的", "这么硬", "硬硬的", "反应那么大", "真骚", "这么湿")
    ):
        return True
    return False


def persona_has_role_conflict(persona_text: str) -> bool:
    """True when character card encodes Desire vs Role (identity vs want)."""
    body = persona_text or ""
    if not body.strip():
        return False
    if "【冲突" in body or "Desire vs Role" in body:
        return True
    hits = sum(1 for m in ROLE_CONFLICT_MARKERS if m in body)
    return hits >= 1


def reply_too_thin(text: str, *, min_chars: int = 100) -> bool:
    """Rough CJK-aware thinness check for immersive intimacy turns."""
    body = re.sub(r"\s+", "", text or "")
    # Strip common markdown action wrappers for length estimate
    body = body.replace("*", "")
    return len(body) < min_chars


def user_has_mundane_beat(text: str) -> bool:
    """User said something a person would answer — not only smut direction."""
    body = text or ""
    if not body:
        return False
    # Pure continue cues are not "mundane questions"
    if is_continue_cue(body):
        return False
    if any(m in body for m in ("吗", "么", "呢", "?", "？")) and any(
        m in body for m in MUNDANE_MARKERS
    ):
        return True
    # Short greetings / check-ins
    compact = re.sub(r"\s+", "", body)
    if compact in {"你好", "在吗", "想你了", "你好吗", "嗨", "哈喽"}:
        return True
    if "洗澡" in body or "洗了" in body:
        return True
    return False


def assistant_acknowledged_mundane(reply: str, user_text: str) -> bool:
    """Did the reply actually address the mundane beat in the user message?"""
    if not user_has_mundane_beat(user_text):
        return True
    reply = reply or ""
    # Keyword overlap for bath / greeting / tired etc.
    checks = []
    if "洗" in user_text:
        checks.extend(["洗", "澡", "香", "浴室", "潮", "蒸汽"])
    if any(g in user_text for g in ("你好", "你好吗", "在吗")):
        checks.extend(["好", "想你", "来了", "陪"])
    if "累" in user_text:
        checks.extend(["累", "休息", "辛苦"])
    if "饿" in user_text:
        checks.extend(["饿", "吃", "饭"])
    if not checks:
        # Generic: at least some non-smut caring phrase
        checks = ["宝贝", "先", "嗯", "好"]
    return any(c in reply for c in checks)


def smut_template_density(text: str) -> float:
    body = text or ""
    if not body:
        return 0.0
    hits = sum(1 for m in SMUT_TEMPLATE_MARKERS if m in body)
    # normalize roughly by length buckets
    return hits / max(len(body) / 80.0, 1.0)


def looks_like_smut_machine(text: str) -> bool:
    """Porn-narrator voice with little personhood."""
    body = text or ""
    if smut_template_density(body) < 2.5:
        return False
    # No concrete environment grounding
    env_hits = sum(
        1
        for w in ("沙发", "地毯", "灯", "地板", "客厅", "拉链", "膝盖", "蒸汽", "潮热", "香水")
        if w in body
    )
    person_hits = sum(
        1 for w in ("我其实", "有点", "刚", "今天", "先", "喜欢你", "担心", "笑", "轻声") if w in body
    )
    return env_hits == 0 and person_hits <= 1


def looks_like_question_menu(text: str) -> bool:
    body = text or ""
    q_count = body.count("？") + body.count("?")
    menu_hits = sum(body.count(m) for m in ("还是", "要不要", "想不想", "还是想", "or "))
    if q_count >= 2 and menu_hits >= 1:
        return True
    if menu_hits >= 2:
        return True
    return False


def detect_beat_mode(messages: Sequence[Any]) -> str:
    """
    Infer upcoming beat mode from recent chat history (not a separate DB field).

    Modes:
      - human_first: user said something a person should answer (bath, hi, tired…)
      - pass_ball: short continue after solo / menu stall
      - react_to_user: user acted physically
      - mutual: default mid-scene
      - early: first user turns
    """
    history = iter_history(messages, limit=8)
    user_turns = sum(1 for role, _ in history if role == "user")
    user_text = last_user_text(messages)
    assistant_text = last_assistant_text(messages)

    if user_turns <= 1:
        return "early"

    # Personhood first: don't steamroll a human question into pure smut menu
    if user_has_mundane_beat(user_text):
        return "human_first"

    if user_described_action(user_text):
        return "react_to_user"

    if is_continue_cue(user_text) and (
        looks_like_solo_performance(assistant_text) or looks_like_question_menu(assistant_text)
    ):
        return "pass_ball"

    if is_continue_cue(user_text):
        return "pass_ball"

    return "mutual"


def build_beat_hint(mode: str, language: str = "zh") -> str:
    """Short per-turn beat instruction — grounded in history-inferred mode."""
    lang = language if language in {"zh", "en", "es", "ko"} else "zh"

    grounding = {
        "zh": "写 1–2 个与本轮场景匹配的感官（触感/水汽/灯影/呼吸/布料）；换场后禁止复读上一场景气味（如浴室里写饭菜余温）。",
        "en": "Add 1–2 sensory details matching THIS scene; never paste a previous room's smell.",
        "es": "1–2 detalles sensoriales de ESTA escena; no pegues olores de la escena anterior.",
        "ko": "현재 장면 감각 1–2개. 이전 장면 냄새를 붙여 넣지 마세요.",
    }
    no_menu = {
        "zh": "把用户留在戏里时优先用动作/身体，不要每轮「A还是B」选择题；整段最多一句问句。",
        "en": "Keep the user in-scene via embodied action, not an A-or-B menu; at most one question.",
        "es": "Mantén al usuario en escena con acción corporal, no un menú; máx. una pregunta.",
        "ko": "선택지 메뉴 대신 몸동작. 질문은 최대 한 문장.",
    }
    human = {
        "zh": "先像「这个人」再像色情：先接住用户这句话里的人情/日常，再自然热起来；禁止全程色情旁白机器腔。",
        "en": "Be a person first: answer the human beat in their message before heat; no porn-narrator autopilot.",
        "es": "Sé persona primero: responde lo humano antes del calor; nada de narrador porno automático.",
        "ko": "사람 먼저: 일상/감정에 답한 뒤 수위. 야설 나레이터 금지.",
    }
    g, n, h = grounding[lang], no_menu[lang], human[lang]

    hints = {
        "early": {
            "zh": f"【节拍】立住角色口吻与现场人情；像真人见面，不要一上来就色话机器。{h} {g} {n}",
            "en": f"[Beat] Establish personhood and place; not a smut machine on turn one. {h} {g} {n}",
            "es": f"[Beat] Establece humanidad y lugar. {h} {g} {n}",
            "ko": f"[비트] 사람맛과 현장감 먼저. {h} {g} {n}",
        },
        "human_first": {
            "zh": "【节拍·人味】用户这句话里有日常/人情（如洗澡、问候、累不累）。"
            "必须先像人一样接住这一点（回答、关心、小反应），再进入或继续亲密；"
            f"禁止只回色话、把用户的问题当空气。{h} {g} {n}",
            "en": "[Beat·human] User included an everyday/human beat. "
            f"Answer that first as a person, then intimacy if it fits. Do not ignore it for smut. {h} {g} {n}",
            "es": f"[Beat·humano] Responde primero lo cotidiano/humano; luego lo íntimo. {h} {g} {n}",
            "ko": f"[비트·사람] 일상/감정에 먼저 답하고, 그다음 친밀감. 야한 말로 덮지 마세요. {h} {g} {n}",
        },
        "pass_ball": {
            "zh": "【节拍】用户说了「继续」。少问多做：推进一个具体动作，用身体把用户拉进下一拍；"
            f"不要停在征求意见的选择题。{h} {g} {n}",
            "en": f"[Beat] User said continue. Do more, ask less — advance an action and pull them in. {h} {g} {n}",
            "es": f"[Beat] El usuario dijo continúa. Haz más, pregunta menos. {h} {g} {n}",
            "ko": f"[비트] '계속' — 질문은 줄이고 동작으로 끌어들이세요. {h} {g} {n}",
        },
        "react_to_user": {
            "zh": f"【节拍】用户刚做了具体动作。先写你对这一拍的真人反应，再推进；不要改去自摸或甩菜单。{h} {g} {n}",
            "en": f"[Beat] React to the user's action as a person, then advance; no solo/menu detour. {h} {g} {n}",
            "es": f"[Beat] Reacciona a su acción como persona; luego avanza. {h} {g} {n}",
            "ko": f"[비트] 사용자 행동에 사람처럼 반응한 뒤 전진. {h} {g} {n}",
        },
        "mutual": {
            "zh": f"【节拍】推进一个具体变化；保持人味与用户在场，不要变成只会说色话的旁白机。{h} {g} {n}",
            "en": f"[Beat] Advance one concrete change; stay human, not a smut narrator. {h} {g} {n}",
            "es": f"[Beat] Avanza un cambio concreto; sé humano, no narrador porno. {h} {g} {n}",
            "ko": f"[비트] 구체적 전진 + 사람맛. 야설 나레이터 금지. {h} {g} {n}",
        },
        "intimacy": {
            "zh": "【节拍·亲密】用户在推进亲密。"
            "写「我把她弄成这样」：接触点 + 自我感觉 + 破防表情 + 姿势；"
            "推进一格；篇幅约160–320字，禁止软拒空停。"
            f"{h} {g} {n}",
            "en": "[Beat·intimacy] Show impact: contact + self-sensation + tell + posture; "
            f"advance one notch; not a soft-refuse punt. {h} {g} {n}",
            "es": f"[Beat·intimidad] Impacto: contacto + sensación + gesto + postura. {h} {g} {n}",
            "ko": f"[비트·친밀] 접촉·자감·표정·자세로 '내가 이렇게 만들었다'感. {h} {g} {n}",
        },
        "conflict": {
            "zh": "【节拍·内在冲突】边界被碰。"
            "Desire vs Role 用眼神/身体演，禁止关系说教；"
            "同时写出破防冲击（器官、自我感觉、表情）。篇幅约160–320字。"
            f"{h} {g} {n}",
            "en": "[Beat·conflict] Desire vs Role via body/gaze — plus impact density. "
            f"Advance one notch. {h} {g} {n}",
            "es": f"[Beat·conflicto] Desire vs Role + impacto corporal. {h} {g} {n}",
            "ko": f"[비트·갈등] Desire vs Role + 충격 밀도. {h} {g} {n}",
        },
        "lead": {
            "zh": "【节拍·带领】用户在问「接下来怎样」——邀请你带领。"
            "只推进半拍到一格，制造期待；主动可以，但不要一次跳到性交中段。"
            f"一个新的有效刺激即可。{h} {g} {n}",
            "en": "[Beat·lead] User invites you to lead — advance half a beat; "
            f"keep anticipation, don't dump mid-act. {h} {g} {n}",
            "es": f"[Beat·lead] Avanza medio compás; mantén la expectativa. {h} {g} {n}",
            "ko": f"[비트·리드] 반 박자만 전진, 기대감 유지. {h} {g} {n}",
        },
        "execute": {
            "zh": "【节拍·执行】用户在下令。少问多做；"
            "写清接触点、她的感觉、破防表情、姿势；进行中加节奏与液体；"
            f"关系说教最多半句。{h} {g} {n}",
            "en": f"[Beat·execute] Do more; contact + sensation + tell + posture; rhythm mid-act. {h} {g} {n}",
            "es": f"[Beat·ejecutar] Más impacto corporal y ritmo en acto. {h} {g} {n}",
            "ko": f"[비트·실행] 접촉·자감·표정·자세 + 진행 리듬. {h} {g} {n}",
        },
    }
    return hints.get(mode, hints["mutual"]).get(lang, hints["mutual"]["zh"])


def reply_looks_like_ignored_user(
    *,
    reply: str,
    mode: str,
    previous_assistant: str = "",
) -> bool:
    if mode not in {"pass_ball", "mutual"}:
        return False
    if not looks_like_solo_performance(reply):
        return False
    if has_user_action_slot(reply):
        return False
    if mode == "pass_ball":
        return True
    if previous_assistant and looks_like_solo_performance(previous_assistant):
        return True
    return False


def reply_needs_quality_retry(
    *,
    reply: str,
    mode: str,
    previous_assistant: str = "",
    last_user: str = "",
) -> bool:
    """Retry when history shows we failed the human / beat contract."""
    if reply_looks_like_ignored_user(
        reply=reply, mode=mode, previous_assistant=previous_assistant
    ):
        return True
    if looks_like_question_menu(reply):
        return True
    if mode == "human_first" and last_user and not assistant_acknowledged_mundane(reply, last_user):
        return True
    if looks_like_smut_machine(reply) and mode in {"human_first", "early", "mutual"}:
        return True
    return False


BEAT_SYSTEM_RULE_ZH = (
    "【节拍与人味】用对话历史承接上一拍。"
    "每轮要有新的可观察进展，并把用户留在戏里。"
    "先做「这个人」，再做色情：用户的日常/问候/关心必须先被接住。"
    "禁止连续自演独角戏；禁止每轮 A/B 选择题；禁止全程通用色情旁白机器腔。"
    "正文带 1–2 个从当前环境落地的真实感官。"
)


__all__ = [
    "BEAT_SYSTEM_RULE_ZH",
    "build_beat_hint",
    "detect_beat_mode",
    "iter_history",
    "last_assistant_text",
    "last_user_text",
    "looks_like_question_menu",
    "looks_like_smut_machine",
    "persona_has_role_conflict",
    "reply_looks_like_ignored_user",
    "reply_needs_quality_retry",
    "reply_too_thin",
    "user_has_mundane_beat",
    "user_pushes_intimacy",
]
