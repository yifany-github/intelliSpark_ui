from datetime import datetime, timezone

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models import Base, Chat, Character, CharacterChatState, User
from backend.schemas import ChatState
from backend.services.character_state_manager import CharacterStateManager
from backend.services.chat_service import ChatService


@pytest_asyncio.fixture()
async def async_session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        yield session

    await engine.dispose()


async def _create_user(session: AsyncSession) -> User:
    user = User(username="tester", password="hashed")
    session.add(user)
    await session.flush()
    return user


async def _create_character(session: AsyncSession, user_id: int) -> Character:
    character = Character(
        name="梦璃",
        description="她是一个拥有温柔气质的角色，用细腻表达引导剧情。",
        backstory="来自月影王国的吟游诗人。",
        voice_style="柔和",
        traits=["gentle", "poetic"],
        created_by=user_id,
        nsfw_level=1,
    )
    session.add(character)
    await session.flush()
    return character


async def _create_chat(session: AsyncSession, user_id: int, character_id: int) -> Chat:
    chat = Chat(user_id=user_id, character_id=character_id, title="Test Chat")
    session.add(chat)
    await session.flush()
    return chat


@pytest.mark.asyncio
async def test_initialize_state_creates_all_keys(async_session: AsyncSession):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    state = await manager.initialize_state(chat.id, character)

    assert set(state.keys()) == set(manager.NSFW_KEYS)
    assert all(
        isinstance(value, (str, dict)) and value
        for value in state.values()
    )

    stored = await async_session.get(CharacterChatState, chat.id)
    assert stored is not None
    assert stored.state_json is not None


@pytest.mark.asyncio
async def test_update_state_merges_values(async_session: AsyncSession):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)

    updated = await manager.update_state(chat.id, {"衣服": "上衣已脱", "情绪": "羞涩"})
    assert updated["衣服"] == "上衣已脱"
    assert updated["情绪"] == "羞涩"

    persisted = await manager.get_state(chat.id)
    assert persisted["衣服"] == "上衣已脱"
    assert persisted["情绪"] == "羞涩"


@pytest.mark.asyncio
async def test_update_state_rejects_invalid_keys(async_session: AsyncSession):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)

    with pytest.raises(ValueError):
        await manager.update_state(chat.id, {"invalid": "value"})


@pytest.mark.asyncio
async def test_get_state_returns_empty_when_missing(async_session: AsyncSession):
    manager = CharacterStateManager(async_session)
    state = await manager.get_state(9999)
    assert state == {}


@pytest.mark.asyncio
async def test_generate_ai_response_updates_state_snapshot(async_session: AsyncSession, monkeypatch):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)

    class StubAIManager:
        async def generate_response(self, character, messages, user_preferences=None, user=None, state=None):
            return (
                "这是角色的回答",
                {
                    "input_tokens": 5,
                    "output_tokens": 12,
                    "state_update": {"衣服": "上衣已脱"},
                    "active_dynamic": "initiative",
                },
            )

    async def fake_get_ai_model_manager():
        return StubAIManager()

    monkeypatch.setattr(
        "backend.services.chat_service.get_ai_model_manager",
        fake_get_ai_model_manager,
    )

    service = ChatService(async_session)
    service._has_sufficient_tokens = AsyncMock(return_value=True)
    service._deduct_tokens = AsyncMock(return_value=True)

    success, payload, error = await service.generate_ai_response(chat.id, user.id)

    assert success is True
    assert error is None
    assert payload["message"]["state_snapshot"]["衣服"] == "上衣已脱"
    assert "_last_dynamic" not in payload["message"]["state_snapshot"]

    updated_state = await manager.get_state(chat.id)
    assert updated_state["衣服"] == "上衣已脱"
    assert updated_state["_last_dynamic"] == "initiative"


def test_public_state_strips_internal_meta():
    internal_state = {
        "环境": "厨房",
        "动作": "靠在料理台边",
        "_last_dynamic": "initiative",
        "_relationship_read": "仍在试探",
        "_internal_debug": "not public",
    }

    public_state = CharacterStateManager.public_state(internal_state)

    assert public_state == {"环境": "厨房", "动作": "靠在料理台边"}
    assert internal_state["_last_dynamic"] == "initiative"

    response = ChatState(
        chat_id=1,
        state=public_state,
        updated_at=datetime.now(timezone.utc),
    )
    assert response.state == public_state


