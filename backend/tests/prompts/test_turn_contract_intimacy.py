"""Unit tests for intimacy / Desire vs Role turn contracts."""

from types import SimpleNamespace

from prompts.beat_progression import (
    persona_has_role_conflict,
    reply_too_thin,
    user_pushes_intimacy,
)
from prompts.turn_contract import (
    build_turn_contract,
    contract_violated,
    detect_location_from_recent,
    detect_stimulus_intensity,
    user_invites_lead,
    user_asks_preference,
    _has_visible_affinity_delta,
    _user_is_command,
)


def _msgs(*pairs):
    return [SimpleNamespace(role=r, content=c) for r, c in pairs]


def test_user_pushes_intimacy_detects_kiss_intent():
    assert user_pushes_intimacy("我想亲你")
    assert user_pushes_intimacy("亲一下")
    assert not user_pushes_intimacy("今天累不累")


def test_persona_conflict_from_markers_and_section():
    assert persona_has_role_conflict("你是姨妈，对他有禁忌吸引")
    assert persona_has_role_conflict("【冲突 Desire vs Role】身份 vs 欲望")
    assert not persona_has_role_conflict("你是邻家女孩，开朗活泼")


def test_conflict_contract_for_soft_intimacy():
    persona = "郑恩爱，子豪的姨妈。【冲突 Desire vs Role】想被亲但身份是姨妈"
    msgs = _msgs(
        ("assistant", "回来啦？围裙还系着呢。"),
        ("user", "累了。"),
        ("assistant", "那先坐会儿。"),
        ("user", "我想亲你"),
    )
    c = build_turn_contract(msgs, {"环境": "客厅沙发"}, persona_text=persona)
    assert c.mode == "conflict"
    prompt = c.to_prompt("zh")
    assert "Desire vs Role" in prompt or "眼神" in prompt
    assert "160–320" in prompt
    assert "演讲" in prompt or "复读" in prompt


def test_undress_command_is_execute_not_conflict_lecture():
    persona = "姨妈禁忌 Desire vs Role"
    msgs = _msgs(
        ("assistant", "浴室到了。"),
        ("user", "快脱啊，帮我也脱了吧"),
    )
    c = build_turn_contract(
        msgs,
        {"环境": "明亮的厨房，饭菜余温"},
        persona_text=persona,
    )
    assert c.mode == "execute"
    prompt = c.to_prompt("zh")
    assert "执行" in prompt
    assert "饭菜" in prompt or "浴室" in prompt  # stale env warning


def test_location_hint_bathroom_from_dialogue():
    msgs = _msgs(
        ("user", "走去浴室"),
        ("assistant", "好…跟你走"),
        ("user", "到了，快脱"),
    )
    assert detect_location_from_recent(msgs) == "浴室"


def test_intimacy_without_conflict_stays_generic():
    persona = "开朗的邻家女孩，喜欢撒娇"
    msgs = _msgs(
        ("assistant", "你来啦。"),
        ("user", "嗨"),
        ("assistant", "今天怎么样？"),
        ("user", "我想亲你"),
    )
    c = build_turn_contract(msgs, persona_text=persona)
    assert c.mode == "intimacy"


def test_light_stimulus_caps_meltdown_keeps_nsfw_density():
    """「怎么湿湿的」= light: no tear meltdown; body still explicit."""
    persona = "嘉允，继母。【冲突 Desire vs Role】"
    msgs = _msgs(
        ("assistant", "先躺好，我帮你揉腰。"),
        ("user", "嗯，继续"),
        ("assistant", "*腰软着磨你，乳头已经硬了* 嗯……别……"),
        ("user", "怎么湿湿的"),
    )
    assert detect_stimulus_intensity("怎么湿湿的", msgs) == "light"
    c = build_turn_contract(msgs, persona_text=persona)
    assert c.intensity == "light"
    assert c.mode in {"conflict", "intimacy", "execute", "react", "mutual"}
    prompt = c.to_prompt("zh")
    assert "轻" in prompt or "力度" in prompt
    assert "泪崩" in prompt or "禁止泪" in prompt
    # NSFW craft still present on intimacy/conflict/execute
    assert "露骨" in prompt or "湿润" in prompt or "帧级" in prompt or "冲击" in prompt

    meltdown = (
        "*眼泪一下子涌出来* 我不是好女人……作为你的继母不该这样湿……"
        "可是穴口还在流水，乳头硬着。"
    )
    assert contract_violated(meltdown, c, {"欲望值": {"value": 7}})

    ok = (
        "*耳尖烫了一下，腿却没并拢，穴口已经湿得发亮* 被你……摸成这样了。"
        "*手指沾了点自己阴唇边的爱液，呼吸乱了半拍，却仍停在你眼前*"
        "别看……可是已经湿了。乳头也硬着，我……心里发虚，腿却软在你腰两侧。"
        "沙发垫陷下去一块，客厅灯还亮着，我只敢小声喘，没真的躲开。"
    )
    assert not reply_too_thin(ok, min_chars=100)
    assert not contract_violated(ok, c, {"欲望值": {"value": 7}, "下体": {"value": "湿"}})


