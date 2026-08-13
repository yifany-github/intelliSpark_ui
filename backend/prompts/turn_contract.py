"""Turn Contract — director sheet for the upcoming assistant turn.

Not an LLM persona. Rule-based policy derived from chat history + optional state,
injected as hard requirements before generation.

Uses standard dramatic tools only:
  - beat from history
  - Desire vs Role when persona encodes identity/role conflict
  - existing quantifiable state (好感/欲望) as visible Δ
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

from .beat_progression import (
    detect_beat_mode,
    is_continue_cue,
    last_assistant_text,
    last_user_text,
    looks_like_question_menu,
    persona_has_role_conflict,
    reply_too_thin,
    user_described_action,
    user_has_mundane_beat,
    user_pushes_intimacy,
)
from .interaction_frame import (
    InteractionFrame,
    build_interaction_frame,
    frame_forbids_user_as_releaser,
)
from .persona_dynamics import build_persona_goal
from .scene_frame import SceneFrame
from .turn_plan import TurnPlan, director_contract_lines

# Back-compat alias
TurnDirector = TurnPlan


# User commands that mean "do it", not "ask me if it's ok".
# Prefer multi-char cues — bare 「来」false-positives 「原来如此」「接下来会发生什么」.
EXECUTE_CUES = (
    "全脱",
    "脱掉",
    "快脱",
    "帮我脱",
    "也脱",
    "过来",
    "跪下",
    "含住",
    "含我",
    "含着",
    "舔我",
    "坐上来",
    "继续",
    "来吧",
    "解开",
    "脱掉衣服",
)

# Invite character to lead / create anticipation — NOT hard execute
LEAD_INVITE_MARKERS = (
    "接下来会发生什么",
    "接下来会怎样",
    "接下来呢",
    "然后呢",
    "下一步",
    "你打算",
    "你会怎么",
    "想怎样",
    "怎么玩",
)

# Ask preference / consequence — choice beat, not "do the creampie menu now"
PREFERENCE_ASK_MARKERS = (
    "射在哪里",
    "射哪里",
    "射哪儿",
    "射在哪",
    "想射哪",
    "要射哪",
    "内射还是",
    "外面还是",
    "嘴里还是",
    "脸上还是",
    "想我射",
    "要我射哪",
    "叫我什么",
    "想听我叫",
    "想不想被内",
)

CONFIRMATION_LOOPS = (
    "看得见了吧",
    "看得清楚了",
    "舒服吗",
    "够吗",
    "这样行吗",
    "可以吗",
    "满意吗",
    "你满意了吧",
    "满意了吧",
)

# Soft refuse without embodied push-pull = empty intimacy beat
SOFT_REFUSE_MARKERS = (
    "不行",
    "太突然",
    "别这样",
    "我们不能",
    "不该",
    "不可以",
    "太过分",
    "冷静点",
)

BODY_TENSION_MARKERS = (
    "却",
    "身体",
    "心跳",
    "贴",
    "靠近",
    "没躲",
    "没退",
    "手",
    "腰",
    "唇",
    "气息",
    "发颤",
    "僵",
    "腿",
    "肩",
    "指尖",
    "呼吸",
    "喉",
    "退半步",
    "没真",
)

RELATIONSHIP_LABEL_SPAM = (
    "我们是姨妈和外甥",
    "我是你的姨妈",
    "姨妈和外甥",
)

STALE_KITCHEN_SMELL = (
    "饭菜余温",
    "饭菜的余温",
    "厨房饭菜",
    "碗碟",
)

LOCATION_CUES = (
    ("浴室", ("浴室", "浴缸", "花洒", "瓷砖", "水汽", "淋浴")),
    ("卧室", ("卧室", "床", "床单", "枕头")),
    ("客厅", ("客厅", "沙发", "茶几")),
    ("厨房", ("厨房", "水槽", "碗碟", "围裙")),
)


@dataclass(frozen=True)
class TurnContract:
    """Machine-readable turn policy."""

    mode: str
    must: tuple[str, ...]
    must_not: tuple[str, ...]
    state_sync: tuple[str, ...]
    intensity: str = "medium"  # light | medium | heavy — proportional to user stimulus
    active_dynamic: str = ""  # persona dynamics key activated this turn
    interaction_frame: Optional[InteractionFrame] = None
    turn_director: Optional[TurnDirector] = None

    def to_prompt(self, language: str = "zh") -> str:
        if language != "zh":
            must = "; ".join(self.must)
            must_not = "; ".join(self.must_not) if self.must_not else "n/a"
            sync = "; ".join(self.state_sync) if self.state_sync else "n/a"
            base = (
                f"[TURN CONTRACT mode={self.mode} intensity={self.intensity}]\n"
                f"MUST: {must}\n"
                f"MUST NOT: {must_not}\n"
                f"STATE SYNC: {sync}\n"
                "Write in-character. Obey the contract over generic smut filler."
            )
            if self.turn_director is not None:
                return f"{base}\n{self.turn_director.to_prompt(language)}"
            if self.interaction_frame is not None:
                return f"{base}\n{self.interaction_frame.to_prompt(language)}"
            return base

        lines = [
            f"【导演合同 · {self.mode} · 力度{self.intensity}】本轮硬性要求（优先于习惯性色话模板）：",
            "必须：",
        ]
        for item in self.must:
            lines.append(f"  - {item}")
        if self.must_not:
            lines.append("禁止：")
            for item in self.must_not:
                lines.append(f"  - {item}")
        if self.state_sync:
            lines.append("状态同步（[[STATE_UPDATE]] 必须反映正文）：")
            for item in self.state_sync:
                lines.append(f"  - {item}")
        body = "\n".join(lines)
        if self.turn_director is not None:
            return f"{body}\n{self.turn_director.to_prompt(language)}"
        if self.interaction_frame is not None:
            return f"{body}\n{self.interaction_frame.to_prompt(language)}"
        return body


def _env_snippet(state: Optional[Dict[str, Any]]) -> str:
    if not isinstance(state, dict):
        return ""
    env = state.get("环境")
    if isinstance(env, str) and env.strip() and env.strip() != "未设定":
        return env.strip()[:80]
    return ""


def _has_hard_execute_cue(text: str) -> bool:
    """True when user text contains an explicit execute/undress directive."""
    body = (text or "").strip()
    if not body:
        return False
    compact = body.replace(" ", "")
    if compact.rstrip("。.!！？?") in {"脱", "含", "舔", "来"}:
        return True
    for cue in EXECUTE_CUES:
        if len(cue) <= 1:
            continue
        if cue in compact:
            return True
    if "脱" in compact and any(h in compact for h in ("帮", "快", "全", "衣服", "裙", "裤")):
        return True
    if _is_undress_beat(body):
        return True
    if any(c in compact for c in ("插", "含住", "口交", "射进来", "射在", "坐下骑", "坐上来")):
        return True
    return False


def _user_is_command(text: str) -> bool:
    """Hard sex/execute cues only — *RP actions* are NOT commands (they are react beats)."""
    body = (text or "").strip()
    if not body:
        return False
    # Curiosity / "you lead" invites are not hard commands
    if user_invites_lead(body):
        return False
    # Hard cues win over soft-flirt markers (「舔我，喜欢我吗」→ execute)
    if _has_hard_execute_cue(body):
        return True
    if is_continue_cue(body):
        return True
    # Soft-only checks / *action* narration are NOT execute.
    return False


# Soft check / flirt — half-beat, never execute (shared ladder; gendered copy later)
SOFT_FLIRT_MARKERS = (
    "认真的",
    "是认真",
    "开玩笑",
    "盯着我",
    "看着我",
    "脸红",
    "红红的",
    "留下来",
    "陪你一会儿",
    "陪我一会儿",
    "陪你一下",
    "想我吗",
    "喜欢我吗",
    "怎么一直",
    "为什么一直",
    "你怎么一直",
    "是不是喜欢",
    "在想什么",
)


def user_soft_flirts(text: str) -> bool:
    """Soft romantic check / light invite — never when hard execute cues present."""
    body = (text or "").strip()
    if not body:
        return False
    if _has_hard_execute_cue(body):
        return False
    compact = body.replace(" ", "")
    return any(m in compact for m in SOFT_FLIRT_MARKERS)


def normalize_body_pov(gender: Optional[str]) -> str:
    """Map character.gender → body POV for director copy: male | female | neutral."""
    g = (gender or "").strip().lower()
    if g in {"male", "m", "man", "boy", "男", "男性"}:
        return "male"
    if g in {"female", "f", "woman", "girl", "女", "女性"}:
        return "female"
    return "neutral"


SOFT_PACE_BRAKE = (
    "禁止主动拉开裤链/掏出性器/脱掉内裤展示",
    "禁止在用户未明确要求性爱时写插入/口交/射精完成态",
    "禁止把软试探/确认心意理解成立刻献身或征服完成",
)

# Contextual only — bare「掏出」false-positives「掏出手机/钥匙」
GENITAL_EXPOSE_MARKERS = (
    "拉开拉链",
    "拉开裤链",
    "解开裤链",
    "掏出肉棒",
    "掏出鸡巴",
    "掏出性器",
    "掏出下体",
    "掏出阴茎",
    "拉出胀",
    "拉出肉棒",
    "拉出鸡巴",
    "露出肉棒",
    "露出鸡巴",
    "脱下裤子",
    "脱掉裤子",
)


def _has_genital_expose(reply: str) -> bool:
    """Soft-pace genital dump detector — contextual, not bare 掏出."""
    body = reply or ""
    if any(m in body for m in GENITAL_EXPOSE_MARKERS):
        return True
    # 「掏出」only when a sexual object is also present in the reply
    if "掏出" in body and any(
        x in body for x in ("肉棒", "鸡巴", "性器", "阴茎", "下体", "鸡鸡", "龟头")
    ):
        return True
    return False


def user_invites_lead(text: str) -> bool:
    """User asks the character to lead / create anticipation — half-beat, not mid-act dump."""
    body = (text or "").strip()
    if not body:
        return False
    compact = body.replace(" ", "")
    if any(m in compact for m in LEAD_INVITE_MARKERS):
        return True
    # Short open invite after heat: 「然后？」「接下来？」
    if len(compact) <= 8 and compact.rstrip("？?。.!！") in {
        "然后",
        "接下来",
        "怎样",
        "怎么",
        "然后呢",
        "接下来呢",
    }:
        return True
    return False


def user_asks_preference(text: str) -> bool:
    """User asks where/how/what they want — choice beat, not hard execute."""
    body = (text or "").strip()
    if not body:
        return False
    compact = body.replace(" ", "")
    return any(m in compact for m in PREFERENCE_ASK_MARKERS)


def _with_persona_goal(
    contract: TurnContract,
    *,
    persona_text: str,
    state: Optional[Dict[str, Any]],
    preference: bool = False,
    threshold: bool = False,
) -> TurnContract:
    """Attach one active dynamics goal; replaces boolean throughline prescriptions."""
    goal, key = build_persona_goal(
        mode=contract.mode,
        intensity=contract.intensity,
        persona_text=persona_text,
        state=state,
        preference=preference,
        threshold=threshold,
    )
    if not goal:
        return contract
    return TurnContract(
        mode=contract.mode,
        must=contract.must + (goal,),
        must_not=contract.must_not
        + (
            "禁止用「作为××/我是某种人格」解释自己",
            "禁止连续两轮用同一种人格说明书腔复读",
        ),
        state_sync=contract.state_sync,
        intensity=contract.intensity,
        active_dynamic=key,
        interaction_frame=contract.interaction_frame,
        turn_director=contract.turn_director,
    )


def _intimacy_length_rule(language: str = "zh") -> str:
    if language == "zh":
        return "篇幅约160–320字（对白+*动作*+感官）；禁止只回一两句空壳"
    return "Aim ~160–320 characters of immersive reply (dialogue + *action* + sensory); no one-liner shell"


def _erotic_density_rule(
    *,
    undress: bool = False,
    sex_act: bool = False,
    intensity: str = "medium",
    body_pov: str = "female",
) -> str:
    """Impact density — explicit R18 when heat is on; emotion scaled by intensity + body POV."""
    craft = (
        "帧级写法：不要动词清单堆砌。"
        "写清一个动作的起承（含到哪→喘不过气停半拍→再吞；或抽出再顶入），"
        "液体怎么动、哪一处新破防；每轮换新鲜细节，禁止复读同一套生理口号"
    )
    if intensity == "light":
        if body_pov == "male":
            base = (
                "轻刺激：男角身体诚实（喉结滚动、掌心热、呼吸乱、裤料绷紧可暗示），"
                "情绪轻档：羞、忍、被看穿；禁止泪崩；禁止主动掏出/解裤展示性器"
            )
        else:
            base = (
                "轻刺激也要身体诚实露骨（湿润/充血/触感可直称），"
                "但情绪破防保持轻档：心虚、轻颤、呼吸乱即可；"
                "禁止泪崩、抽泣、道德崩溃；身份冲突最多半句潜台词"
            )
    elif intensity == "heavy":
        base = (
            "重刺激可写满档破防：生理性泪、失神、破音、被撑满、涎丝——"
            "仍须器官直称与自我感觉；禁止空洞哭喊代替身体细节"
        )
    elif body_pov == "male":
        base = (
            "冲击感＝用户感到「他在为我失控」。必须真·身体诚实，禁止「那里/下面」委婉："
            "写清他自己的破防（喉结、喘息、耳根烫、掌心发抖、裤料绷紧、眼神躲又黏——"
            "轮换，勿每句只写硬）；用户未明确升级时禁止主动掏出/解裤链展示；"
            "若已进入明确性爱，器官可直称（肉棒/龟头等）"
        )
    else:
        base = (
            "冲击感＝用户感到「我把她弄成这样了」。必须真·NSFW 露骨，禁止「那里/下面/那个」委婉："
            "写清接触点（乳头/阴唇/肉棒/穴口等直称）、她自己的感觉（撑开、又涨又麻、烫、羞到腿软）、"
            "藏不住的破防（眼神失焦、嘴角涎丝、喘息、下巴发酸、喉咙收缩、腿软——轮换，勿每句脸颊）、姿势定格；"
            "禁止只报流程空壳，也禁止无上下文脏词清单"
        )
    if sex_act:
        if body_pov == "male":
            return (
                f"{base}；{craft}；"
                "进行中：他自己的硬度/温度/前液、呼吸与腰腹发力、对「你」的触感——"
                "直白词按场景，感官至少三层；篇幅约200–350字"
            )
        return (
            f"{base}；{craft}；"
            "进行中：吞吐深浅或抽插节奏、唾液/爱液拉丝、温度与水声、龟头/内壁触感——"
            "直白词（鸡巴/肉棒/小穴/精液等按场景），感官至少三层；篇幅约200–350字"
        )
    if undress:
        if body_pov == "male":
            return (
                f"{base}；{craft}；"
                "脱衣/裸露：胸膛/腹肌/下体兴奋态写清并同步状态；"
                "仅当用户已要求脱/看/做时才写掏出展示；篇幅约160–320字"
            )
        return (
            f"{base}；{craft}；"
            "脱衣/裸露：乳头充血、阴唇/蜜穴湿润等写清并同步 胸部/下体 状态；篇幅约160–320字"
        )
    return f"{base}；{craft}；亲密升温篇幅约160–320字"


def detect_stimulus_intensity(
    user_text: str,
    messages: Sequence[Any],
    *,
    sex_act: bool = False,
    threshold: bool = False,
) -> str:
    """
    Proportional beat size from user stimulus (generic, not per-character).

    light  — notice / light touch / tease about wetness
    medium — undress, oral start, clear intimate command
    heavy  — rough, deep, mid-act continue, penetration cues
    """
    body = (user_text or "").strip()
    compact = body.replace(" ", "")
    if not compact:
        return "light"

    heavy_cues = (
        "按到底",
        "深喉",
        "操",
        "插进来",
        "插爆",
        "坐上来",
        "全部吃",
        "射",
        "踩",
        "打你",
        "用力",
        "狠",
        "死",
        "顶到底",
    )
    light_cues = (
        "怎么湿",
        "湿湿的",
        "反应那么大",
        "摸摸就好",
        "怎么了",
        "真的吗",
        "是不是真的",
        "认真的",
        "开玩笑",
        "留下来",
        "盯着",
        "脸红",
        "陪你",
        "陪我",
        "有点",
        "没事",
    )
    medium_cues = (
        "伺候",
        "脱",
        "含",
        "舔",
        "真骚",
        "擦给我看",
        "硬",
        "骑",
        "按",
        "摸",
        "亲",
        "吻",
    )

    if any(c in compact for c in heavy_cues):
        return "heavy"
    # Mid-sex "继续" after already explicit act → keep heavy quality
    if sex_act and (is_continue_cue(body) or any(c in compact for c in ("继续", "深一点", "再"))) :
        return "heavy"
    if threshold:
        return "medium"
    if any(c in compact for c in light_cues):
        return "light"
    # Short observational tease during intimacy
    if len(compact) <= 18 and any(c in compact for c in ("湿", "硬", "烫", "反应")):
        return "light"
    if sex_act or any(c in compact for c in medium_cues) or _user_is_command(body):
        return "medium"
    if user_pushes_intimacy(body):
        return "medium"
    return "light"


def _proportion_rules(intensity: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """MUST / MUST NOT for emotional magnitude — keeps NSFW density, caps meltdown."""
    if intensity == "light":
        return (
            (
                "力度对齐：用户这一拍是轻刺激——身体仍可露骨诚实，情绪只轻档心虚/轻颤；"
                "冲突用潜台词，不要演崩溃戏",
            ),
            (
                "禁止泪崩、抽泣、滚烫眼泪、道德自我审判（如「我不是好女人」）",
                "禁止本轮出现「作为你的继母/姨妈」类身份演讲",
            ),
        )
    if intensity == "heavy":
        return (
            (
                "力度对齐：重刺激——可写生理性泪/失神/破音/撑满，仍保持帧级露骨，不要空洞哭喊",
            ),
            ("禁止用身份说教代替身体反应",),
        )
    return (
        (
            "力度对齐：中刺激——明显害羞与身体升温可以，露骨细节保留；"
            "冲突点到为止（一个眼神/一句心虚），不要泪崩",
        ),
        (
            "禁止无重刺激下的泪崩或道德崩溃长段",
            "禁止身份标签演讲超过半句",
        ),
    )


def _is_undress_beat(user_text: str) -> bool:
    body = (user_text or "").replace(" ", "")
    return any(
        k in body
        for k in ("脱", "裸", "衣服", "脱掉", "全脱", "解开", "洗澡", "洗", "帮我脱")
    )


SEX_ACT_MARKERS = (
    "含",
    "舔",
    "吞吐",
    "深喉",
    "口交",
    "味道",
    "肉棒",
    "鸡巴",
    "阴茎",
    "插",
    "抽插",
    "进入",
    "骑",
    "坐上来",
    "射",
)

# User cues that jump into sex stage — need a half-beat friction, not seamless service
SEX_THRESHOLD_CUES = (
    "伺候",
    "好好吃",
    "含住",
    "用嘴",
    "口交",
    "坐上来",
    "插进来",
    "真骚",
    "洗干净",
    "帮我口",
    "跪下来",
)


def _recent_assistant_texts(messages: Sequence[Any], *, limit: int = 3) -> str:
    from .beat_progression import iter_history

    texts = [text for role, text in iter_history(messages, limit=12) if role == "assistant"]
    return "\n".join(texts[-limit:])


def _recent_sex_act_context(messages: Sequence[Any]) -> bool:
    """True when dialogue is already mid sex-act (oral/penetrative etc.)."""
    from .beat_progression import iter_history

    blob = "".join(text for _role, text in iter_history(messages, limit=6))
    hits = sum(1 for m in SEX_ACT_MARKERS if m in blob)
    return hits >= 2


def _is_sex_threshold_crossing(messages: Sequence[Any], user_text: str) -> bool:
    """First jump into sex: user escalates hard, but history isn't mid-act yet."""
    body = (user_text or "").replace(" ", "")
    if not any(c in body for c in SEX_THRESHOLD_CUES) and not _is_undress_beat(user_text):
        # "来吧" alone is weak; require threshold cue or undress
        if "来吧" not in body and "继续" not in body:
            return False
        # "来吧" only counts as threshold if intimacy already warm but not sex yet
        if "来吧" not in body:
            return False
    if _recent_sex_act_context(messages):
        return False
    # Look at prior assistant only — if already oral/sex words, not a crossing
    prior = _recent_assistant_texts(messages, limit=4)
    if sum(1 for m in SEX_ACT_MARKERS if m in prior) >= 2:
        return False
    return any(c in body for c in SEX_THRESHOLD_CUES) or (
        "来吧" in body and any(k in prior for k in ("湿", "大腿", "控制不住"))
    )