@pytest.mark.asyncio
async def test_last_dynamic_survives_reinitialize(async_session: AsyncSession):
    """`_last_dynamic` must not be dropped by initialize_state key filtering."""
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)

    updated = await manager.update_state(chat.id, {"_last_dynamic": "initiative"})
    assert updated["_last_dynamic"] == "initiative"

    reinited = await manager.initialize_state(chat.id, character)
    assert reinited["_last_dynamic"] == "initiative"

    persisted = await manager.get_state(chat.id)
    assert persisted["_last_dynamic"] == "initiative"


@pytest.mark.asyncio
async def test_last_dynamic_stays_english_through_localize(
    async_session: AsyncSession,
    monkeypatch,
):
    """Translator must never rewrite `_last_dynamic` into Chinese."""
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)
    await manager.update_state(chat.id, {"_last_dynamic": "initiative"})

    class StubTranslator:
        client = object()

        def detect_language(self, text: str) -> str:
            return "zh"

        async def translate_state_json_values(self, state, target_lang):
            # Simulate a buggy translator that would mangle meta if included
            out = dict(state)
            if "_last_dynamic" in out:
                out["_last_dynamic"] = "主动推进"
            if "衣服" in out:
                out["衣服"] = "translated clothing"
            return out

    monkeypatch.setattr(
        "backend.services.character_state_manager.get_translation_service",
        lambda: StubTranslator(),
    )

    # Force localize path: English target while Chinese values remain
    result = await manager.initialize_state(chat.id, character, language="en")
    assert result["_last_dynamic"] == "initiative"


@pytest.mark.asyncio
async def test_invalid_last_dynamic_rejected(async_session: AsyncSession):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    manager = CharacterStateManager(async_session)
    await manager.initialize_state(chat.id, character)
    await manager.update_state(chat.id, {"_last_dynamic": "initiative"})

    # Chinese / unknown enum must not overwrite the English key
    updated = await manager.update_state(chat.id, {"_last_dynamic": "主动"})
    assert updated["_last_dynamic"] == "initiative"


def test_lead_mode_rotates_off_last_dynamic():
    from backend.prompts.persona_dynamics import select_active_dynamic

    dynamics = {
        "mask": "先用玩笑挡一下",
        "drive": "想被认真对待",
        "defense": "退半步再试探",
        "initiative": "先动手再解释",
        "pressure_shift": "嘴硬身体先软",
        "boundary": "不接受公开羞辱",
    }
    key, _ = select_active_dynamic(
        mode="lead",
        dynamics=dynamics,
        recent_goals=("initiative",),
    )
    assert key == "mask"


@pytest.mark.asyncio
async def test_generate_ai_response_rejects_invalid_state(async_session: AsyncSession, monkeypatch):
    user = await _create_user(async_session)
    character = await _create_character(async_session, user.id)
    chat = await _create_chat(async_session, user.id, character.id)

    service = ChatService(async_session)
    service._has_sufficient_tokens = AsyncMock(return_value=True)
    service._deduct_tokens = AsyncMock(return_value=True)

    manager = service.state_manager
    await manager.initialize_state(chat.id, character)
    manager.update_state = AsyncMock(side_effect=ValueError("Invalid state keys: 无效"))

    class InvalidStateAIManager:
        async def generate_response(self, character, messages, user_preferences=None, user=None, state=None):
            return (
                "无效状态响应",
                {"input_tokens": 2, "output_tokens": 8, "state_update": {"无效": "value"}},
            )

    async def fake_get_ai_model_manager():
        return InvalidStateAIManager()

    monkeypatch.setattr(
        "backend.services.chat_service.get_ai_model_manager",
        fake_get_ai_model_manager,
    )

    success, payload, error = await service.generate_ai_response(chat.id, user.id)

    assert success is False
    assert payload["code"] == "state_invalid"
    assert error is not None
    # Rollback after invalid update — state must not contain the bad key
    original_state = await manager.get_state(chat.id)
    assert "无效" not in original_state
