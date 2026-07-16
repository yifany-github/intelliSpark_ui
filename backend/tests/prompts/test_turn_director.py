"""Tests for unified Turn Director (#276 review fixes)."""

from types import SimpleNamespace

from prompts.turn_director import (
    TurnDirector,
    build_turn_director_prompt,
    conservative_fallback_director,
    parse_turn_director_payload,
)
from prompts.turn_contract import build_turn_contract, contract_violated
from prompts.interaction_frame import frame_forbids_user_as_releaser


def test_parse_director_json_respects_unknown_release():
    raw = (
        '{"stage":"其他","act_type":"none","character_role":"unknown",'
        '"user_role":"unknown","release_actor":"unknown","release_target":"unknown",'
        '"user_intent":"mundane","boundary":"unknown",'
        '"next_beat":"先接住拿手机","confidence":0.8,"evidence":"explicit_current"}'
    )
    d = parse_turn_director_payload(raw)
    assert d is not None
    assert d.act_type == "none"
    assert d.release_actor == "unknown"
    assert d.user_intent == "mundane"


def test_parse_refuse_boundary():
    raw = (
        '{"stage":"抽插时","act_type":"penetration","character_role":"actor",'
        '"user_role":"receiver","release_actor":"unknown","release_target":"unknown",'
        '"user_intent":"refuse","boundary":"refused",'
        '"next_beat":"尊重不要内射","confidence":0.9,"evidence":"explicit_current"}'
    )
    d = parse_turn_director_payload(raw)
    assert d.boundary == "refused"
    assert d.release_actor == "unknown"


def test_conservative_fallback_does_not_guess_roles():
    d = conservative_fallback_director()
    assert d.source == "fallback"
    assert d.character_role == "unknown"
    assert d.release_actor == "unknown"
    assert d.act_type == "none"


def test_prompt_includes_prev_and_state():
    prev = TurnDirector(
        stage="抽插时",
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
        release_actor="unknown",
        release_target="unknown",
        confidence=0.7,
        evidence="recent_context",
    )
    prompt = build_turn_director_prompt(
        "用户: 射在里面可以吗？",
        prev_director=prev,
        state={"环境": "影音室", "欲望值": {"value": 8}},
    )
    assert "上一张导演帧" in prompt
    assert "character_role=actor" in prompt or "char=actor" in prompt
    assert "影音室" in prompt
    assert "不要射在里面" in prompt or "boundary=refused" in prompt


def test_contract_uses_director_next_beat_and_soft_cap():
    msgs = [
        SimpleNamespace(role="user", content="想你了"),
        SimpleNamespace(role="assistant", content="*抬眼* 嗯？"),
        SimpleNamespace(role="user", content="想你了"),
    ]
    director = TurnDirector(
        stage="其他",
        act_type="none",
        character_role="unknown",
        user_role="unknown",
        user_intent="soft",
        boundary="unknown",
        next_beat="半拍靠近，禁止跳到插入",
        confidence=0.7,
        evidence="explicit_current",
    )
    c = build_turn_contract(
        msgs,
        persona_text="金硕宇",
        character_gender="male",
        turn_director=director,
    )
    assert c.intensity == "light"
    assert any("半拍靠近" in m for m in c.must)
    assert c.turn_director is director


def test_jinshuo_director_injected_forbids_wrong_releaser():
    msgs = [
        SimpleNamespace(role="user", content="进来"),
        SimpleNamespace(
            role="assistant",
            content="*我整根没入抽送* 我快要……",
        ),
        SimpleNamespace(role="user", content="射在里面可以吗？"),
    ]
    director = TurnDirector(
        stage="抽插时",
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
        release_actor="character",
        release_target="user",
        user_intent="permission",
        boundary="allowed",
        next_beat="角色回应自己的释放",
        confidence=0.95,
        evidence="explicit_current",
    )
    c = build_turn_contract(msgs, turn_director=director, character_gender="male")
    bad = "你想射就射吧"
    assert frame_forbids_user_as_releaser(bad, c.interaction_frame)
    assert contract_violated(bad, c, {"欲望值": {"value": 8}})