def test_heavy_mid_sex_keeps_full_density():
    msgs = _msgs(
        ("assistant", "*含着你的肉棒吞吐，唾液拉丝*"),
        ("user", "继续，深一点"),
    )
    assert detect_stimulus_intensity(
        "继续，深一点", msgs, sex_act=True
    ) == "heavy"
    c = build_turn_contract(msgs, persona_text="邻家女孩")
    assert c.intensity == "heavy"
    assert c.mode == "execute"
    prompt = c.to_prompt("zh")
    assert "生理性泪" in prompt or "重刺激" in prompt or "力度" in prompt


def test_contract_violated_stale_kitchen_in_bath_and_confirm():
    persona = "姨妈禁忌"
    msgs = _msgs(
        ("assistant", "嗯。"),
        ("user", "你好"),
        ("assistant", "回来啦"),
        ("user", "我想亲你"),
    )
    c = build_turn_contract(msgs, persona_text=persona)
    assert c.mode == "conflict"

    soft = "不行……太突然了。我们不能这样。"
    assert contract_violated(soft, c, {})

    bath_bad = (
        "浴室瓷砖反射着灯光，我解开裙子帮你拉上衣，"
        "空气里还残留着厨房饭菜的余温混着水汽。这样……你满意了吧。"
    )
    assert contract_violated(bath_bad, c, {}, location_hint="浴室")

    tensed = (
        "*心跳乱了一拍，身体却没真的躲开，手还停在你衣袖上*"
        "子豪……姨妈不该……可是你靠这么近，我腿都软了。"
        "*气息喷在你颈侧，想退又没退*"
        "再这样……会被人看见的……可我还是没把你推开。"
        "沙发扶手硌着腰，客厅灯还亮着，碗碟味还留在围裙上，"
        "我听见自己呼吸乱得厉害，却仍微微仰头停在你唇边半寸的地方。"
    )
    assert not reply_too_thin(tensed, min_chars=100)
    assert contract_violated(tensed, c, {})  # no state delta
    assert not contract_violated(
        tensed, c, {"欲望值": {"value": 6, "description": "想被亲却怕"}}
    )


def test_lai_substring_no_longer_false_execute():
    assert not _user_is_command("接下来会发生什么？")
    assert not _user_is_command("原来如此")
    assert not _user_is_command("你什么时候来？")
    assert _user_is_command("过来")
    assert _user_is_command("继续")
    assert _user_is_command("来吧")
    assert _user_is_command("来")
    assert user_invites_lead("接下来会发生什么？")


def test_whats_next_is_lead_not_execute():
    msgs = _msgs(
        ("assistant", "*大腿叠在你腿上* 想试试？"),
        ("user", "我想试试"),
        ("assistant", "那姐姐就不客气了。"),
        ("user", "接下来会发生什么？"),
    )
    c = build_turn_contract(msgs, persona_text="娜琏夜店女王")
    assert c.mode == "lead"
    prompt = c.to_prompt("zh")
    assert "半拍" in prompt or "期待" in prompt
    assert "推进到可观察的完成态" not in prompt

    dump = (
        "*我直接跨坐进你双腿之间，拉开拉链握住肉棒*"
        "感觉到了吗宝贝，射在姐姐手里吧。"
    )
    assert contract_violated(dump, c, {"欲望值": {"value": 8}}, messages=msgs)

    half = (
        "*腿仍压在你膝上，拇指慢慢蹭过你的手背，却没立刻靠得更近*"
        "接下来？先看你敢不敢抬头看我。"
        "*鱼网丝袜在你裤管上摩挲半寸，酒杯在重拍外轻轻碰了一下台面*"
        "我可以再过分一点——但你得自己把这半寸缺口补上。"
    )
    assert not reply_too_thin(half, min_chars=80)
    assert not contract_violated(
        half, c, {"欲望值": {"value": 7, "description": "想再近一点"}}, messages=msgs
    )


def test_affinity_delta_requires_real_change_when_prior_known():
    prior = {"欲望值": {"value": 10, "description": "满"}}
    same = {"欲望值": {"value": 10, "description": "满"}}
    assert not _has_visible_affinity_delta(same, prior)
    refreshed = {"欲望值": {"value": 10, "description": "仍满，但想被摸"}}
    assert _has_visible_affinity_delta(refreshed, prior)
    bumped = {"欲望值": {"value": 8, "description": "回落一点仍烫"}}
    assert _has_visible_affinity_delta(bumped, prior)
    # No prior → presence still ok
    assert _has_visible_affinity_delta({"欲望值": {"value": 10}}, None)


