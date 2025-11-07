import os
import sys
from pathlib import Path
import base64
import re

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# Ensure imports work when running as `python main.py` from backend/
# and when executing as a package (`python -m backend.main`)
CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent
BACKEND_DIR = CURRENT_DIR / "backend"

for candidate in (PARENT_DIR, CURRENT_DIR, BACKEND_DIR):
    candidate_str = str(candidate)
    if candidate_str not in sys.path and candidate.exists():
        sys.path.insert(0, candidate_str)

# Load environment variables from .env file
load_dotenv()

# Import our routes with fallback to package-qualified names
try:
    from routes.characters import router as characters_router
    from routes.chats import router as chats_router
    from routes.admin import router as new_admin_router  # New AI admin routes
    from routes.search import router as search_router  # Search routes
    from routes.user_preferences import router as preferences_router
except ModuleNotFoundError:
    from backend.routes.characters import router as characters_router
    from backend.routes.chats import router as chats_router
    from backend.routes.admin import router as new_admin_router  # New AI admin routes
    from backend.routes.search import router as search_router  # Search routes
    from backend.routes.user_preferences import router as preferences_router

try:
    from admin.routes import router as admin_router
except ModuleNotFoundError:
    from backend.admin.routes import router as admin_router

try:
    from auth.routes import router as auth_router
    from auth.admin_routes import router as admin_auth_router  # New JWT admin auth
except ModuleNotFoundError:
    from backend.auth.routes import router as auth_router
    from backend.auth.admin_routes import router as admin_auth_router  # New JWT admin auth

try:
    from payment.routes import router as payment_router
except ModuleNotFoundError:
    from backend.payment.routes import router as payment_router

try:
    from notifications_routes import router as notifications_router
except ModuleNotFoundError:
    from backend.notifications_routes import router as notifications_router

try:
    from database import init_db
    from config import settings
except ModuleNotFoundError:
    from backend.database import init_db
    from backend.config import settings

# Create FastAPI app
app = FastAPI(
    title="ProductInsightAI Backend",
    description="AI Role-playing Chat Backend with Gemini",
    version="1.0.0"
)

# Initialize rate limiter
# If REDIS_URL is provided, use Redis-backed storage for rate limits; otherwise use in-memory
if settings.redis_url:
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)
else:
    limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware to allow frontend requests
# In production, restrict to ALLOWED_ORIGINS only. Use localhost defaults only when not configured.
wildcard_patterns = []

if settings.allowed_origins:
    raw_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    allowed_origins = []
    for origin in raw_origins:
        if "*" in origin:
            # Convert wildcard syntax to a regex that FastAPI's CORS middleware understands
            # Allow simple wildcard patterns (e.g. https://*.example.com)
            pattern = re.escape(origin).replace("\\*", ".*")
            wildcard_patterns.append(f"^{pattern}$")
        else:
            allowed_origins.append(origin)
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5000",
        "http://localhost:3000",
    ]

regex_parts = []
if wildcard_patterns:
    combined = "|".join(wildcard_patterns)
    if combined:
        regex_parts.append(f"({combined})")

if settings.allowed_origin_regex:
    regex_parts.append(f"({settings.allowed_origin_regex})")

allowed_origin_regex = "|".join(regex_parts) if regex_parts else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=allowed_origin_regex,
)