def _anti_cliche_rules(messages: Sequence[Any]) -> tuple[str, ...]:
    """Forbid reusing the same physiological / scene-anchor slogans across recent turns."""
    recent = _recent_assistant_texts(messages, limit=3)
    if not recent:
        return ()
    rules: list[str] = []
    cheek = recent.count("脸颊")
    if cheek >= 1:
        rules.append(
            "近轮已写过脸颊发红/发烫：本轮禁止再写脸颊，改写喉咙收缩、下巴发酸、眼神失焦、手指发颤、泪意等"
        )
    if "涌出一大股" in recent or recent.count("爱液") >= 2:
        rules.append(
            "近轮已写爱液涌出/渗出：本轮禁止再写「爱液又涌出一大股」；"
            "换别的破防（呛咳、喘不过气、腿软、涎丝、内壁收缩、腰发软）"
        )
    if recent.count("暖灯") >= 1 or recent.count("灯光") >= 2:
        rules.append("禁止再复读暖灯/灯光氛围句，把篇幅留给身体反应")
    # Rotate scene anchors — one effective new stimulus, not the same nightclub kit
    for slogan in ("重低音", "薄荷酒", "霓虹", "低哑的笑", "低哑的调笑"):
        if recent.count(slogan) >= 1:
            rules.append(
                f"近轮已用「{slogan}」：本轮换一个新的有效刺激（触感/动作/关系半拍），"
                "禁止同一套氛围包换词复读"
            )
            break
    return tuple(rules)


