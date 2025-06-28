# ProductInsightAI Python Backend

A FastAPI-based backend for the AI role-playing chat application with Gemini AI integration.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Gemini API key
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 3. Run the Server

```bash
# Development server with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --host localhost --port 8000 --reload
```

The API will be available at `http://localhost:8000`

## 📚 API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔧 API Endpoints

### Scenes
- `GET /api/scenes` - List all scenes
- `GET /api/scenes/{id}` - Get specific scene

### Characters  
- `GET /api/characters` - List all characters
- `GET /api/characters/{id}` - Get specific character

### Chats
- `GET /api/chats` - List all chats (with character/scene data)
- `POST /api/chats` - Create new chat
- `GET /api/chats/{id}` - Get specific chat
- `GET /api/chats/{id}/messages` - Get chat messages
- `POST /api/chats/{id}/messages` - Add message to chat
- `POST /api/chats/{id}/generate` - Generate AI response
- `DELETE /api/chats` - Clear all chat history

## 🏗️ Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and settings
├── database.py          # Database setup and connection
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic schemas for API
├── routes.py            # API route definitions
├── gemini_service.py    # Gemini AI integration
├── prompt_service.py    # Dynamic prompt loading
├── prompts/             # Character and scene prompts
│   ├── characters/      # Character-specific prompts
│   └── scenes/          # Scene-specific prompts
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## 🎭 Adding New Characters

1. Create a new file in `prompts/characters/` named `{character_name}.py`
2. Define `PERSONA_PROMPT` and optionally `FEW_SHOT_EXAMPLES`
3. Add the character to the database (or use the API)

Example character prompt:
```python
# prompts/characters/my_character.py
PERSONA_PROMPT = """You are My Character, a brave knight...
[Character description and behavior]"""

FEW_SHOT_EXAMPLES = """User: Hello
My Character: *bows respectfully* Greetings, good traveler!"""
```

## 🌍 Adding New Scenes

1. Create a new file in `prompts/scenes/` named `{scene_name}.py`
2. Define `SCENE_PROMPT` with the scene description
3. Add the scene to the database (or use the API)

Example scene prompt:
```python
# prompts/scenes/my_scene.py
SCENE_PROMPT = """You are in My Scene, a mystical forest...
[Scene description and atmosphere]"""
```

## 🔑 Environment Variables

- `GEMINI_API_KEY` - Your Google Gemini API key (required)
- `DATABASE_URL` - Database connection string (optional, defaults to SQLite)
- `DEBUG` - Enable debug mode (optional, default: true)

## 🗄️ Database

The backend uses SQLite by default for easy setup. To use PostgreSQL:

1. Install PostgreSQL
2. Create a database
3. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost/dbname
   ```

## 🧪 Testing

The server includes a health check endpoint:
```bash
curl http://localhost:8000/health
```

To test the API:
```bash
# Get all scenes
curl http://localhost:8000/api/scenes

# Get all characters  
curl http://localhost:8000/api/characters
```

## 🔄 Integration with Frontend

This backend is designed to work with your existing React frontend. Update your frontend's API base URL to point to `http://localhost:8000` instead of the Node.js server.

The API endpoints match your existing Node.js backend, so no frontend changes should be needed.