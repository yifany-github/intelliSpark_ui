import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models import Base, Character, User
from backend.schemas import ChatCreate
from backend.services.chat_service import ChatService
from backend.services.character_state_manager import CharacterStateManager


@pytest_asyncio.fixture()
async def async_session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()


class StubAIManager:
    async def generate_response(self, character, messages, user_preferences=None, user=None, state=None):
        return (
            "角色轻声讲述旅途中所见，在温柔的光线里分享感受。",
            {"input_tokens": 12, "output_tokens": 35, "state_update": {"姿势": "靠在窗边", "情绪": "平静"}},
        )


@pytest.mark.asyncio
async def test_chat_flow_smoke(async_session: AsyncSession, monkeypatch):
    user = User(username="traveller", password="hashed")
    character = Character(
        name="艾琳",
        description="温柔的旅人，乐于分享沿途故事。",
        backstory="她走遍各地，将故事编织成温暖的诗。",
        voice_style="柔和",
        traits=["kind", "storyteller"],
        created_by=1,
    )
    async_session.add_all([user, character])
    await async_session.flush()

    service = ChatService(async_session)
    service._has_sufficient_tokens = AsyncMock(return_value=True)
    service._deduct_tokens = AsyncMock(return_value=True)

    async def fake_get_ai_model_manager():
        return StubAIManager()

    monkeypatch.setattr(
        "backend.services.chat_service.get_ai_model_manager",
        fake_get_ai_model_manager,
    )

    chat_create = ChatCreate(characterId=character.id, title="旅程序章", idempotencyKey=None)
    success, chat, error, created = await service.create_chat_immediate(chat_create, user.id)
    assert success is True
    assert chat is not None
    assert created is True

    state_manager = CharacterStateManager(async_session)
    initial_state = await state_manager.get_state(chat.id)
    assert initial_state  # seeded during chat creation

    success, payload, error = await service.generate_ai_response(chat.id, user.id)
    assert success is True
    assert error is None
    assert payload["message"]["state_snapshot"]["姿势"] == "靠在窗边"

    persisted_state = await state_manager.get_state(chat.id)
    assert persisted_state["姿势"] == "靠在窗边"
    assert persisted_state["情绪"] == "平静"