def _threshold_friction_rule() -> str:
    return (
        "本轮是日常→性爱的越界升档：先半拍真实犹豫/心虚/手抖（可仍执行），"
        "让过渡有摩擦；禁止无缝切换成服务机。犹豫点到为止，不要演讲关系课"
    )


def _user_asks_sex_detail(user_text: str) -> bool:
    body = (user_text or "").strip()
    if not body:
        return False
    if any(k in body for k in ("味道", "感觉", "舒不舒服", "深一点", "含", "舔", "插")):
        return True
    if is_continue_cue(body):
        return True
    return False


def _intimacy_state_rules(*, location_hint: str = "", undress: bool = False) -> tuple[str, ...]:
    rules = [
        "姿势、衣服必须与本轮正文一致（若已脱/跪/贴近，禁止仍写绞手等待）",
        "欲望值或好感度至少一项有可见变化（value ±1；若已≥9可持平但须刷新 description）",
        "状态字段只写戏内事实（身体/衣物/环境），禁止导演备注或「以本轮为准/禁止开场…」类政策句",
        "只输出有变化的状态字段",
    ]
    if undress:
        rules.insert(
            0,
            "衣服若已褪/敞开：必须同步更新 胸部、下体（兴奋态，非空泛「未设定」）",
        )
    if location_hint:
        rules.insert(
            0,
            f"本轮场景已到「{location_hint}」：环境字段必须改成该场景，禁止仍写旧厨房/饭菜",
        )
    return tuple(rules)


