"""SceneFrame + TurnPlan structural pipeline (#276 converge)."""

from prompts.scene_frame import SceneFrame
from prompts.scene_pipeline import (
    extract_scene_result,
    is_high_risk_turn,
    scene_result_structurally_valid,
    resolve_scene_to_persist,
)
from prompts.turn_plan import (
    TurnPlan,
    apply_switch_gate,
    clip_head_tail,
    parse_turn_plan_payload,
    switch_evidence_valid,
)


def test_clip_head_tail_keeps_tail():
    long = ("A" * 200) + ("中" * 200) + "硬挺抵在你腿间"
    clipped = clip_head_tail(long, max_len=420)
    assert "硬挺" in clipped
    assert len(clipped) <= 423


def test_switch_requires_quote_in_user_text():
    prev = SceneFrame(
        act_type="penetration",
        character_role="actor",
        user_role="receiver",
        phase="抽插时",
    )
    flipped = TurnPlan(
        intent="enter",
        transition="switch",
        evidence_quote="换我来，我插你",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="receiver",
            user_role="actor",
            phase="抽插时",
        ),
    )
    assert switch_evidence_valid(flipped, "好，换我来，我插你")
    gated = apply_switch_gate(flipped, prev_scene=prev, user_text="好，换我来，我插你")
    assert gated.expected_scene.character_role == "receiver"

    bad = TurnPlan(
        intent="enter",
        transition="switch",
        evidence_quote="换我来",
        expected_scene=flipped.expected_scene,
    )
    gated_bad = apply_switch_gate(bad, prev_scene=prev, user_text="进来")
    assert gated_bad.transition == "continue"
    assert gated_bad.expected_scene.character_role == "actor"


def test_bare_role_switch_without_quote_does_not_flip():
    prev = SceneFrame(character_role="actor", user_role="receiver", act_type="penetration")
    raw = (
        '{"intent":"enter","boundary":"unknown","next_beat":"x","transition":"continue",'
        '"evidence_quote":"","role_switch":true,'
        '"expected_scene":{"act_type":"penetration","character_role":"receiver",'
        '"user_role":"actor","phase":"插入时","release_actor":"unknown","release_target":"unknown"}}'
    )
    plan = parse_turn_plan_payload(raw)
    assert plan is not None
    gated = apply_switch_gate(plan, prev_scene=prev, user_text="进来")
    assert gated.expected_scene.character_role == "actor"


def test_extract_scene_result_strips_block():
    raw = (
        "*我顶进去* 好紧……\n"
        '[[SCENE_RESULT]]{"character_role":"actor","user_role":"receiver",'
        '"act_type":"penetration","phase":"插入时",'
        '"release_actor":"unknown","release_target":"unknown"}[[/SCENE_RESULT]]'
    )
    prose, frame = extract_scene_result(raw)
    assert "SCENE_RESULT" not in prose
    assert "顶进去" in prose
    assert frame is not None
    assert frame.character_role == "actor"


def test_structural_reject_flip_without_switch():
    prev = SceneFrame(character_role="actor", user_role="receiver", act_type="penetration")
    plan = TurnPlan(
        transition="continue",
        expected_scene=SceneFrame(
            character_role="actor", user_role="receiver", act_type="penetration"
        ),
    )
    bad_result = SceneFrame(
        character_role="receiver", user_role="actor", act_type="penetration"
    )
    ok, reason = scene_result_structurally_valid(
        bad_result, plan, prev_scene=prev, user_text="进来"
    )
    assert not ok
    assert "flip" in reason or "invent" in reason or "mismatch" in reason


def test_cannot_invent_receiver_when_plan_unknown():
    plan = TurnPlan(transition="other", expected_scene=SceneFrame())
    invented = SceneFrame(
        character_role="receiver", user_role="actor", act_type="penetration"
    )
    ok, reason = scene_result_structurally_valid(
        invented, plan, prev_scene=None, user_text="帮我脱"
    )
    assert not ok
    assert "invent" in reason
    saved = resolve_scene_to_persist(invented, plan, prev_scene=None, user_text="帮我脱")
    assert saved.character_role == "unknown"


