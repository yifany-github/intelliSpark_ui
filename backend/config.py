import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database settings
    database_url: str = "sqlite:///./backend/roleplay_chat.db"  # Default to SQLite for development
    
    # Authentication settings
    secret_key: str
    
    # AI Model settings
    gemini_api_key: Optional[str] = None
    grok_api_key: Optional[str] = None  # xAI Grok API key
    
    # Firebase settings
    firebase_api_key: Optional[str] = None
    
    # Stripe settings
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Voice/Audio settings
    eleven_lab_api: Optional[str] = None
    
    # App settings
    app_name: str = "ProductInsightAI Backend"
    debug: bool = True
    
    # CORS settings
    allowed_origins: list = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5000", "http://localhost:3000"]
    
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
    
    if not settings.firebase_api_key:
        print("WARNING: FIREBASE_API_KEY not found. Google OAuth will not work.")
    
    if not settings.stripe_secret_key:
        print("WARNING: STRIPE_SECRET_KEY not found. Payment processing will not work.")
    
    if not settings.secret_key:
        raise ValueError("SECRET_KEY is required for JWT authentication")
    
    print(f"Database URL: {settings.database_url}")
    print(f"Debug mode: {settings.debug}")
    print(f"Gemini API Key present: {'Yes' if settings.gemini_api_key else 'No'}")
    print(f"Grok API Key present: {'Yes' if settings.grok_api_key else 'No'}")
    print(f"Firebase API Key present: {'Yes' if settings.firebase_api_key else 'No'}")
    print(f"Secret Key present: {'Yes' if settings.secret_key else 'No'}")
    print(f"Stripe Secret Key present: {'Yes' if settings.stripe_secret_key else 'No'}")

# Call validation on import
validate_settings()