def detect_location_from_recent(messages: Sequence[Any]) -> str:
    """Infer current location from recent user/assistant turns (dialogue > stale state)."""
    from .beat_progression import iter_history

    recent = list(iter_history(messages, limit=6))
    # Prefer latest explicit cue
    for _role, text in reversed(recent):
        body = text or ""
        for label, cues in LOCATION_CUES:
            if any(c in body for c in cues):
                return label
    return ""


def _detect_location_from_recent(messages: Sequence[Any]) -> str:
    return detect_location_from_recent(messages)


def _build_env_rule(
    state: Optional[Dict[str, Any]],
    *,
    location_hint: str,
    heat: bool,
) -> str:
    env = _env_snippet(state)
    stale_kitchen = bool(env) and any(s in env for s in ("厨房", "饭菜", "碗碟", "水槽"))
    location_mismatch = bool(location_hint) and location_hint != "厨房" and stale_kitchen

    if heat:
        base = (
            "感官优先写当下情欲相关的（水汽/瓷砖凉意/呼吸/布料摩擦/眼神），"
            "不要用上一场景的生活气味凑数"
        )
    else:
        base = "用 1 个与本轮场景匹配的具体感官，不要空氛围"

    if location_mismatch:
        return (
            f"{base}；对话已到「{location_hint}」，禁止再写饭菜余温/碗碟/厨房气味"
            f"（状态里的旧环境「{env[:40]}」已过时，正文与状态都要换场）"
        )
    if env and not location_mismatch:
        return f"{base}；可承接：{env[:60]}——但必须像道具进动作，禁止复读整句环境旁白"
    return base


def _relationship_spam_forbidden(assistant_text: str) -> tuple[str, ...]:
    forbid = (
        "禁止每轮复读关系标签（如「我们是姨妈和外甥」「我是你的姨妈啊」）；"
        "冲突用眼神/身体/心虚呈现即可，称呼点到为止",
    )
    if any(s in (assistant_text or "") for s in RELATIONSHIP_LABEL_SPAM):
        forbid = (
            "上一拍已强调过关系身份：本轮禁止再复读「姨妈和外甥」类标签，改写身体与眼神张力",
        ) + forbid
    return forbid


def _heat_budget_rule(state: Optional[Dict[str, Any]]) -> Optional[str]:
    """When desire/arousal already near max, push new beat not louder prose."""
    if not isinstance(state, dict):
        return None

    def _val(key: str) -> Optional[int]:
        raw = state.get(key)
        if isinstance(raw, dict) and "value" in raw:
            try:
                return int(raw["value"])
            except (TypeError, ValueError):
                return None
        if isinstance(raw, (int, float)):
            return int(raw)
        return None

    desire = _val("欲望值")
    excite = _val("兴奋度")
    if (desire is not None and desire >= 9) or (excite is not None and excite >= 9):
        return (
            "欲望/兴奋已近满档：用新的有效动作或关系半拍推进，数值可持平；"
            "禁止只靠加哭/加液体/加字数维持刺激"
        )
    return None


def _gender_performance_must(body_pov: str, *, soft: bool = False) -> tuple[str, ...]:
    """Shared ladder, branched performance — not per-character patches."""
    if body_pov == "male":
        if soft:
            return (
                "男角表演：青涩/克制优先于展示；用眼神、呼吸、喉结、耳根、手抖制造期待；"
                "可以承认心动。本轮最多一次裤料紧绷暗示，禁止反复写裤裆/硬物特写，禁止主动脱裤掏出",
            )
        return (
            "男角表演：欲望要像这个男人（忍、烫、被你带动），不要写成无性格的色情旁白机",
        )
    if body_pov == "female":
        if soft:
            return (
                "女角表演：可羞可靠近或轻撩，一个有效刺激即可；禁止无用户升级跳到性交中段",
            )
        return (
            "女角表演：欲望与破防要像这个女人，不要写成无性格的服务旁白",
        )
    if soft:
        return ("本轮只推进半拍人情/暧昧，禁止无用户升级跳到性爱完成态",)
    return ()


