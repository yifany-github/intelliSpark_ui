import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Character, User
from backend.schemas import CharacterCreate, CharacterUpdate
from backend.services.character_service import CharacterService


class StubAIManager:
    def __init__(self):
        self.calls = 0

    async def generate_opening_line(self, character: Character) -> str:
        self.calls += 1
        return f"Stub opening line #{self.calls} for {character.name}"


@pytest.fixture()
def sync_session():
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.mark.asyncio
async def test_create_character_generates_opening_line(sync_session, monkeypatch):
    user = User(username="creator", password="hashed")
    sync_session.add(user)
    sync_session.commit()

    service = CharacterService(sync_session)
    stub_manager = StubAIManager()

    async def fake_get_ai_manager():
        return stub_manager

    service._ai_manager = stub_manager
    monkeypatch.setattr(service, "_get_ai_manager", fake_get_ai_manager)

    payload = CharacterCreate(
        name="测试角色",
        description="这是一个具有详细背景的角色描述。",
        backstory="角色的完整背景故事。",
        personaPrompt=None,
        voiceStyle="柔和",
        traits=["calm", "friendly"],
        personalityTraits=None,
        category="fantasy",
        gender="female",
        age=22,
        nsfwLevel=0,
        conversationStyle="friendly",
        isPublic=True,
    )

    success, character_data, error = await service.create_character(payload, user_id=user.id)

    assert success is True
    assert error is None
    assert character_data["openingLine"].startswith("Stub opening line #1")
    assert service.opening_line_regenerated is True
    assert stub_manager.calls == 1

    stored_character = sync_session.get(Character, character_data["id"])
    assert stored_character.opening_line == character_data["openingLine"]


@pytest.mark.asyncio
async def test_update_character_refreshes_opening_line_when_description_changes(sync_session, monkeypatch):
    user = User(username="creator", password="hashed")
    sync_session.add(user)
    sync_session.commit()

    service = CharacterService(sync_session)
    stub_manager = StubAIManager()

    async def fake_get_ai_manager():
        return stub_manager

    service._ai_manager = stub_manager
    monkeypatch.setattr(service, "_get_ai_manager", fake_get_ai_manager)

    create_payload = CharacterCreate(
        name="初始角色",
        description="初始描述足够长，可以通过校验。",
        backstory="初始背景",
        personaPrompt=None,
        voiceStyle="沉稳",
        traits=["calm"],
        personalityTraits=None,
        category="fantasy",
        gender="female",
        age=25,
        nsfwLevel=0,
        conversationStyle="neutral",
        isPublic=True,
    )

    success, character_data, error = await service.create_character(create_payload, user_id=user.id)
    assert success and error is None
    character_id = character_data["id"]
    assert stub_manager.calls == 1

    # Update without changing descriptive fields should not regenerate
    update_payload = CharacterUpdate(isPublic=False)
    success, updated_data, error = await service.update_character(character_id, update_payload, user.id, is_admin=False)
    assert success and error is None
    assert stub_manager.calls == 1
    assert service.opening_line_regenerated is False
    assert updated_data["openingLine"] == character_data["openingLine"]

    # Update description triggers regeneration
    refreshed_payload = CharacterUpdate(description="这是一个全新的描述，强调角色的新背景。")
    success, refreshed_data, error = await service.update_character(character_id, refreshed_payload, user.id, is_admin=False)
    assert success and error is None
    assert stub_manager.calls == 2
    assert service.opening_line_regenerated is True
    assert refreshed_data["openingLine"].startswith("Stub opening line #2")

    stored_character = sync_session.get(Character, character_id)
    assert stored_character.opening_line == refreshed_data["openingLine"]
