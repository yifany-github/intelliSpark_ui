"""Acceptance tests for role-aware frames via TurnPlan (#276 converge)."""

from types import SimpleNamespace

from prompts.interaction_frame import (
    InteractionFrame,
    coalesce_interaction_frame,
    frame_forbids_user_as_releaser,
    parse_interaction_frame_payload,
)
from prompts.scene_frame import SceneFrame
from prompts.turn_contract import build_turn_contract, contract_violated
from prompts.turn_plan import TurnPlan, apply_switch_gate


def _msgs(*pairs):
    out = []
    for role, content in pairs:
        out.append(SimpleNamespace(role=role, content=content))
    return out


def test_jinshuo_creampie_plan_character_releases_into_user():
    """金硕宇已是插入方；「射在里面可以吗」= 角色射入用户 — via TurnPlan."""
    msgs = _msgs(
        ("user", "进来"),
        (
            "assistant",
            "*我腰微微上顶，整根没入你体内，扣着你腰缓慢抽送* 夹这么紧……*我的肉棒顶到最深处* 我快要……",
        ),
        ("user", "射在里面可以吗？"),
    )
    prev = SceneFrame(
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
        phase="抽插时",
    )
    plan = TurnPlan(
        intent="permission",
        boundary="allowed",
        transition="release",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="actor",
            user_role="receiver",
            phase="抽插时",
            release_actor="character",
            release_target="user",
        ),
    )
    gated = apply_switch_gate(plan, prev_scene=prev, user_text="射在里面可以吗？")
    assert gated.expected_scene.release_actor == "character"
    assert gated.expected_scene.release_target == "user"

    c = build_turn_contract(
        msgs,
        persona_text="金硕宇 影音室",
        character_gender="male",
        turn_director=gated,
    )
    assert any("射入用户" in m for m in c.must)
    bad = "*喘息* 你想射就射吧……射在里面也没关系。"
    assert frame_forbids_user_as_releaser(bad, c.interaction_frame)
    assert contract_violated(bad, c, {"欲望值": {"value": 8}})


def test_male_user_female_char_creampie_user_releases():
    msgs = _msgs(
        ("user", "*慢慢插入*"),
        (
            "assistant",
            "*穴口被你撑开，含着你的肉棒一寸寸吞进去* 啊……太大了……里面好满……",
        ),
        ("user", "射在里面可以吗？"),
    )
    plan = TurnPlan(
        intent="permission",
        transition="release",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="receiver",
            user_role="actor",
            release_actor="user",
            release_target="character",
        ),
    )
    c = build_turn_contract(msgs, persona_text="嘉允", character_gender="female", turn_director=plan)
    assert c.interaction_frame.release_actor == "user"
    assert c.interaction_frame.release_target == "character"


def test_parse_and_coalesce_still_work():
    raw = '{"act_type":"penetration","character_role":"actor","user_role":"receiver","release_actor":"unknown","release_target":"unknown","confidence":0.8,"evidence":"explicit_current"}'
    frame = parse_interaction_frame_payload(raw)
    assert frame is not None
    assert frame.character_role == "actor"
    merged = coalesce_interaction_frame(None, InteractionFrame(character_role="receiver"))
    assert merged.character_role == "receiver"


def test_build_interaction_frame_is_noop_without_lexicon():
    """Keyword co-director removed — empty frame unless TurnPlan injected."""
    from prompts.interaction_frame import build_interaction_frame

    msgs = _msgs(("user", "进来"), ("assistant", "*我的肉棒顶进你*"))
    frame = build_interaction_frame(msgs, character_gender="male")
    assert frame.character_role == "unknown"
    assert frame.act_type == "none"