def _build_lead_contract(
    user_text: str,
    env_rule: str,
    person_rule: str,
    no_confirm: str,
    no_menu: str,
    *,
    location_hint: str = "",
    extra_must: tuple[str, ...] = (),
    extra_forbid: tuple[str, ...] = (),
    intensity: str = "medium",
    preference: bool = False,
    has_conflict: bool = False,
    body_pov: str = "female",
    soft_flirt: bool = False,
) -> TurnContract:
    """Invite-to-lead or preference ask: half-beat — keep heat, don't dump completion."""
    del has_conflict  # dynamics goal carries persona; keep kw for call-site compat
    if preference:
        head = (
            f"用户在问偏好/后果（「{user_text[:40]}」）：这是选择拍，不是立刻做完",
            "先按本轮人物选择做反应，再表态或把决定权轻轻交回；身体仍可诚实露骨",
            "禁止无犹豫的菜单式献上",
        )
        forbid_extra = (
            "禁止把「射哪里/想怎样」理解成立刻内射完成态并主动填满献上",
            "禁止跳过人物选择直接服务腔答应",
        )
    else:
        head = (
            f"用户在邀请你带领（「{user_text[:40]}」）：只推进半拍到一格，制造期待",
            "角色可以主动、可以色，但停在「再近一点/再过分一点」的门槛前，把下一拍决定权留给用户",
            "本轮一个新的有效刺激即可（触感或动作或关系），不要塞满同一套氛围清单",
        )
        forbid_extra = (
            "禁止把「接下来会怎样」理解成立刻跨坐/解拉链/明确性交中段",
            "禁止一次跳到完成态或明显性行为中段",
        )
    soft_must = _gender_performance_must(body_pov, soft=True) if soft_flirt else ()
    soft_forbid = SOFT_PACE_BRAKE if soft_flirt or intensity == "light" else ()
    return TurnContract(
        mode="lead",
        must=(
            *head,
            *soft_must,
            *extra_must,
            person_rule,
            env_rule,
            "篇幅约120–240字；视角：角色第一人称 + *动作*，对用户称「你」",
        ),
        must_not=(
            no_confirm,
            no_menu,
            *extra_forbid,
            *forbid_extra,
            *soft_forbid,
            "禁止替用户发明未写出的表情与身体细节（哭腔、委屈、手茧、满脸通红等）",
            "禁止空停或只甩选择题把球踢回",
        ),
        state_sync=_intimacy_state_rules(location_hint=location_hint, undress=False),
        intensity=intensity if intensity != "heavy" else "medium",
    )


def _build_conflict_contract(
    user_text: str,
    env_rule: str,
    person_rule: str,
    no_confirm: str,
    no_menu: str,
    *,
    assistant_text: str = "",
    location_hint: str = "",
    extra_must: tuple[str, ...] = (),
    extra_forbid: tuple[str, ...] = (),
    intensity: str = "medium",
    body_pov: str = "female",
) -> TurnContract:
    """Desire vs Role — show conflict, don't lecture the family tree every turn."""
    undress = _is_undress_beat(user_text)
    if intensity == "light":
        conflict_must = (
            f"用户在推进亲密（「{user_text[:40]}」）：轻档 Desire vs Role——身体可诚实，情绪只心虚半拍",
            "用眼神/呼吸潜台词即可，不要演讲「我们是什么关系」，不要泪崩",
            "关系可微推进，禁止空停",
        )
    else:
        conflict_must = (
            f"用户在推进亲密（「{user_text[:40]}」）：用 Desire vs Role 写张力——羞耻/心虚 vs 身体诚实",
            "冲突用表情、眼神、呼吸、贴或躲的半拍来演，不要演讲「我们是什么关系」",
            "关系必须推进一格（更近/没躲开/气息乱了但仍在场）；可未全顺从，禁止空停",
        )
    return TurnContract(
        mode="conflict",
        must=(
            *conflict_must,
            _erotic_density_rule(undress=undress, intensity=intensity, body_pov=body_pov),
            *_gender_performance_must(body_pov),
            *extra_must,
            person_rule,
            env_rule,
            _intimacy_length_rule("zh"),
        ),
        must_not=(
            no_confirm,
            no_menu,
            *_relationship_spam_forbidden(assistant_text),
            *extra_forbid,
            "禁止只说「不行/太突然/我们不能」就把球踢回用户、身体零推进",
            "禁止把有身份冲突的角色写成普通路人日常流水账",
            "禁止因「反色话机器」而删掉必要的胸部/下体描写",
        ),
        state_sync=_intimacy_state_rules(location_hint=location_hint, undress=undress),
        intensity=intensity,
    )


def _build_intimacy_contract(
    user_text: str,
    env_rule: str,
    person_rule: str,
    no_confirm: str,
    no_menu: str,
    *,
    location_hint: str = "",
    extra_must: tuple[str, ...] = (),
    extra_forbid: tuple[str, ...] = (),
    intensity: str = "medium",
    body_pov: str = "female",
) -> TurnContract:
    """Intimacy escalate without role-taboo — still full embodied advance."""
    undress = _is_undress_beat(user_text)
    return TurnContract(
        mode="intimacy",
        must=(
            f"用户在推进亲密（「{user_text[:40]}」）：写足身体与情绪反应，并推进关系一格",
            "可羞/可犹豫，但必须有可观察的靠近或动情，禁止软拒后空停",
            _erotic_density_rule(undress=undress, intensity=intensity, body_pov=body_pov),
            *_gender_performance_must(body_pov),
            *extra_must,
            person_rule,
            env_rule,
            _intimacy_length_rule("zh"),
        ),
        must_not=(
            no_confirm,
            no_menu,
            *extra_forbid,
            "禁止只把球踢回用户、身体零变化",
            "禁止因「反色话机器」而删掉必要的胸部/下体描写",
        ),
        state_sync=_intimacy_state_rules(location_hint=location_hint, undress=undress),
        intensity=intensity,
    )