def test_invents_user_cry_violates():
    msgs = _msgs(
        ("assistant", "磨你"),
        ("user", "我不行了，涨的好难受"),
    )
    c = build_turn_contract(msgs, persona_text="娜琏")
    bad = "怎么跟个要哭出来的孩子一样，委屈巴巴满脸通红……"
    assert contract_violated(bad, c, {"欲望值": {"value": 8}}, messages=msgs)
    ok = (
        "*听到你说难受，我搭在肩上的手顿了一下，没再故意磨*"
        "好了，不逗你了。"
        "*手指顺着你腰侧往下，隔着布料认真地揉那团热*"
        "这样……有没有好一点。"
    )
    assert not contract_violated(
        ok, c, {"欲望值": {"value": 8}, "兴奋度": {"value": 8}}, messages=msgs
    )


def test_where_to_cum_is_preference_lead_not_execute():
    assert user_asks_preference("我快忍不住了，然后问你，想我射在哪里啊")
    msgs = _msgs(
        ("assistant", "*含着肉棒吞吐，蜜穴湿透*"),
        ("user", "继续"),
        ("assistant", "*吞吐更深*"),
        ("user", "我快忍不住了，然后问你，想我射在哪里啊"),
    )
    c = build_turn_contract(
        msgs, persona_text="嘉允，继母。【冲突 Desire vs Role】"
    )
    assert c.mode == "lead"
    prompt = c.to_prompt("zh")
    assert "选择" in prompt or "偏好" in prompt
    assert "人物选择" in prompt
    assert c.active_dynamic in {
        "drive",
        "defense",
        "boundary",
        "initiative",
        "mask",
        "pressure_shift",
    }


def test_conflict_execute_keeps_persona_goal_not_generic_shiver():
    msgs = _msgs(
        ("assistant", "*肉棒在小穴里抽插*"),
        ("user", "继续，深一点"),
    )
    c = build_turn_contract(
        msgs, persona_text="嘉允，继母。【冲突 Desire vs Role】"
    )
    assert c.mode == "execute"
    prompt = c.to_prompt("zh")
    assert "人物选择" in prompt
    assert "不敢直视" not in prompt
    assert "发颤称呼" not in prompt


def test_same_prompt_different_dynamics_strategy():
    """Same user lead invite → different active dynamics text across personas."""
    from prompts.persona_dynamics import format_dynamics_block

    jiayun = format_dynamics_block(
        {
            "mask": "用继母关心挡禁忌",
            "drive": "想被靠近却保体面",
            "defense": "长辈口吻推开半寸",
            "initiative": "犹豫半拍再靠近",
            "pressure_shift": "嘴硬身体先软",
            "boundary": "不菜单献上",
        }
    )
    nalian = format_dynamics_block(
        {
            "mask": "玩笑盖住认真",
            "drive": "要掌控节奏",
            "defense": "更用力挑衅",
            "initiative": "先撩留门槛",
            "pressure_shift": "玩笑变少动作更直",
            "boundary": "不做换皮机",
        }
    )
    msgs = _msgs(
        ("assistant", "腿还压着你"),
        ("user", "hi"),
        ("assistant", "看你"),
        ("user", "接下来会发生什么？"),
    )
    c1 = build_turn_contract(msgs, persona_text="嘉允\n" + jiayun)
    c2 = build_turn_contract(msgs, persona_text="娜琏\n" + nalian)
    assert c1.mode == "lead" and c2.mode == "lead"
    assert c1.active_dynamic == "initiative"
    assert c2.active_dynamic == "initiative"
    # Same key, different strategy text
    assert "犹豫" in c1.to_prompt("zh") or "体面" in c1.to_prompt("zh") or "继母" in c1.to_prompt("zh")
    assert "先撩" in c2.to_prompt("zh") or "门槛" in c2.to_prompt("zh") or "掌控" in c2.to_prompt("zh")
    assert c1.to_prompt("zh") != c2.to_prompt("zh")


def test_recent_dynamic_rotates_off_same_key():
    from prompts.persona_dynamics import LAST_DYNAMIC_KEY, format_dynamics_block

    block = format_dynamics_block(
        {
            "mask": "面具A",
            "drive": "欲望B",
            "defense": "回避C",
            "initiative": "主动D",
            "pressure_shift": "失控E",
            "boundary": "边界F",
        }
    )
    msgs = _msgs(
        ("assistant", "x"),
        ("user", "y"),
        ("assistant", "z"),
        ("user", "接下来会发生什么？"),
    )
    c1 = build_turn_contract(msgs, persona_text=block)
    assert c1.active_dynamic == "initiative"
    c2 = build_turn_contract(
        msgs,
        {LAST_DYNAMIC_KEY: "initiative"},
        persona_text=block,
    )
    assert c2.active_dynamic == "mask"


def test_malformed_state_block_stripped():
    from utils.state_block import extract_state_update

    raw = (
        "含糊地说……\n\n"
        '[[STATE_UPDATE]{"欲望值": {"value": 10, "description": "满"}, '
        '"姿势": "跪着"}[[/STATE_UPDATE]]'
    )
    cleaned, state = extract_state_update(raw)
    assert "STATE_UPDATE" not in cleaned
    assert "含糊" in cleaned
    assert state.get("欲望值", {}).get("value") == 10
    assert state.get("姿势") == "跪着"
