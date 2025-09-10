from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import our routes
from routes.characters import router as characters_router
from routes.chats import router as chats_router
from routes.admin import router as new_admin_router  # New AI admin routes
from admin.routes import router as admin_router
from auth.routes import router as auth_router
from payment.routes import router as payment_router
from routes.user_preferences import router as preferences_router
from notifications_routes import router as notifications_router
from database import init_db
from config import settings

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
if settings.allowed_origins:
    allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5000",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
parent_dir = Path(__file__).parent.parent

# Include API routes FIRST (highest priority for authentication)
app.include_router(characters_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(new_admin_router, prefix="/api")  # New AI admin routes
app.include_router(preferences_router, prefix="/api")  # User preferences routes
app.include_router(admin_router, prefix="/api/admin")  # Legacy admin routes
app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(payment_router)
app.include_router(notifications_router)

# Mount static files (attached_assets)
assets_path = parent_dir / "attached_assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

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
    
    await init_db()
    
    # Only sync if explicitly enabled via config
    if settings.enable_startup_character_sync:
        # Auto-sync discovered character files to database
        try:
            from database import get_db
            from services.character_service import CharacterService
            
            logger = logging.getLogger("startup")
            logger.info("Starting character auto-discovery sync...")
            
            # Get database session
            db = next(get_db())
            service = CharacterService(db)
            
            # Sync all discovered characters
            sync_results = await service.sync_all_discovered_characters()
            
            logger.info(f"Character sync completed: {sync_results['discovered']} discovered, "
                       f"{len(sync_results['created'])} created, {len(sync_results['updated'])} updated, "
                       f"{len(sync_results['errors'])} errors")
                       
            if sync_results['errors']:
                logger.warning(f"Character sync errors: {sync_results['errors']}")
                
        except Exception as e:
            logger.error(f"Failed to sync characters on startup: {e}")
            # Don't fail startup if character sync fails
    else:
        logger = logging.getLogger("startup")
        logger.info("Character auto-discovery disabled via config - skipping startup sync")

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

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