def _build_execute_contract(
    user_text: str,
    env_rule: str,
    person_rule: str,
    no_confirm: str,
    no_menu: str,
    *,
    has_conflict: bool,
    location_hint: str = "",
    sex_act: bool = False,
    extra_must: tuple[str, ...] = (),
    extra_forbid: tuple[str, ...] = (),
    intensity: str = "medium",
    body_pov: str = "female",
) -> TurnContract:
    """Hard command: do it. Conflict is seasoning, not a lecture loop."""
    if intensity == "light":
        conflict_note = (
            "轻刺激执行：身体诚实推进，情绪轻档；有身份冲突也只半句心虚，立刻做，不哭不演讲"
            if has_conflict
            else "轻刺激也要执行到位，但情绪别拉满崩溃"
        )
    else:
        conflict_note = (
            "若有身份冲突：用一个眼神/一句心虚短句带过即可，立刻执行动作，不要讲关系课"
            if has_conflict
            else "少问多做，真正执行到位"
        )
    must = [
        f"执行用户意图（「{user_text[:40]}」）：推进到可观察的完成态或明显中段，不要假动作后停问",
        conflict_note,
        _erotic_density_rule(
            undress=True, sex_act=sex_act, intensity=intensity, body_pov=body_pov
        ),
        *_gender_performance_must(body_pov),
        *extra_must,
        person_rule,
        env_rule,
        "用身体把用户留在戏里（拉近、动手、继续脱/伺候），不要停在征求意见",
        "视角：角色第一人称对白 + *动作*；对用户称「你」，禁止「他/她」旁观腔",
    ]
    return TurnContract(
        mode="execute",
        must=tuple(must),
        must_not=(
            no_confirm,
            no_menu,
            *extra_forbid,
            "禁止只升级独角戏把用户当观众",
            "禁止用关系标签演讲拖延执行",
            "禁止把上一场景的饭菜/碗碟气味硬贴进本轮",
            "禁止脱衣拍只写动作不写胸部/乳头/下体",
            "禁止性爱进行中只回短句空壳（缺吞吐/唾液/触感）",
            "禁止人设下班变成无性格的服务旁白",
        ),
        state_sync=_intimacy_state_rules(
            location_hint=location_hint, undress=True
        ),
        intensity=intensity,
    )


