"""Acceptance tests for role-aware Interaction Frame (#276)."""

from types import SimpleNamespace

from prompts.interaction_frame import (
    build_interaction_frame,
    frame_forbids_user_as_releaser,
)
from prompts.sexual_stage_reminders import get_stage_reminder
from prompts.turn_contract import build_turn_contract, contract_violated


def _msgs(*pairs):
    out = []
    for role, content in pairs:
        out.append(SimpleNamespace(role=role, content=content))
    return out


def test_jinshuo_creampie_ask_character_releases_into_user():
    """金硕宇已是插入方且近高潮；「射在里面可以吗」= 角色射入用户。"""
    msgs = _msgs(
        ("user", "进来"),
        (
            "assistant",
            "*我腰微微上顶，整根没入你体内，扣着你腰缓慢抽送* 夹这么紧……*我的肉棒顶到最深处* 我快要……",
        ),
        ("user", "射在里面可以吗？"),
    )
    frame = build_interaction_frame(msgs, character_gender="male")
    assert frame.character_role == "actor"
    assert frame.user_role == "receiver"
    assert frame.release_actor == "character"
    assert frame.release_target == "user"
    assert frame.evidence == "explicit_current"
    assert frame.confidence >= 0.7

    # Gender must not flip roles
    frame_f = build_interaction_frame(msgs, character_gender="female")
    assert frame_f.release_actor == frame.release_actor
    assert frame_f.character_role == frame.character_role

    c = build_turn_contract(
        msgs,
        persona_text="金硕宇 影音室",
        character_gender="male",
    )
    assert c.interaction_frame is not None
    assert any("射入用户" in m for m in c.must)
    prompt = c.to_prompt("zh")
    assert "禁止写成「你（用户）想射就射吧」" in prompt or "禁止改成用户在射" in prompt

    bad = "*喘息* 你想射就射吧……射在里面也没关系。"
    assert frame_forbids_user_as_releaser(bad, frame)
    assert contract_violated(bad, c, {"欲望值": {"value": 8}})

    ok = "*扣紧你的腰，抽送没停* 可以……我就射在里面。*额头抵着你喘* 夹紧——别让我拔出去。"
    assert not frame_forbids_user_as_releaser(ok, frame)


def test_male_user_female_char_creampie_user_releases_into_character():
    """男用户×女角：上下文角色被插入时，内射问句指向用户射入角色。"""
    msgs = _msgs(
        ("user", "*慢慢插入*"),
        (
            "assistant",
            "*穴口被你撑开，含着你的肉棒一寸寸吞进去* 啊……太大了……里面好满……",
        ),
        ("user", "射在里面可以吗？"),
    )
    frame = build_interaction_frame(msgs, character_gender="female")
    assert frame.character_role == "receiver"
    assert frame.user_role == "actor"
    assert frame.release_actor == "user"
    assert frame.release_target == "character"

    c = build_turn_contract(msgs, persona_text="嘉允", character_gender="female")
    assert any("用户可能射入角色" in m or "射入角色" in m for m in c.must)


def test_same_sex_or_role_swap_explicit_current_wins():
    """同性/角色互换：当前明确「我插你」覆盖先前角色插入上下文。"""
    msgs = _msgs(
        ("user", "进来"),
        (
            "assistant",
            "*我的肉棒整根没入，抽送着顶进你的最深处*",
        ),
        ("user", "换过来，我插你"),
    )
    frame = build_interaction_frame(msgs, character_gender="male")
    assert frame.evidence == "explicit_current"
    assert frame.character_role == "receiver"
    assert frame.user_role == "actor"


def test_insufficient_context_stays_unknown():
    msgs = _msgs(
        ("user", "你好"),
        ("assistant", "*抬眼看你* 嗯，怎么了？"),
        ("user", "今天天气不错"),
    )
    frame = build_interaction_frame(msgs)
    assert frame.character_role == "unknown"
    assert frame.user_role == "unknown"
    assert frame.release_actor == "unknown"
    assert frame.release_target == "unknown"
    assert frame.evidence == "unknown"


def test_stage_reminder_role_overlay_for_actor():
    from prompts.interaction_frame import InteractionFrame

    frame = InteractionFrame(
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
        release_actor="character",
        release_target="user",
        confidence=0.9,
        evidence="explicit_current",
    )
    text = get_stage_reminder("抽插时", language="zh", interaction_frame=frame)
    assert "角色→用户" in text or "禁止写成" in text
    assert "角色被插入" not in text
