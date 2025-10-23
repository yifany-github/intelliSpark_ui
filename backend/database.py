from __future__ import annotations

from typing import AsyncGenerator, Callable, List, Tuple
import inspect as pyinspect
import os
import ssl
import logging
from urllib.parse import urlparse, parse_qs
from sqlalchemy import create_engine, inspect as sa_inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from config import settings
from models import Base, Character

logger = logging.getLogger(__name__)

SUPABASE_HOST_SUFFIXES = (
    "supabase.co",
    "supabase.net",
    "supabase.com",
    "supabase.internal",
)


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


def _detect_pool_reasons(url: str) -> Tuple[bool, str, List[str]]:
    """Return pooling detection flag, host, and reasons for diagnostics."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    host = (parsed.hostname or "").lower()
    reasons = []

    if params.get("pgbouncer", ["false"])[0].lower() == "true":
        reasons.append("param:pgbouncer=true")

    pool_mode = params.get("pool_mode", [""])[0].lower()
    if pool_mode in {"transaction", "statement"}:
        reasons.append(f"param:pool_mode={pool_mode}")

    if host and _is_supabase_pool_host(host):
        reasons.append("host:supabase_pool")

    if parsed.port in {5433, 6543} and host and "supabase" in host:
        reasons.append(f"port:{parsed.port}")

    return bool(reasons), host, reasons


def _is_supabase_pool_host(host: str) -> bool:
    """Identify Supabase pooler/connect hosts."""
    if not host:
        return False
    host = host.lower()
    if "supabase" not in host:
        return False
    if not any(host.endswith(suffix) for suffix in SUPABASE_HOST_SUFFIXES):
        return False
    return "pool" in host or "connect" in host or host.endswith("supabase.internal")


def _using_transaction_pool(url: str) -> bool:
    """Expose pooling detection for tests."""
    url_lower = url.lower()
    if "supabase" in url_lower:
        return True
    if settings.pgbouncer_disable_cache:
        return True
    detected, _, _ = _detect_pool_reasons(url)
    return detected


SQLALCHEMY_DIALECT_ONLY_ARGS = {
    "prepared_statement_cache_size",
    "prepared_statement_name_func",
}


def _filter_async_connect_args(base_args: dict[str, object]) -> dict[str, object]:
    """Drop connect args that the asyncpg driver does not support."""
    try:
        import asyncpg  # type: ignore
    except ImportError:
        unsupported = {"prepare_threshold"}
        return {
            k: v
            for k, v in base_args.items()
            if k not in unsupported or k in SQLALCHEMY_DIALECT_ONLY_ARGS
        }

    try:
        supported_params = set(pyinspect.signature(asyncpg.connect).parameters)
    except (TypeError, ValueError):
        supported_params = set()

    unsupported: set[str] = set()
    filtered: dict[str, object] = {}

    for key, value in base_args.items():
        if key in SQLALCHEMY_DIALECT_ONLY_ARGS:
            filtered[key] = value
            continue
        if supported_params and key not in supported_params:
            unsupported.add(key)
            continue
        if not supported_params and key == "prepare_threshold":
            unsupported.add(key)
            continue
        filtered[key] = value

    if unsupported:
        logger.info(
            "db_connect_args_filtered | unsupported=%s",
            ",".join(sorted(unsupported)),
        )

    return filtered


def _anonymous_prepared_statement_name() -> str:
    """Return empty string so asyncpg uses unnamed statements."""
    return ""


# Async engine/session used by the FastAPI request lifecycle
ASYNC_DATABASE_URL = _build_async_database_url(settings.database_url)
pool_detected = False
pool_host = ""
pool_reasons: List[str] = []
supabase_in_dsn = False

if ASYNC_DATABASE_URL.startswith("postgresql+asyncpg://"):
    async_connect_args: dict[str, object] = _filter_async_connect_args(
        {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepare_threshold": 0,
        }
    )
    print("[database] async_connect_args initial (pgbouncer-safe)", async_connect_args)

    async_detected, async_host, async_reasons = _detect_pool_reasons(ASYNC_DATABASE_URL)
    if async_detected:
        pool_detected = True
        pool_host = async_host
        pool_reasons.extend(async_reasons)

    supabase_in_dsn = "supabase" in settings.database_url.lower() or "supabase" in ASYNC_DATABASE_URL.lower()

    if supabase_in_dsn and "supabase_env" not in pool_reasons:
        pool_detected = True
        parsed = urlparse(settings.database_url)
        pool_host = (parsed.hostname or "").lower() or pool_host
        pool_reasons.append("supabase_env")

    if settings.pgbouncer_disable_cache:
        pool_detected = True
        pool_reasons.append("env:override")

    if "statement_cache_size" in async_connect_args:
        async_connect_args["statement_cache_size"] = 0
    if "prepared_statement_cache_size" in async_connect_args:
        async_connect_args["prepared_statement_cache_size"] = 0
    if pool_detected or supabase_in_dsn or settings.pgbouncer_disable_cache:
        async_connect_args["prepared_statement_name_func"] = (
            _anonymous_prepared_statement_name
        )
    async_connect_args["ssl"] = ssl.create_default_context()
    print("[database] async_connect_args after detection", async_connect_args)

    if pool_detected or supabase_in_dsn or settings.pgbouncer_disable_cache:
        logger.info(
            "db_pool_detected | driver=asyncpg host=%s reasons=%s statement_cache_disabled=%s",
            pool_host or "override",
            ",".join(pool_reasons) if pool_reasons else "unknown",
            True,
        )
else:
    async_connect_args = {}

async_engine_kwargs = {
    "connect_args": dict(async_connect_args),
    "pool_pre_ping": True,
    "pool_reset_on_return": "rollback",
    "echo": settings.debug,
}

if ASYNC_DATABASE_URL.startswith("sqlite+aiosqlite://"):
    async_engine_kwargs["poolclass"] = NullPool
else:
    async_engine_kwargs.update(
        {
            "pool_size": 10,
            "max_overflow": 10,
            "pool_recycle": 300,
            "pool_timeout": 10,
        }
    )

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    **async_engine_kwargs,
)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)

# Synchronous engine retained for scripts and background utilities that still
# rely on the blocking ORM patterns (e.g. APScheduler jobs).
sync_connect_args: dict[str, object] = {}
if settings.database_url.startswith("sqlite"):
    sync_connect_args["check_same_thread"] = False
elif settings.database_url.startswith("postgresql"):
    # Ensure TLS is required for PostgreSQL connections
    sync_connect_args["sslmode"] = "require"

sync_engine_kwargs = {
    "connect_args": sync_connect_args,
    "pool_pre_ping": True,
    "pool_reset_on_return": "rollback",
}

if settings.database_url.startswith("sqlite"):
    sync_engine_kwargs["poolclass"] = NullPool
else:
    sync_engine_kwargs.update(
        {
            "pool_size": 5,
            "max_overflow": 5,
            "pool_recycle": 300,
            "pool_timeout": 10,
        }
    )

sync_engine = create_engine(
    settings.database_url,
    **sync_engine_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

SKIP_DATABASE_BOOTSTRAP = os.getenv("SKIP_DATABASE_BOOTSTRAP", "false").lower() in {"1", "true", "yes"}


def ensure_user_admin_columns_sync(connection) -> None:
    """Ensure admin-related user columns exist (runs synchronously)."""
    inspector = sa_inspect(connection)
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


if not SKIP_DATABASE_BOOTSTRAP:
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
    if SKIP_DATABASE_BOOTSTRAP:
        return
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
# Force rebuild Thu 16 Oct 2025 16:05:04 ADT