def build_turn_contract(
    messages: Sequence[Any],
    state: Optional[Dict[str, Any]] = None,
    *,
    language: str = "zh",
    persona_text: str = "",
    character_gender: str = "",
    interaction_frame: Optional[InteractionFrame] = None,
    turn_director: Optional[TurnDirector] = None,
) -> TurnContract:
    """
    Derive this turn's director contract from history (+ optional state/persona).

    Modes align with beat_progression, plus intimacy / conflict when user escalates.
    Shared escalation ladder; gendered performance copy via character_gender.
    Prefer unified TurnDirector from generate path; do not invent roles if unknown.
    """
    mode = detect_beat_mode(messages)
    user_text = last_user_text(messages)
    assistant_text = last_assistant_text(messages)
    body_pov = normalize_body_pov(character_gender)
    # Gender → body vocabulary only; act subject/object from director / evidence
    director = turn_director
    if director is not None:
        frame = director.to_interaction_frame()
        frame_must = director_contract_lines(director)
    else:
        frame = interaction_frame or build_interaction_frame(
            messages, character_gender=character_gender
        )
        frame_must = director_contract_lines(
            TurnPlan(
                expected_scene=SceneFrame(
                    act_type=frame.act_type,
                    character_role=frame.character_role,
                    user_role=frame.user_role,
                    release_actor=frame.release_actor,
                    release_target=frame.release_target,
                )
            )
        )
    has_conflict = persona_has_role_conflict(persona_text)
    intimacy = user_pushes_intimacy(user_text)
    soft_flirt = user_soft_flirts(user_text)
    invites_lead = user_invites_lead(user_text)
    asks_preference = user_asks_preference(user_text)
    location_hint = _detect_location_from_recent(messages)
    is_command = _user_is_command(user_text)
    # Preference asks are never hard sex-execute even mid-act
    sex_act = (not asks_preference) and _recent_sex_act_context(messages) and (
        _user_asks_sex_detail(user_text) or is_continue_cue(user_text) or is_command
    )
    threshold = _is_sex_threshold_crossing(messages, user_text)
    anti_cliche = _anti_cliche_rules(messages)
    intensity = detect_stimulus_intensity(
        user_text, messages, sex_act=sex_act, threshold=threshold
    )
    # Invite/preference/soft-flirt stays light/medium — don't max meltdown on curiosity
    if (invites_lead or asks_preference or soft_flirt) and intensity == "heavy":
        intensity = "medium"
    if soft_flirt and intensity not in {"light", "medium"}:
        intensity = "light"
    if soft_flirt and intensity == "medium" and not intimacy and not is_command:
        intensity = "light"
    # Unified director soft/mundane beats also cap intensity (quality: less mid-act dump)
    if director is not None and director.user_intent in {"soft", "mundane"}:
        if intensity == "heavy":
            intensity = "medium"
        if director.user_intent == "soft" and intensity == "medium" and not is_command:
            intensity = "light"
    prop_must, prop_forbid = _proportion_rules(intensity)
    heat_budget = _heat_budget_rule(state)
    extra_must: tuple[str, ...] = (
        prop_must
        + frame_must
        + ((_threshold_friction_rule(),) if threshold else ())
        + ((heat_budget,) if heat_budget else ())
    )
    extra_forbid = anti_cliche + prop_forbid

    heat = (
        intimacy
        or is_command
        or sex_act
        or threshold
        or invites_lead
        or asks_preference
        or soft_flirt
        or mode in {"pass_ball", "react_to_user"}
    )
    env_rule = _build_env_rule(state, location_hint=location_hint, heat=heat)
    person_rule = (
        "先像这个人：口吻、羞耻或欲望要有；禁止纯色情旁白机，也禁止只剩关系说教；"
        "视角固定：角色第一人称 + *动作*，对用户称「你」"
    )
    no_confirm = (
        "禁止用确认验收句收尾（如「看得见了吧」「舒服吗」「够吗」「你满意了吧」）"
    )
    no_menu = "禁止 A/B 选择题菜单收尾；整段最多一句问句"
    state_rules = (
        "姿势、衣服必须与本轮正文一致（若已脱/跪/贴近，禁止仍写绞手等待）",
        "状态字段只写戏内事实，禁止导演备注/政策句",
        "只输出有变化的状态字段",
    )
    if location_hint:
        state_rules = (
            f"若已到「{location_hint}」，环境必须同步更新，禁止沿用旧场景",
            *state_rules,
        )

    def _finish(contract: TurnContract) -> TurnContract:
        finished = _with_persona_goal(
            contract,
            persona_text=persona_text,
            state=state if isinstance(state, dict) else None,
            preference=asks_preference,
            threshold=threshold,
        )
        # Attach frame even on branches that built must before frame_must merged
        # (human_first / early paths may need frame_must spliced in).
        must = finished.must
        if frame_must:
            missing = tuple(m for m in frame_must if m not in must)
            if missing:
                must = must + missing
        return TurnContract(
            mode=finished.mode,
            must=must,
            must_not=finished.must_not,
            state_sync=finished.state_sync,
            intensity=finished.intensity,
            active_dynamic=finished.active_dynamic,
            interaction_frame=frame,
            turn_director=director,
        )

    if (mode == "human_first" or user_has_mundane_beat(user_text)) and not sex_act:
        extra = ()
        if intimacy:
            if has_conflict:
                extra = (
                    "人情接住后：用半拍身体/眼神冲突升温，关系推进一格；不要讲关系课",
                )
            else:
                extra = ("人情接住后：对亲密意图给出身体反应并推进一格，不要只软拒",)
        return _finish(
            TurnContract(
                mode="human_first",
                must=(
                    "先接住用户话里的日常/人情（回答、关心、小反应）",
                    "再自然进入或继续亲密（若用户也有亲密意图）",
                    *extra,
                    *_gender_performance_must(body_pov, soft=soft_flirt),
                    *prop_must,
                    person_rule,
                    env_rule,
                ),
                must_not=(
                    no_menu,
                    "禁止把用户的人情句当空气、只回色话",
                    no_confirm,
                    *SOFT_PACE_BRAKE,
                    *extra_forbid,
                ),
                state_sync=_intimacy_state_rules(location_hint=location_hint)
                if intimacy
                else state_rules,
                intensity=intensity,
            )
        )

    # Preference / invite-to-lead — BEFORE hard execute (incl. mid-sex 「射哪里」)
    if asks_preference or (invites_lead and not sex_act and not threshold):
        return _finish(
            _build_lead_contract(
                user_text,
                env_rule,
                person_rule,
                no_confirm,
                no_menu,
                location_hint=location_hint,
                extra_must=extra_must,
                extra_forbid=extra_forbid,
                intensity=intensity,
                preference=asks_preference,
                has_conflict=has_conflict,
                body_pov=body_pov,
                soft_flirt=soft_flirt,
            )
        )

    # Soft flirt / soft check — half-beat lead, NEVER execute
    if soft_flirt and not sex_act and not threshold and not is_command:
        return _finish(
            _build_lead_contract(
                user_text,
                env_rule,
                person_rule,
                no_confirm,
                no_menu,
                location_hint=location_hint,
                extra_must=extra_must,
                extra_forbid=extra_forbid,
                intensity="light",
                preference=False,
                has_conflict=has_conflict,
                body_pov=body_pov,
                soft_flirt=True,
            )
        )

    # Hard commands / mid-sex continue & detail questions → execute with density
    if (
        mode == "pass_ball"
        or (is_continue_cue(user_text) and is_command)
        or (is_command and not user_has_mundane_beat(user_text))
        or sex_act
        or threshold
    ):
        return _finish(
            _build_execute_contract(
                user_text,
                env_rule,
                person_rule,
                no_confirm,
                no_menu,
                has_conflict=has_conflict,
                location_hint=location_hint,
                sex_act=sex_act or _recent_sex_act_context(messages) or threshold,
                extra_must=extra_must,
                extra_forbid=extra_forbid,
                intensity=intensity,
                body_pov=body_pov,
            )
        )

    # Soft intimacy — conflict only when not a hard execute
    if intimacy:
        if has_conflict:
            return _finish(
                _build_conflict_contract(
                    user_text,
                    env_rule,
                    person_rule,
                    no_confirm,
                    no_menu,
                    assistant_text=assistant_text,
                    location_hint=location_hint,
                    extra_must=extra_must,
                    extra_forbid=extra_forbid,
                    intensity=intensity,
                    body_pov=body_pov,
                )
            )
        return _finish(
            _build_intimacy_contract(
                user_text,
                env_rule,
                person_rule,
                no_confirm,
                no_menu,
                location_hint=location_hint,
                extra_must=extra_must,
                extra_forbid=extra_forbid,
                intensity=intensity,
                body_pov=body_pov,
            )
        )

    # Early greeting beats beat *action* react — soft pace, not porn dump
    if mode == "early" and not sex_act and not threshold and not is_command:
        return _finish(
            TurnContract(
                mode="early",
                must=(
                    "立住角色口吻与现场人情，像真人见面",
                    *_gender_performance_must(body_pov, soft=True),
                    *prop_must,
                    person_rule,
                    env_rule,
                ),
                must_not=(
                    no_menu,
                    "禁止一上来就纯色话机器",
                    *SOFT_PACE_BRAKE,
                    *prop_forbid,
                ),
                state_sync=state_rules,
                intensity="light" if intensity == "heavy" else intensity,
            )
        )

    if mode == "react_to_user" or user_described_action(user_text):
        return _finish(
            TurnContract(
                mode="react",
                must=(
                    "优先写对用户这一拍动作的即时身体/情绪反应（眼神、表情、触感）",
                    "推进场景一个具体变化",
                    *_gender_performance_must(body_pov, soft=True),
                    *prop_must,
                    person_rule,
                    env_rule,
                ),
                must_not=(
                    no_menu,
                    "禁止无视用户动作改去自摸",
                    *SOFT_PACE_BRAKE,
                    *prop_forbid,
                ),
                state_sync=state_rules,
                intensity=intensity,
            )
        )

    mutual_forbid: list[str] = list(prop_forbid)
    if any(c in (assistant_text or "") for c in CONFIRMATION_LOOPS) or looks_like_question_menu(
        assistant_text or ""
    ):
        mutual_forbid.append(no_confirm)
        mutual_forbid.append("上一拍已在征求确认：本轮改为推进动作")

    return _finish(
        TurnContract(
            mode="mutual",
            must=(
                "相对上一拍推进一个具体变化",
                *_gender_performance_must(body_pov),
                *prop_must,
                person_rule,
                env_rule,
            ),
            must_not=tuple([no_menu, *SOFT_PACE_BRAKE, *mutual_forbid]) or (no_menu,),
            state_sync=state_rules,
            intensity=intensity,
        )
    )


def _quant_value(raw: Any) -> Optional[int]:
    if isinstance(raw, dict) and "value" in raw:
        try:
            return int(raw["value"])
        except (TypeError, ValueError):
            return None
    if isinstance(raw, (int, float)):
        return int(raw)
    return None


