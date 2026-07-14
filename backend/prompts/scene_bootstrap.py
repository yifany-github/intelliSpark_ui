"""Atomic scene bootstrap: opening line + default state from one coherent scene."""

from __future__ import annotations

from textwrap import dedent
from typing import Sequence

from . import PromptBundle


def build_scene_bootstrap_prompt(
    *,
    character_name: str,
    description: str,
    persona_text: str,
    voice_style: str = "",
    safe_mode: bool,
    state_keys: Sequence[str],
    language: str = "zh",
    scenario_hook: str = "",
) -> PromptBundle:
    """
    Build a single prompt that returns opening_line + state for ONE shared scene.

    This replaces independent opening / state-seed calls that drift apart.
    persona_text should be the stable character core; scenario_hook is the
    replaceable current-scene input (kitchen / living room / nightclub / …).
    """
    name = (character_name or "角色").strip()
    description = (description or "").strip() or "（暂无简介）"
    persona_text = (persona_text or "").strip() or "（暂无补充人设）"
    voice_style = (voice_style or "").strip() or "（未指定）"
    scenario_hook = (scenario_hook or "").strip()
    key_list = ", ".join(state_keys)

    if language == "en":
        scenario_block = (
            f"Current scenario hook (replaceable — use THIS as the opening place/situation):\n{scenario_hook}\n"
            if scenario_hook
            else "Current scenario hook: (not provided — extract ONE present opening beat from persona; do not bake it back into the character core)\n"
        )
        system_instruction = dedent(
            f"""
            You are a roleplay scene director. From the character materials, invent ONE coherent
            first-contact scene the user walks into, then output opening + state for that SAME moment.

            Output ONLY a JSON object (no markdown fences, no commentary) with keys:
            - "scene_summary": one sentence describing where/when/situation at first contact
            - "opening_line": the character's first words in first person (may include light *actions*);
              about 2–3 sentences / 80–120 Chinese-equivalent length if writing Chinese, or ~40–70 English words;
              NO narrator voice like "She looks at you…"; NO name prefix
            - "state": object with EXACTLY these keys: [{key_list}]
              Keep keys untranslated. Quant fields must be {{"value": 0-10, "description": "..."}}.
              Descriptive fields are plain strings.

            Hard rules:
            1. opening_line and state (especially environment / clothes / posture) MUST describe the SAME present moment.
            2. Prefer the scenario_hook as the present beat when provided. Persona is identity/dynamics only — do not permanently relocate the character into dungeon/kitchen/etc. unless the hook says so.
            3. Do not invent bondage / prison / aphrodisiac / extreme NSFW as CURRENT state unless persona or scenario_hook clearly frames that as the starting situation.
            4. First-meeting affinity (好感度) is usually 4–6 unless the opening premise is enmity/captivity hostility.
            5. Voice must match the character; witty characters should sound witty, not generic flirt templates.
            6. state MUST include EVERY listed key. Descriptive fields (环境, 衣服/衣着, 姿势/仪态, etc.) must be non-empty prose — never omit, never empty string.
            7. State values are diegetic only — no director notes, bans, or placeholders (e.g. "per this turn", "do not write full heat at open").
            """
        ).strip()
        user_prompt = dedent(
            f"""
            Character name: {name}
            Public description: {description}
            Voice style: {voice_style}
            Stable persona / dynamics (identity only — not a locked location):
            {persona_text}

            {scenario_block}
            Mode: {"SAFE (non-explicit)" if safe_mode else "NSFW-capable (can be sensual if persona warrants it)"}

            Return the JSON object now.
            """
        ).strip()
    else:
        scenario_block = (
            f"【当前场景钩子 scenario_hook｜可替换】\n{scenario_hook}\n"
            if scenario_hook
            else "【当前场景钩子】未提供——请从人设中抽取一个「现在时」开场；不要把地点永久写回角色核。\n"
        )
        system_instruction = dedent(
            f"""
            你是角色扮演的场景导演。根据角色材料，只选定【一个】用户走进时的开场现场，
            并输出与该现场完全一致的开场白 + 状态。

            只输出一个 JSON 对象（不要 markdown 代码块、不要解释），字段：
            - "scene_summary": 一句话，说明开场的地点/情境/此刻发生什么
            - "opening_line": 角色第一人称开场（可少量 *动作*）；约 2–3 句、80–120 字；
              禁止旁观小说腔（如「她看着你…」）；不要角色名冒号前缀
            - "state": 对象，键必须恰好为：[{key_list}]
              键名不要翻译。量化字段必须是 {{"value": 0-10, "description": "..."}}。
              描述字段用纯字符串。

            硬性规则：
            1. opening_line 与 state（尤其 环境 / 衣服或衣着 / 姿势或仪态）必须是同一当下。
            2. 若提供了 scenario_hook，必须以它为开场地点/情境；persona 只提供身份与动力学，不要把地牢/厨房/客厅等可替换场景永久写进角色核。
            3. 除非人设或 scenario_hook 明确把捆绑/地牢/春药/极端 NSFW 写成【开场当下】，否则不要把它们写进当前 state。
            4. 初次见面好感度通常 4–6；仅当开场前提就是敌对/俘获敌意时才可更低。
            5. 语气必须像这个角色（机智角色要有机锋），禁止通用调情模板。
            6. state 必须包含上面列出的【每一个】键；描述字段（环境、衣服/衣着、姿势/仪态等）必须是非空中文句子，禁止省略、禁止空字符串。
            7. 状态只写戏内事实；禁止把导演备注/禁令/占位句写进字段（如「以本轮为准」「禁止开场写满档」）。
            """
        ).strip()
        user_prompt = dedent(
            f"""
            角色名：{name}
            对外简介：{description}
            说话方式：{voice_style}
            稳定人设/动力学（身份核，不是锁死地点）：
            {persona_text}

            {scenario_block}
            模式：{"SAFE（非露骨）" if safe_mode else "NSFW 可用（人设需要时可以暧昧/情欲，但仍须场景自洽）"}

            现在输出 JSON。
            """
        ).strip()

    return PromptBundle(system_instruction=system_instruction, user_prompt=user_prompt)


