"""Tests for TurnPlan director (#276 converge)."""

from types import SimpleNamespace

from prompts.scene_frame import SceneFrame
from prompts.turn_plan import (
    TurnPlan,
    apply_switch_gate,
    build_turn_plan_prompt,
    conservative_fallback_plan,
    parse_turn_plan_payload,
)
from prompts.turn_contract import build_turn_contract, contract_violated
from prompts.interaction_frame import frame_forbids_user_as_releaser


def test_parse_plan_respects_unknown_release():
    raw = (
        '{"intent":"mundane","boundary":"unknown","next_beat":"先接住拿手机",'
        '"transition":"other","evidence_quote":"",'
        '"expected_scene":{"act_type":"none","character_role":"unknown",'
        '"user_role":"unknown","phase":"其他","release_actor":"unknown",'
        '"release_target":"unknown"}}'
    )
    d = parse_turn_plan_payload(raw)
    assert d is not None
    assert d.expected_scene.act_type == "none"
    assert d.intent == "mundane"


def test_parse_refuse_boundary():
    raw = (
        '{"intent":"refuse","boundary":"refused","next_beat":"尊重不要内射",'
        '"transition":"refuse","evidence_quote":"",'
        '"expected_scene":{"act_type":"penetration","character_role":"actor",'
        '"user_role":"receiver","phase":"抽插时","release_actor":"unknown",'
        '"release_target":"unknown"}}'
    )
    d = parse_turn_plan_payload(raw)
    assert d.boundary == "refused"
    assert d.expected_scene.release_actor == "unknown"


def test_conservative_fallback_does_not_guess_roles():
    d = conservative_fallback_plan()
    assert d.source == "fallback"
    assert d.expected_scene.character_role == "unknown"
    assert d.expected_scene.act_type == "none"


def test_prompt_includes_scene_and_switch_rules():
    prev = SceneFrame(
        phase="抽插时",
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
    )
    prompt = build_turn_plan_prompt(
        "用户: 射在里面可以吗？",
        prev_scene=prev,
        state={"环境": "影音室", "欲望值": {"value": 8}},
    )
    assert "上一场 SceneFrame" in prompt
    assert "char=actor" in prompt
    assert "evidence_quote" in prompt
    assert "transition" in prompt
    assert "影音室" in prompt


def test_contract_uses_plan_next_beat_and_soft_cap():
    msgs = [
        SimpleNamespace(role="user", content="想你了"),
        SimpleNamespace(role="assistant", content="*抬眼* 嗯？"),
        SimpleNamespace(role="user", content="想你了"),
    ]
    director = TurnPlan(
        intent="soft",
        boundary="unknown",
        next_beat="半拍靠近，禁止跳到插入",
        transition="other",
        expected_scene=SceneFrame(),
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


def test_jinshuo_plan_injected_forbids_wrong_releaser():
    msgs = [
        SimpleNamespace(role="user", content="进来"),
        SimpleNamespace(role="assistant", content="*我整根没入抽送* 我快要……"),
        SimpleNamespace(role="user", content="射在里面可以吗？"),
    ]
    director = TurnPlan(
        intent="permission",
        boundary="allowed",
        transition="release",
        next_beat="角色回应自己的释放",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="actor",
            user_role="receiver",
            phase="抽插时",
            release_actor="character",
            release_target="user",
        ),
    )
    c = build_turn_contract(msgs, turn_director=director, character_gender="male")
    bad = "你想射就射吧"
    assert frame_forbids_user_as_releaser(bad, c.interaction_frame)
    assert contract_violated(bad, c, {"欲望值": {"value": 8}})


def test_apply_switch_gate_fills_unknown_from_prev():
    prev = SceneFrame(character_role="actor", user_role="receiver", act_type="none")
    plan = TurnPlan(
        intent="enter",
        transition="other",
        expected_scene=SceneFrame(character_role="unknown", user_role="unknown"),
    )
    gated = apply_switch_gate(plan, prev_scene=prev, user_text="进来")
    assert gated.expected_scene.character_role == "actor"