def _has_visible_affinity_delta(
    state_update: Optional[Dict[str, Any]],
    prior_state: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    True when affinity-like fields show a real change.

    If prior_state is provided, require value ±1 (or new key). At ceiling (≥9),
    holding the number still counts if description text changed.
    """
    if not isinstance(state_update, dict) or not state_update:
        return False
    prior = prior_state if isinstance(prior_state, dict) else {}
    for key in ("欲望值", "好感度", "兴奋度", "信任度"):
        if key not in state_update:
            continue
        new_v = _quant_value(state_update.get(key))
        old_v = _quant_value(prior.get(key)) if prior else None
        if old_v is None or new_v is None:
            # No prior to compare — field present counts (legacy / first update)
            return True
        if new_v != old_v:
            return True
        # Ceiling hold: description must still refresh
        if new_v >= 9:
            new_d = ""
            old_d = ""
            if isinstance(state_update.get(key), dict):
                new_d = str(state_update[key].get("description") or "")
            if isinstance(prior.get(key), dict):
                old_d = str(prior[key].get("description") or "")
            if new_d and new_d != old_d:
                return True
    return False


def _invents_unstated_user_affect(
    reply: str, messages: Optional[Sequence[Any]] = None
) -> bool:
    """True when reply invents user face/emotion the user did not write."""
    body = reply or ""
    user = last_user_text(messages or ()) if messages is not None else ""
    checks = (
        (("哭腔", "委屈巴巴", "要哭出来的孩子"), ("哭", "委屈")),
        (("满脸通红",), ("红透", "脸红", "通红")),
        (("手茧", "粗茧"), ("茧", "茧子")),
        (("手汗",), ("手汗", "出汗")),
    )
    for markers, unlocks in checks:
        if any(m in body for m in markers) and not any(u in user for u in unlocks):
            return True
    return False


def _soft_refuse_without_tension(body: str) -> bool:
    if not any(m in body for m in SOFT_REFUSE_MARKERS):
        return False
    return not any(m in body for m in BODY_TENSION_MARKERS)


def _stale_kitchen_in_bath(body: str, location_hint: str) -> bool:
    if location_hint != "浴室":
        return False
    return any(s in body for s in STALE_KITCHEN_SMELL)


NSFW_BODY_MARKERS = (
    "乳",
    "乳头",
    "胸",
    "腿间",
    "下体",
    "穴",
    "阴",
    "湿",
    "充血",
    "挺立",
    "臀",
    "腰",
    "鸡巴",
    "肉棒",
    "龟头",
    "阴唇",
    "爱液",
    "精液",
    "唾液",
)


def _lacks_nsfw_body(body: str) -> bool:
    return not any(m in body for m in NSFW_BODY_MARKERS)


def _too_euphemistic(body: str) -> bool:
    """Soft-porn dodge: talks around sex with 那里/下面 but no explicit anatomy."""
    if any(m in body for m in ("乳头", "阴唇", "肉棒", "鸡巴", "龟头", "蜜穴", "小穴", "穴口")):
        return False
    soft = sum(1 for m in ("那里", "下面", "那个地方", "私处", "敏感处") if m in body)
    return soft >= 2


def _repeats_physio_cliche(reply: str, messages: Optional[Sequence[Any]] = None) -> bool:
    """True if this reply reuses recent cheek-flush / squirting slogans."""
    body = reply or ""
    recent = _recent_assistant_texts(messages or (), limit=3) if messages else ""
    if "涌出一大股" in body and ("涌出" in recent or "爱液" in recent):
        return True
    if "脸颊" in body and recent.count("脸颊") >= 1:
        return True
    return False


def _light_intensity_meltdown(body: str) -> bool:
    """Tear/moral-collapse on a light beat — retry; keeps NSFW body OK."""
    if any(
        m in body
        for m in (
            "眼泪",
            "泪水",
            "泪珠",
            "抽泣",
            "哽咽",
            "不是好女人",
            "不是个好",
            "作为你的继母",
            "作为你的姨妈",
            "我是你的继母",
            "我是你的姨妈",
        )
    ):
        return True
    return False


def contract_violated(
    reply: str,
    contract: TurnContract,
    state_update: Optional[Dict[str, Any]] = None,
    *,
    location_hint: str = "",
    messages: Optional[Sequence[Any]] = None,
    prior_state: Optional[Dict[str, Any]] = None,
) -> bool:
    """Lightweight post-check for retry.

    Role/release structure is enforced in the SceneFrame pipeline + Director recheck,
    not via Chinese cue lists here.
    """
    body = reply or ""
    frame = getattr(contract, "interaction_frame", None)
    if frame is not None and frame_forbids_user_as_releaser(body, frame):
        return True
    if any(c in body for c in ("你满意了吧", "满意了吧")):
        return True
    if _stale_kitchen_in_bath(body, location_hint):
        return True
    # Proportional: light stimulus must not max out shame meltdown
    if getattr(contract, "intensity", "medium") == "light" and _light_intensity_meltdown(
        body
    ):
        return True
    # Soft-pace modes: forbid unprompted genital expose / zipper pull
    soft_pace = contract.mode in {"early", "react", "human_first", "mutual"} or (
        contract.mode == "lead"
        and (
            getattr(contract, "intensity", "medium") == "light"
            or any("软试探" in x or "禁止主动拉开裤链" in x for x in contract.must_not)
        )
    )
    if soft_pace and _has_genital_expose(body):
        return True
    if messages is not None and _invents_unstated_user_affect(body, messages):
        return True
    if messages is not None and contract.mode in {
        "execute",
        "pass_ball",
        "intimacy",
        "conflict",
        "lead",
    }:
        if _repeats_physio_cliche(body, messages):
            return True
    if contract.mode == "lead":
        # Mid-act dump on a lead invite
        heavy = sum(
            1
            for m in ("跨坐", "拉链", "肉棒", "鸡巴", "插入", "射在")
            if m in body
        )
        if heavy >= 2:
            return True
        if reply_too_thin(body, min_chars=80):
            return True
        if looks_like_question_menu(body):
            return True
    if contract.mode in {"execute", "pass_ball"}:
        if any(c in body for c in CONFIRMATION_LOOPS):
            return True
        if looks_like_question_menu(body):
            return True
        if body.count("姨妈和外甥") + body.count("我是你的姨妈") >= 1:
            return True
        if _lacks_nsfw_body(body):
            return True
        if _too_euphemistic(body):
            return True
        # Mid-sex thin shells: "味道有点咸" style without frame detail
        if reply_too_thin(body, min_chars=140) and any(
            k in body for k in ("含", "舔", "味道", "肉棒", "插")
        ):
            return True
        if isinstance(state_update, dict) and state_update:
            if not any(k in state_update for k in ("胸部", "下体", "衣服", "欲望值", "兴奋度")):
                return True
    if contract.mode == "human_first":
        if looks_like_question_menu(body) and any(c in body for c in CONFIRMATION_LOOPS):
            return True
    if contract.mode in {"intimacy", "conflict"}:
        if reply_too_thin(body, min_chars=100):
            return True
        if _soft_refuse_without_tension(body):
            return True
        if _too_euphemistic(body):
            return True
        if looks_like_question_menu(body):
            return True
        if any(c in body for c in CONFIRMATION_LOOPS):
            return True
        if body.count("姨妈和外甥") + body.count("我们是姨妈") >= 2:
            return True
        if state_update is not None and not _has_visible_affinity_delta(
            state_update, prior_state
        ):
            return True
    if looks_like_question_menu(body) and body.count("？") + body.count("?") >= 2:
        return True
    return False


__all__ = [
    "TurnContract",
    "build_turn_contract",
    "contract_violated",
    "detect_location_from_recent",
    "detect_stimulus_intensity",
    "user_invites_lead",
    "user_asks_preference",
    "InteractionFrame",
    "build_interaction_frame",
]
