from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from backend.models import Base, User, Character, Chat
from backend.services.chat_service import ChatService, DebugForcedError
from backend.services.circuit_breaker import CircuitBreaker


class StubAIManager:
    def __init__(self):
        self.calls = 0

    async def generate_response(self, character, messages, user):
        self.calls += 1
        if self.calls == 1:
            raise DebugForcedError("database_error")
        return "All good!", {"input_tokens": 100, "output_tokens": 200}


@pytest.mark.asyncio
async def test_generate_ai_response_retries_and_stores_message(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        user = User(username="tester", password="hashed")
        character = Character(
            name="Persona",
            description="Test character",
            backstory="Backstory",
            voice_style="Calm",
            traits=["friendly"],
        )
        session.add_all([user, character])
        await session.flush()

        chat = Chat(user_id=user.id, character_id=character.id, title="Test Chat")
        session.add(chat)
        await session.commit()
        await session.refresh(chat)

        stub_ai = StubAIManager()

        async def fake_get_ai_model_manager():
            return stub_ai

        monkeypatch.setattr(
            "backend.services.chat_service.get_ai_model_manager",
            fake_get_ai_model_manager,
        )

        service = ChatService(session)
        service.BREAKER = CircuitBreaker(max_failures=3, reset_timeout=0.1)
        service._has_sufficient_tokens = AsyncMock(return_value=True)
        service._deduct_tokens = AsyncMock(return_value=True)

        success, payload, error = await service.generate_ai_response(chat.id, user.id)

        assert success is True
        assert error is None
        assert payload["retryMeta"]["attempts"] == 2  # One retry after forced failure
        assert stub_ai.calls == 2
        service._deduct_tokens.assert_awaited_once()

    await engine.dispose()
