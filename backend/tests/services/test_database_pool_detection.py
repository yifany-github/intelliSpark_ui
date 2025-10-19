import importlib
import sys

import pytest


def _reload_database(monkeypatch, dsn: str, disable_cache_override: bool | None = None):
    """Reload backend.database with provided env configuration."""
    monkeypatch.setenv("DATABASE_URL", dsn)
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("ADMIN_JWT_SECRET", "test-admin-secret")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-supabase-secret")
    monkeypatch.setenv("SKIP_DATABASE_BOOTSTRAP", "true")
    if disable_cache_override is None:
        monkeypatch.delenv("PGBOUNCER_DISABLE_CACHE", raising=False)
    else:
        monkeypatch.setenv(
            "PGBOUNCER_DISABLE_CACHE",
            "true" if disable_cache_override else "false",
        )

    # Ensure config/database pick up the new environment
    for module_name in ("backend.database", "backend.config", "database", "config"):
        if module_name in sys.modules:
            del sys.modules[module_name]

    config = importlib.import_module("backend.config")
    database = importlib.import_module("backend.database")
    return config, database


@pytest.mark.parametrize(
    "dsn,expected_detected",
    [
        (
            "postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            True,
        ),
        (
            "postgresql://user:pass@localhost:5432/product_insight_ai",
            False,
        ),
    ],
)
def test_pool_detection_heuristics(monkeypatch, dsn, expected_detected):
    _, database = _reload_database(monkeypatch, dsn)
    detected = database._using_transaction_pool(database.ASYNC_DATABASE_URL)
    assert detected == expected_detected


def test_supabase_connect_disables_statement_cache(monkeypatch):
    _, database = _reload_database(
        monkeypatch,
        "postgresql://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    )

    assert database.async_connect_args.get("statement_cache_size") == 0
    assert database.async_connect_args.get("prepared_statement_cache_size") == 0
    assert callable(database.async_connect_args.get("prepared_statement_name_func"))
    assert database.async_connect_args["prepared_statement_name_func"]() == ""


def test_manual_override_disables_statement_cache(monkeypatch):
    _, database = _reload_database(
        monkeypatch,
        "postgresql://user:pass@localhost:5432/product_insight_ai",
        disable_cache_override=True,
    )

    # Even though host isn't detected, manual override should disable caches
    assert database.async_connect_args.get("statement_cache_size") == 0
    assert database.async_connect_args.get("prepared_statement_cache_size") == 0
    assert callable(database.async_connect_args.get("prepared_statement_name_func"))
    assert database.async_connect_args["prepared_statement_name_func"]() == ""