# Add security headers middleware for uploaded files
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to prevent script execution from uploaded files"""
    response = await call_next(request)
    
    # Apply security headers to user-uploaded images to prevent XSS
    if request.url.path.startswith("/assets/user_characters_img/"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
    
    return response

# Get the parent directory to access attached_assets
# In Docker, main.py is in /app/, so parent is /app/ (where attached_assets is mounted)
parent_dir = Path(__file__).parent

# Include API routes FIRST (highest priority for authentication)
app.include_router(characters_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(new_admin_router, prefix="/api")  # New AI admin routes
app.include_router(search_router, prefix="/api")  # Search routes
app.include_router(preferences_router, prefix="/api")  # User preferences routes
app.include_router(admin_router, prefix="/api/admin")  # Legacy admin routes
app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(admin_auth_router, prefix="/api/auth", tags=["admin-authentication"])  # New JWT admin auth
app.include_router(payment_router)
app.include_router(notifications_router)

# Mount static files (attached_assets) only when Supabase Storage is not configured
assets_path = None

if not settings.supabase_storage_enabled:
    fly_volume_path = Path("/app/attached_assets")
    local_dev_path = parent_dir.parent / "attached_assets"

    is_deployed = (
        os.getenv('FLY_APP_NAME') is not None or 
        Path('/.dockerenv').exists() or
        fly_volume_path.exists()
    )

    if is_deployed and fly_volume_path.exists():
        assets_path = fly_volume_path
    elif local_dev_path.exists():
        assets_path = local_dev_path
    else:
        assets_path = local_dev_path

    if assets_path and assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")
        print(f"[STARTUP] Mounted static assets from: {assets_path}")
    else:
        print(f"[STARTUP] WARNING: Assets directory not found at {assets_path}")
else:
    print("[STARTUP] Supabase Storage detected – skipping local /assets mount")

# Mount client build files (for production) - LAST priority
# Resolution order:
# 1) Explicit path via CLIENT_STATIC_DIR (for container deployments)
# 2) Local bundled directory at backend/client_static
# 3) Repo-level dist/public or dist
client_static_env = os.getenv("CLIENT_STATIC_DIR")
backend_local_static = Path(__file__).parent / "client_static"
client_dist_public = parent_dir / "dist" / "public"
client_dist_root = parent_dir / "dist"

if client_static_env and Path(client_static_env).exists():
    app.mount("/", StaticFiles(directory=client_static_env, html=True), name="client")
elif backend_local_static.exists():
    app.mount("/", StaticFiles(directory=str(backend_local_static), html=True), name="client")
elif client_dist_public.exists():
    app.mount("/", StaticFiles(directory=str(client_dist_public), html=True), name="client")
elif client_dist_root.exists():
    app.mount("/", StaticFiles(directory=str(client_dist_root), html=True), name="client")

@app.on_event("startup")
async def startup_event():
    """Initialize database and conditionally sync discovered characters on startup"""
    from config import settings
    import logging
    from tasks.scheduled_tasks import start_scheduler

    # Ensure default assets exist (prevents 404 for seeded defaults)
    if assets_path is not None:
        try:
            chars_dir = assets_path / "characters_img"
            users_dir = assets_path / "user_characters_img"
            galleries_dir = assets_path / "character_galleries"
            chars_dir.mkdir(parents=True, exist_ok=True)
            users_dir.mkdir(parents=True, exist_ok=True)
            galleries_dir.mkdir(parents=True, exist_ok=True)

            # Minimal 1x1 JPEG placeholder for Elara.jpeg if missing
            elara_path = chars_dir / "Elara.jpeg"
            if not elara_path.exists():
                placeholder_jpeg_b64 = (
                    b"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAdEAACAQQDAAAAAAAAAAAAAAABAgMABAURIVFx/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABYRAAMAAAAAAAAAAAAAAAAAAAABIf/aAAwDAQACEQMRAD8Aq0n5u8q5XQ2wVRk8iJuN3wV4XWkYk2H5m8a2m8Y0nVU8oXv1o2n3k0mWJ9LZ6bqgY1b0oE2P/Z"
                )
                try:
                    data = base64.b64decode(placeholder_jpeg_b64)
                    with open(elara_path, "wb") as f:
                        f.write(data)
                except Exception:
                    pass
        except Exception:
            # Non-fatal if asset initialization fails
            pass

    await init_db()

    # Start background scheduler for token cleanup and other recurring tasks
    try:
        start_scheduler()
        logger = logging.getLogger("startup")
        logger.info("✅ Background scheduler initialized")
    except Exception as e:
        logger = logging.getLogger("startup")
        logger.error(f"❌ Failed to start background scheduler: {e}")
        # Don't fail startup if scheduler fails

    # Only sync if explicitly enabled via config
    if settings.enable_startup_character_sync:
        # Auto-sync discovered character files to database
        try:
            from database import get_db
            # Hardcoded character sync removed in Issue #129
            # All characters are now user-created through the UI
            logger = logging.getLogger("startup")
            logger.info("Character sync skipped (hardcoded characters removed in Issue #129)")

        except Exception as e:
            logger.error(f"Failed during startup: {e}")
            # Don't fail startup if character sync fails
    else:
        logger = logging.getLogger("startup")
        logger.info("Character auto-discovery disabled via config - skipping startup sync")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    from tasks.scheduled_tasks import stop_scheduler
    import logging

    logger = logging.getLogger("shutdown")
    logger.info("Shutting down application...")

    try:
        stop_scheduler()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": "2025-09-19"}

@app.get("/api/debug/routes")
async def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": getattr(route, 'name', 'unknown')
            })
    return {"routes": routes}

if __name__ == "__main__":
    import uvicorn
    # Use port 8000 for Python backend (port 5000 conflicts with AirPlay on macOS)
    uvicorn.run(
        "main:app",
        host="localhost", 
        port=8000,
        reload=False,  # Disable reload to prevent duplicate processes
        log_level="info"
    )
