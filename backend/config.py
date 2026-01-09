import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database settings
    database_url: str = "sqlite:///./backend/roleplay_chat.db"  # Default to SQLite for development
    
    # Authentication settings
    secret_key: str
    admin_jwt_secret: str  # JWT secret for admin authentication
    
    # AI Model settings
    gemini_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None  # xAI Grok API key
    openai_api_key: Optional[str] = None  # OpenAI API key
    
    # Legacy Firebase settings (deprecated)
    firebase_api_key: Optional[str] = None
    
    # Stripe settings
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None

    # FX rate settings
    fx_rate_api_url: Optional[str] = None
    fx_rate_api_timeout_seconds: int = 5
    fx_rate_cache_ttl_seconds: int = 86400
    fx_default_usd_cny_rate: float = 7.2
    fx_usd_cny_rate_override: Optional[float] = None

    # Voice/Audio settings
    eleven_lab_api: Optional[str] = None

    # App settings
    app_name: str = "ProductInsightAI Backend"
    debug: bool = True
    sqlalchemy_echo: bool = False
    
    # Redis settings (optional, used for rate limiting storage)
    redis_url: Optional[str] = None
    
    # CORS settings - can be comma-separated string for production
    allowed_origins: Optional[str] = None  # e.g., "https://yourdomain.com,https://www.yourdomain.com"
    allowed_origin_regex: Optional[str] = None  # Advanced pattern support e.g. "^https://.*\\.pages\\.dev$"
    
    # Character System Configuration
    enable_hardcoded_character_loading: bool = False  # Default disabled
    enable_character_file_sync: bool = False          # Default disabled
    enable_startup_character_sync: bool = False       # Default disabled

    # Supabase settings
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_storage_bucket: Optional[str] = None
    supabase_public_bucket_base_url: Optional[str] = None  # Optional override for public URL base
    supabase_jwt_secret: Optional[str] = None
    supabase_jwt_audience: Optional[str] = "authenticated"

    # Database pool behaviour
    pgbouncer_disable_cache: bool = False  # Force asyncpg statement cache off when True

    # Debug tooling
    chat_debug_force_error_header: bool = False  # Allow X-Debug-Force-Error header when True (dev only)

    @property
    def supabase_storage_enabled(self) -> bool:
        """Return True when Supabase Storage credentials are configured."""
        return bool(
            self.supabase_url
            and self.supabase_service_role_key
            and self.supabase_storage_bucket
        )

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra environment variables

# Create global settings instance
settings = Settings()

# Validation
def validate_settings():
    """Validate that required settings are present"""
    if not settings.gemini_api_key:
        print("WARNING: GEMINI_API_KEY not found. Gemini AI responses will be simulated.")
    
    if not settings.grok_api_key:
        print("WARNING: GROK_API_KEY not found. Grok AI responses will be simulated.")

    if not settings.openai_api_key:
        print("WARNING: OPENAI_API_KEY not found. OpenAI responses will be simulated.")
    
    if not settings.stripe_secret_key:
        print("WARNING: STRIPE_SECRET_KEY not found. Payment processing will not work.")

    if not settings.secret_key:
        raise ValueError("SECRET_KEY is required for JWT authentication")

    if not settings.admin_jwt_secret:
        raise ValueError("ADMIN_JWT_SECRET is required for admin JWT authentication")

    if not settings.supabase_jwt_secret:
        print("WARNING: SUPABASE_JWT_SECRET not found. Supabase authentication will not work.")
    
    # Database configuration logging (mask sensitive parts)
    db_type = "PostgreSQL (Supabase)" if settings.database_url.startswith("postgresql") else "SQLite (Development)"
    print(f"Database: {db_type}")
    try:
        from urllib.parse import urlsplit, urlunsplit
        if settings.database_url.startswith("postgresql"):
            parts = urlsplit(settings.database_url)
            netloc = parts.netloc
            userinfo, at, hostport = netloc.partition("@")
            if at:
                user, colon, _pwd = userinfo.partition(":")
                masked_userinfo = f"{user}{colon}***"
                masked_netloc = f"{masked_userinfo}@{hostport}"
            else:
                masked_netloc = netloc
            masked_url = urlunsplit((parts.scheme, masked_netloc, parts.path, parts.query, parts.fragment))
            print(f"Database URL: {masked_url}")
        else:
            print(f"Database URL: {settings.database_url}")
    except Exception:
        # Fallback to non-masked if parsing fails
        print(f"Database URL: {settings.database_url}")
    print(f"Debug mode: {settings.debug}")
    print(f"SQLAlchemy echo enabled: {settings.sqlalchemy_echo}")
    print(f"Gemini API Key present: {'Yes' if settings.gemini_api_key else 'No'}")
    print(f"Grok API Key present: {'Yes' if settings.grok_api_key else 'No'}")
    print(f"OpenAI API Key present: {'Yes' if settings.openai_api_key else 'No'}")
    print(f"Supabase JWT Secret present: {'Yes' if settings.supabase_jwt_secret else 'No'}")
    print(f"Secret Key present: {'Yes' if settings.secret_key else 'No'}")
    print(f"Stripe Secret Key present: {'Yes' if settings.stripe_secret_key else 'No'}")
    if settings.redis_url:
        print("Redis URL detected: using Redis-backed rate limiting if configured in app")
    print(f"PgBouncer disable cache flag: {settings.pgbouncer_disable_cache}")
    print(f"Debug force-error header enabled: {settings.chat_debug_force_error_header}")

# Call validation on import
validate_settings()