def test_resolve_scene_does_not_persist_illegal_flip():
    prev = SceneFrame(character_role="actor", user_role="receiver", act_type="none")
    plan = TurnPlan(
        transition="continue",
        expected_scene=SceneFrame(
            character_role="actor", user_role="receiver", act_type="penetration"
        ),
    )
    bad = SceneFrame(character_role="receiver", user_role="actor", act_type="penetration")
    saved = resolve_scene_to_persist(bad, plan, prev_scene=prev, user_text="进来")
    assert saved.character_role == "actor"


def test_high_risk_includes_release_and_switch():
    prev = SceneFrame(character_role="actor", user_role="receiver", act_type="penetration")
    release_plan = TurnPlan(
        intent="permission",
        transition="release",
        expected_scene=SceneFrame(
            character_role="actor",
            user_role="receiver",
            act_type="penetration",
            release_actor="character",
            release_target="user",
        ),
    )
    assert is_high_risk_turn(release_plan, prev_scene=prev)
    soft = TurnPlan(intent="soft", transition="other", expected_scene=SceneFrame())
    assert not is_high_risk_turn(soft, prev_scene=None)


def test_establish_receiver_without_quote_keeps_unknown_not_opposite():
    plan = TurnPlan(
        intent="enter",
        transition="establish",
        evidence_quote="",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="receiver",
            user_role="actor",
            phase="准备插入",
        ),
    )
    gated = apply_switch_gate(plan, prev_scene=None, user_text="进来")
    assert gated.expected_scene.character_role == "unknown"
    assert gated.expected_scene.user_role == "unknown"
    assert gated.source == "corrected"

    # Director cannot launder 「进来」 / punctuated forms as receiver-establish evidence
    for quote, user in (
        ("进来", "进来"),
        ("进来！", "进来！"),
        ("“进来”", "他说“进来”"),
    ):
        laundered = TurnPlan(
            intent="enter",
            transition="establish",
            evidence_quote=quote,
            expected_scene=SceneFrame(
                act_type="penetration",
                character_role="receiver",
                user_role="actor",
            ),
        )
        gated_launder = apply_switch_gate(laundered, prev_scene=None, user_text=user)
        assert gated_launder.expected_scene.character_role == "unknown", quote

    allowed = TurnPlan(
        intent="enter",
        transition="establish",
        evidence_quote="我插你",
        expected_scene=SceneFrame(
            act_type="penetration",
            character_role="receiver",
            user_role="actor",
        ),
    )
    gated_ok = apply_switch_gate(allowed, prev_scene=None, user_text="让我，我插你")
    assert gated_ok.expected_scene.character_role == "receiver"


def test_roles_coherent_rejects_same_side_pairs():
    from prompts.scene_frame import scene_frame_from_mapping

    bad = scene_frame_from_mapping(
        {"character_role": "actor", "user_role": "actor", "act_type": "penetration"}
    )
    assert bad is not None
    assert bad.character_role == "unknown"
    assert not SceneFrame(character_role="receiver", user_role="receiver").roles_coherent()
    assert SceneFrame(character_role="actor", user_role="receiver").roles_known()


def test_parse_recheck_three_state():
    from prompts.turn_plan import (
        RECHECK_ACTOR_FAIL,
        RECHECK_PASS,
        RECHECK_VERIFIER_ERROR,
        parse_recheck_payload,
    )

    assert parse_recheck_payload('{"status":"pass"}') == RECHECK_PASS
    assert parse_recheck_payload('{"status":"actor_fail","reason":"x"}') == RECHECK_ACTOR_FAIL
    assert parse_recheck_payload('{"status":"verifier_error"}') == RECHECK_VERIFIER_ERROR
    assert parse_recheck_payload('{"ok":true}') == RECHECK_PASS
    assert parse_recheck_payload('{"ok":false}') == RECHECK_ACTOR_FAIL
    assert parse_recheck_payload("not json") == RECHECK_VERIFIER_ERROR
