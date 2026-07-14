"""Tests for Issue #272 Scene Bundle versioning + migration helpers."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from backend.utils.character_content_version import (
    SCENE_BUNDLE_GENERATION_VERSION,
    character_needs_regeneration,
    clear_generation_metadata,
    compute_baseline_fingerprint,
    compute_source_hash,
)
from backend.utils.persona_scenario_split import (
    build_compact_persona_prompt,
    build_differentiated_dynamics,
    derive_scenario_hook,
    extract_and_strip_scene_locks,
    hook_has_internal_place_conflict,
    separate_persona_and_scenario,
)
from backend.services.scene_bundle_migrator import (
    SceneBundleCandidate,
    SceneBundleMigrator,
    validate_atomic_bundle,
)
from backend.prompts.persona_dynamics import parse_dynamics_from_persona


def test_source_hash_includes_backstory_fallback():
    base = dict(
        name="角色",
        persona_prompt="",
        backstory="完整背景故事",
        scenario_hook="客厅",
        voice_style="轻",
        nsfw_level=1,
        description="简介",
    )
    h1 = compute_source_hash(**base)
    changed = dict(base)
    changed["backstory"] = "改过的背景"
    assert compute_source_hash(**changed) != h1


def test_source_hash_stable_and_sensitive():
    base = dict(
        name="嘉允",
        persona_prompt="你是嘉允\n【动力学】\nmask: a",
        backstory="",
        scenario_hook="家里客厅暖灯",
        voice_style="轻柔",
        nsfw_level=1,
        description="继母",
    )
    h1 = compute_source_hash(**base)
    h2 = compute_source_hash(**base)
    assert h1 == h2
    assert len(h1) == 64

    changed = dict(base)
    changed["scenario_hook"] = "夜店吧台"
    assert compute_source_hash(**changed) != h1


def test_needs_regeneration_when_missing_version():
    character = SimpleNamespace(
        generation_version=None,
        source_hash=None,
        opening_line="hi",
        default_state_json="{}",
        scene_summary="s",
        scenario_hook="客厅",
        name="x",
        description="",
        backstory="",
        persona_prompt="p",
        voice_style="",
        nsfw_level=0,
    )
    assert character_needs_regeneration(character) is True


def test_needs_regeneration_false_when_current():
    persona = "你是嘉允\n【动力学】\nmask: 关心"
    hook = "家里客厅"
    character = SimpleNamespace(
        name="嘉允",
        description="继母",
        backstory="",
        persona_prompt=persona,
        scenario_hook=hook,
        voice_style="轻",
        nsfw_level=1,
        opening_line="回来了",
        default_state_json='{"环境":"客厅"}',
        scene_summary="客厅见面",
        generation_version=SCENE_BUNDLE_GENERATION_VERSION,
        source_hash=compute_source_hash(
            name="嘉允",
            description="继母",
            backstory="",
            persona_prompt=persona,
            scenario_hook=hook,
            voice_style="轻",
            nsfw_level=1,
        ),
    )
    assert character_needs_regeneration(character) is False


def test_clear_generation_metadata():
    character = SimpleNamespace(
        generation_version="scene_bundle_v2",
        source_hash="abc",
        scene_summary="s",
    )
    clear_generation_metadata(character)
    assert character.generation_version is None
    assert character.source_hash is None
    assert character.scene_summary is None


def test_derive_scenario_hook_rejects_conflicting_opening():
    character = SimpleNamespace(
        scenario_hook=None,
        opening_line="夜店吧台边嗨起来",
        default_state_json=json.dumps({"环境": "家里客厅，暖灯"}, ensure_ascii=False),
        persona_prompt="你是嘉允",
        backstory="",
        description="",
        name="嘉允",
    )
    hook = derive_scenario_hook(character)
    assert "客厅" in hook
    assert "夜店" not in hook
    assert not hook_has_internal_place_conflict(hook)


def test_huangrong_scene_locks_extracted_from_core():
    persona = (
        "你将扮演黄蓉。\n"
        "角色背景\n"
        "\t•\t身份：丐帮帮主。\n"
        "\t•\t处境：为探查蒙古军情深入边境，意外被俘，受化功散与春药控制，多次被凌辱。\n"
        "核心特质\n"
        "智慧与谋略：你是女诸葛。\n"
    )
    character = SimpleNamespace(
        persona_prompt=persona,
        backstory=persona,
        description="黄蓉",
        name="黄蓉",
        voice_style="酷女侠",
        scenario_hook=None,
        opening_line="营帐里风冷",
        default_state_json=json.dumps({"环境": "简陋边境营帐内"}, ensure_ascii=False),
    )
    compact, extracted = extract_and_strip_scene_locks(persona)
    assert "被俘" in extracted or "春药" in extracted or "化功散" in extracted
    assert "女诸葛" in compact
    # Core should shrink vs original after lock extraction
    new_persona, hook = separate_persona_and_scenario(character)
    assert "【动力学】" in new_persona
    assert "被俘" not in new_persona or "场景提示" in new_persona
    # Lock lines / crisis props moved out of core
    assert "多次被凌辱" not in new_persona
    assert "春药" not in new_persona
    assert "营帐" in hook or extracted
    dyn = parse_dynamics_from_persona(new_persona)
    # Must not misclassify 黄蓉 as nightclub dynamics
    assert "夜店" not in dyn.get("mask", "") and "浪女" not in dyn.get("mask", "")


def test_differentiated_dynamics_not_identical_for_two_legacies():
    a = SimpleNamespace(name="叶萱", description="快穿攻略女主，娇羞多变", voice_style="柔媚")
    b = SimpleNamespace(name="黄蓉", description="机智女侠，丐帮帮主", voice_style="酷女侠")
    da = build_differentiated_dynamics(a, "叶萱快穿世界")
    db = build_differentiated_dynamics(b, "黄蓉武侠机智")
    assert da != db
    assert da["mask"] != db["mask"]


def test_validate_atomic_bundle_requires_all_three():
    state = {"环境": "明亮的厨房", "衣服": "围裙", "姿势": "站着洗碗"}
    assert (
        validate_atomic_bundle(
            opening_line="回来了？",
            state=state,
            scene_summary="厨房晚饭后",
            safe_mode=False,
            scenario_hook="明亮的厨房，水槽旁",
        )
        == []
    )
    errs = validate_atomic_bundle(
        opening_line="回来了？",
        state=state,
        scene_summary="",
        safe_mode=False,
    )
    assert any("scene_summary" in e for e in errs)


def test_validate_rejects_generic_fallback_environment():
    state = {
        "环境": "私密空间光线暖柔，空气中弥漫甜香",
        "衣服": "贴身衣物",
        "姿势": "站着",
    }
    errs = validate_atomic_bundle(
        opening_line="厨房见",
        state=state,
        scene_summary="暧昧的私密空间",
        safe_mode=False,
        scenario_hook="明亮的厨房",
    )
    assert any("fallback" in e for e in errs)
    assert any("mismatch" in e for e in errs)


@pytest.mark.asyncio
async def test_migrator_refuses_apply_on_validation_failure():
    class StubAI:
        async def generate_scene_bootstrap(self, character, language="zh", allow_split_fallback=False):
            return {
                "opening_line": "hi",
                "state": {"环境": "地牢", "衣服": "囚衣", "姿势": "绑着"},
                "scene_summary": "",
            }

    character = SimpleNamespace(
        id=1,
        name="测试",
        description="d",
        persona_prompt="你是测试",
        backstory="",
        voice_style="平静",
        nsfw_level=1,
        opening_line="旧开场",
        opening_line_en=None,
        default_state_json=json.dumps(
            {"环境": "客厅", "衣服": "家居服", "姿势": "坐着"}, ensure_ascii=False
        ),
        default_state_json_en=None,
        scene_summary=None,
        scenario_hook=None,
        generation_version=None,
        source_hash=None,
        is_deleted=False,
    )
    migrator = SceneBundleMigrator(ai_manager=StubAI(), force=True)
    candidate = await migrator.build_candidate(character)
    assert candidate.validation_ok is False
    assert migrator.apply_candidate(character, candidate) is False
    assert character.opening_line == "旧开场"


@pytest.mark.asyncio
async def test_migrator_apply_writes_only_when_valid():
    class StubAI:
        async def generate_scene_bootstrap(self, character, language="zh", allow_split_fallback=False):
            return {
                "opening_line": "新开场，厨房见。",
                "state": {
                    "环境": "明亮厨房",
                    "衣服": "围裙家居服",
                    "姿势": "站在水槽前",
                    "胸部": "被围裙盖住",
                    "下体": "平静",
                    "情绪": {"value": 5, "description": "温和"},
                    "好感度": {"value": 5, "description": "亲近"},
                    "信任度": {"value": 5, "description": "信任"},
                    "兴奋度": {"value": 2, "description": "低"},
                    "疲惫度": {"value": 3, "description": "轻"},
                    "欲望值": {"value": 2, "description": "低"},
                    "敏感度": {"value": 3, "description": "中"},
                },
                "scene_summary": "晚饭后的厨房，姨妈擦着手看向门口",
            }

    character = SimpleNamespace(
        id=67,
        name="恩爱",
        description="姨妈",
        persona_prompt="你是郑恩爱。【冲突 Desire vs Role】",
        backstory="你是郑恩爱。【冲突 Desire vs Role】",
        voice_style="轻软",
        nsfw_level=1,
        opening_line="旧",
        opening_line_en="Old English opening that must be cleared or replaced",
        default_state_json='{"环境":"厨房"}',
        default_state_json_en='{"环境":"old en"}',
        scene_summary=None,
        scenario_hook=None,
        generation_version=None,
        source_hash=None,
    )
    migrator = SceneBundleMigrator(ai_manager=StubAI(), force=True, generate_english=True)
    candidate = await migrator.build_candidate(character)
    assert candidate.validation_ok is True
    assert candidate.baseline_fingerprint
    # EN stub returns ZH-shaped coherent bundle → may keep or clear; apply must succeed
    assert migrator.apply_candidate(character, candidate, require_baseline_match=True) is True
    assert character.opening_line.startswith("新开场")
    assert character.generation_version == SCENE_BUNDLE_GENERATION_VERSION
    assert character.source_hash
    assert character.scene_summary
    assert character.scenario_hook


@pytest.mark.asyncio
async def test_apply_from_report_refuses_baseline_drift():
    character = SimpleNamespace(
        id=71,
        name="嘉允",
        description="继母",
        persona_prompt="你是嘉允",
        backstory="",
        voice_style="轻",
        nsfw_level=1,
        opening_line="回来了",
        opening_line_en=None,
        default_state_json='{"环境":"客厅"}',
        default_state_json_en=None,
        scene_summary=None,
        scenario_hook=None,
        generation_version=None,
        source_hash=None,
    )
    baseline = compute_baseline_fingerprint(character)
    candidate = SceneBundleCandidate(
        character_id=71,
        name="嘉允",
        validation_ok=True,
        baseline_fingerprint=baseline,
        new={
            "persona_prompt": "新persona\n【动力学】\nmask: x",
            "scenario_hook": "客厅",
            "opening_line": "新开场",
            "default_state": {"环境": "客厅", "衣服": "家居服", "姿势": "坐着"},
            "scene_summary": "客厅见面",
            "generation_version": SCENE_BUNDLE_GENERATION_VERSION,
            "source_hash": "abc123",
            "clear_english_fields": False,
        },
    )
    migrator = SceneBundleMigrator(ai_manager=None)
    # Drift: change live content after report
    character.opening_line = "被人改过了"
    assert migrator.apply_candidate(character, candidate, require_baseline_match=True) is False
    # Restore and apply
    character.opening_line = "回来了"
    assert compute_baseline_fingerprint(character) == baseline
    assert migrator.apply_candidate(character, candidate, require_baseline_match=True) is True
    assert character.opening_line == "新开场"


@pytest.mark.asyncio
async def test_migrator_idempotent_skip():
    persona = build_compact_persona_prompt(
        SimpleNamespace(
            persona_prompt="你是嘉允\n【动力学】\nmask: 关心\ndrive: 靠近",
            backstory="",
            description="",
            name="嘉允",
            voice_style="轻",
            scenario_hook=None,
            opening_line=None,
            default_state_json=None,
        )
    )
    hook = "家里客厅｜开场：回来了"
    source_hash = compute_source_hash(
        name="嘉允",
        description="继母",
        backstory="",
        persona_prompt=persona,
        scenario_hook=hook,
        voice_style="轻",
        nsfw_level=1,
    )

    class BoomAI:
        async def generate_scene_bootstrap(self, *args, **kwargs):
            raise AssertionError("should not call AI on idempotent skip")

    character = SimpleNamespace(
        id=71,
        name="嘉允",
        description="继母",
        persona_prompt=persona,
        backstory="",
        voice_style="轻",
        nsfw_level=1,
        opening_line="回来了",
        opening_line_en=None,
        default_state_json=json.dumps({"环境": "家里客厅"}, ensure_ascii=False),
        default_state_json_en=None,
        scene_summary="客厅",
        scenario_hook=hook,
        generation_version=SCENE_BUNDLE_GENERATION_VERSION,
        source_hash=source_hash,
    )
    migrator = SceneBundleMigrator(ai_manager=BoomAI(), force=False)
    candidate = await migrator.build_candidate(character)
    assert candidate.skipped is True
    assert candidate.validation_ok is True


def test_ensure_dynamics_idempotent_for_existing_block():
    body = "你是娜琏\n\n【动力学】\nmask: 玩笑\ndrive: 掌控"
    character = SimpleNamespace(name="娜琏", description="夜店", voice_style="沙哑")
    from backend.utils.persona_scenario_split import ensure_dynamics_block

    assert ensure_dynamics_block(character, body) == body
    assert parse_dynamics_from_persona(body)["mask"] == "玩笑"
