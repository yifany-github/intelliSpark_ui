from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path

# Import our routes
from routes import router
from admin.routes import router as admin_router
from database import init_db

# Create FastAPI app
app = FastAPI(
    title="ProductInsightAI Backend",
    description="AI Role-playing Chat Backend with Gemini",
    version="1.0.0"
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5000", "http://localhost:3000"],  # Add Vite dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (attached_assets)
# Get the parent directory to access attached_assets
parent_dir = Path(__file__).parent.parent
assets_path = parent_dir / "attached_assets"
if assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

# Mount client build files (for production)
client_dist_path = parent_dir / "dist"
if client_dist_path.exists():
    app.mount("/", StaticFiles(directory=str(client_dist_path), html=True), name="client")

# Include API routes
app.include_router(router, prefix="/api")
app.include_router(admin_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "ProductInsightAI Backend is running!", "status": "healthy"}

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    # Use port 8000 for Python backend (port 5000 conflicts with AirPlay on macOS)
    uvicorn.run(
        "main:app",
        host="localhost", 
        port=8000,
        reload=True,
        log_level="info"
    )