from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from config import settings
from models import Base, Character


def _build_async_database_url(url: str) -> str:
    """Derive an async-compatible SQLAlchemy URL from the configured DSN."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


# Async engine/session used by the FastAPI request lifecycle
ASYNC_DATABASE_URL = _build_async_database_url(settings.database_url)
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.debug,
)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)

# Synchronous engine retained for scripts and background utilities that still
# rely on the blocking ORM patterns (e.g. APScheduler jobs).
sync_engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)


def ensure_user_admin_columns_sync(connection) -> None:
    """Ensure admin-related user columns exist (runs synchronously)."""
    inspector = inspect(connection)
    try:
        existing_columns = {column["name"] for column in inspector.get_columns("users")}
    except Exception:
        existing_columns = set()

    if not existing_columns:
        return

    dialect = connection.dialect.name
    boolean_type = "INTEGER" if dialect == "sqlite" else "BOOLEAN"
    bool_default_false = "0" if dialect == "sqlite" else "FALSE"
    datetime_type = "TIMESTAMP"
    text_type = "TEXT"
    string_type = "VARCHAR(100)" if dialect != "sqlite" else "TEXT"

    migrations = {
        "email_verified": f"ALTER TABLE users ADD COLUMN email_verified {boolean_type} DEFAULT {bool_default_false}",
        "last_login_at": f"ALTER TABLE users ADD COLUMN last_login_at {datetime_type}",
        "last_login_ip": f"ALTER TABLE users ADD COLUMN last_login_ip {string_type}",
        "is_suspended": f"ALTER TABLE users ADD COLUMN is_suspended {boolean_type} DEFAULT {bool_default_false}",
        "suspended_at": f"ALTER TABLE users ADD COLUMN suspended_at {datetime_type}",
        "suspension_reason": f"ALTER TABLE users ADD COLUMN suspension_reason {text_type}",
    }

    for column_name, ddl in migrations.items():
        if column_name not in existing_columns:
            connection.execute(text(ddl))


with sync_engine.begin() as sync_conn:
    ensure_user_admin_columns_sync(sync_conn)


def get_db():
    """FastAPI dependency for legacy synchronous routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an AsyncSession."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Initialize database schema and seed baseline data."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(ensure_user_admin_columns_sync)

    async with AsyncSessionLocal() as session:
        await create_initial_data(session)


async def create_initial_data(session: AsyncSession) -> None:
    """Create initial characters if they don't exist."""
    existing = await session.execute(text("SELECT 1 FROM characters LIMIT 1"))
    if existing.first():
        return

    characters = [
        Character(
            name="艾莉丝",
            avatar_url="/assets/characters_img/Elara.jpeg",
            backstory=(
                "Elara is the last of an ancient line of arcane practitioners who once advised kings and queens "
                "throughout the realm. After centuries of extending her life through magical means, she has accumulated "
                "vast knowledge but has grown somewhat detached from humanity."
            ),
            voice_style="Mystical, refined feminine voice",
            traits=["Mage", "Wise", "Ancient", "Mysterious"],
            gender="female",
            personality_traits={
                "Warmth": 40,
                "Humor": 20,
                "Intelligence": 95,
                "Patience": 75,
            },
        ),
        Character(
            name="Kravus",
            avatar_url="/assets/characters_img/Elara.jpeg",
            backstory=(
                "A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing "
                "presence and scarred visage tell of countless battles survived through sheer strength and determination."
            ),
            voice_style="Deep, commanding masculine voice",
            traits=["Warrior", "Brash", "Honorable", "Strong"],
            gender="male",
            personality_traits={
                "Warmth": 30,
                "Humor": 45,
                "Intelligence": 65,
                "Patience": 25,
            },
        ),
        Character(
            name="Lyra",
            avatar_url="/assets/characters_img/Elara.jpeg",
            backstory=(
                "A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive in a world that has never "
                "shown her kindness. Despite her tough exterior, she harbors a soft spot for those who have been wronged."
            ),
            voice_style="Sly, confident feminine voice",
            traits=["Rogue", "Tsundere", "Quick-witted", "Secretive"],
            personality_traits={
                "Warmth": 50,
                "Humor": 75,
                "Intelligence": 85,
                "Patience": 40,
            },
        ),
        Character(
            name="XN-7",
            avatar_url="/assets/characters_img/Elara.jpeg",
            backstory=(
                "An advanced android with a curiosity about human emotions. XN-7 was designed to assist with complex "
                "calculations and data analysis, but has developed beyond its original programming and now seeks to "
                "understand what it means to be alive."
            ),
            voice_style="Synthetic, precise voice with subtle emotional undertones",
            traits=["Android", "Logical", "Curious", "Evolving"],
            personality_traits={
                "Warmth": 25,
                "Humor": 10,
                "Intelligence": 99,
                "Patience": 90,
            },
        ),
    ]

    session.add_all(characters)
    await session.commit()