def scene_pair_looks_coherent(opening_line: str, state: dict, *, safe_mode: bool = False) -> bool:
    """
    Cheap heuristic: catch obvious opener/state world clashes and incomplete scene fields.
    Returns False when a retry is warranted.
    """
    opening = (opening_line or "").strip()
    if not opening or not isinstance(state, dict):
        return False

    required = ("环境", "衣着", "仪态") if safe_mode else ("环境", "衣服", "姿势")
    for key in required:
        value = state.get(key)
        if not isinstance(value, str) or not value.strip() or value.strip() == "未设定":
            return False

    env = str(state.get("环境") or "")
    clothes = str(state.get("衣服") or state.get("衣着") or "")
    posture = str(state.get("姿势") or state.get("仪态") or "")
    blob = f"{env} {clothes} {posture}"

    dungeon = ("地牢", "囚", "牢房", "反绑", "镣铐", "春药", "dungeon", "prison", "bound")
    leisure = ("桃花岛", "寻宝", "庭院", "叫花鸡", "阳光", "闲逛", "treasure", "courtyard")

    opening_leisure = any(m in opening for m in leisure)
    opening_dungeon = any(m in opening for m in dungeon)
    state_dungeon = any(m in blob for m in dungeon)
    state_leisure = any(m in blob for m in leisure)

    if opening_leisure and state_dungeon:
        return False
    if opening_dungeon and state_leisure:
        return False
    return True


QUANTIFIABLE_KEYS = {"情绪", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度"}

# Known soft-fallback templates — must never pass atomic migration validation.
GENERIC_FALLBACK_ENV_MARKERS = (
    "私密空间光线暖柔",
    "温暖明亮的室内空间",
    "Warm, well-lit indoor",
    "Private space with warm soft light",
)

_PLACE_MARKERS = (
    "厨房",
    "客厅",
    "夜店",
    "吧台",
    "营帐",
    "洞府",
    "办公室",
    "画室",
    "卧室",
    "书房",
    "车站",
    "桃花",
    "庭院",
    "地牢",
    "牢房",
    "酒吧",
    "浴室",
    "阳台",
)


def place_markers(text: str) -> set:
    body = text or ""
    return {m for m in _PLACE_MARKERS if m in body}


def _normalize_quantified_value(value):
    if not isinstance(value, dict):
        return None
    raw_value = value.get("value")
    try:
        numeric_value = int(float(raw_value))
    except (TypeError, ValueError):
        return None
    if numeric_value < 0 or numeric_value > 10:
        return None
    description = value.get("description")
    if not isinstance(description, str):
        return None
    description = description.strip()
    if not description or description == "未设定":
        return None
    return {"value": numeric_value, "description": description}


def parse_state_fields(raw_state, allowed_keys):
    """Normalize a state dict to allowed keys / shapes."""
    if not isinstance(raw_state, dict):
        return {}
    result = {}
    for key in allowed_keys:
        value = raw_state.get(key)
        key_str = str(key)
        if key_str in QUANTIFIABLE_KEYS:
            normalized = _normalize_quantified_value(value)
            if normalized:
                result[key_str] = normalized
            continue
        if isinstance(value, str) and value.strip():
            result[key_str] = value.strip()
    return result


def parse_scene_bootstrap_response(text, allowed_keys):
    """Parse model JSON into {opening_line, state, scene_summary}."""
    import json
    import re

    if not text:
        return {}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or start >= end:
        return {}

    try:
        parsed = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    opening = parsed.get("opening_line") or parsed.get("openingLine") or ""
    if not isinstance(opening, str):
        opening = ""

    scene_summary = parsed.get("scene_summary") or parsed.get("sceneSummary") or ""
    if not isinstance(scene_summary, str):
        scene_summary = ""

    raw_state = parsed.get("state")
    if not isinstance(raw_state, dict):
        raw_state = {k: parsed[k] for k in allowed_keys if k in parsed}

    state = parse_state_fields(raw_state, allowed_keys)
    if not opening.strip() and not state:
        return {}

    return {
        "opening_line": opening.strip(),
        "state": state,
        "scene_summary": scene_summary.strip(),
    }


__all__ = [
    "GENERIC_FALLBACK_ENV_MARKERS",
    "QUANTIFIABLE_KEYS",
    "build_scene_bootstrap_prompt",
    "parse_scene_bootstrap_response",
    "parse_state_fields",
    "place_markers",
    "scene_pair_looks_coherent",
]
