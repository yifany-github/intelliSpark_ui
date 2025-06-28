import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database settings
    database_url: str = "sqlite:///./roleplay_chat.db"  # Default to SQLite for development
    
    # Gemini AI settings
    gemini_api_key: Optional[str] = None
    
    # App settings
    app_name: str = "ProductInsightAI Backend"
    debug: bool = True
    
    # CORS settings
    allowed_origins: list = ["http://localhost:5000", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create global settings instance
settings = Settings()

# Validation
def validate_settings():
    """Validate that required settings are present"""
    if not settings.gemini_api_key:
        print("WARNING: GEMINI_API_KEY not found. AI responses will be simulated.")
    
    print(f"Database URL: {settings.database_url}")
    print(f"Debug mode: {settings.debug}")
    print(f"Gemini API Key present: {'Yes' if settings.gemini_api_key else 'No'}")

# Call validation on import
validate_settings()