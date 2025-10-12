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

### Authentication
- `GET /api/auth/me` - Get current authenticated user (Supabase JWT required)
- `GET /api/auth/me/stats` - Retrieve usage statistics for the authenticated user
- `GET /api/auth/check-username` - Check username availability
- `PUT /api/auth/profile` - Update profile details and avatar
- `POST /api/auth/logout` - Logout (Supabase manages session state)

### Characters  
- `GET /api/characters` - List all characters
- `GET /api/characters/{id}` - Get specific character

### Chats
- `GET /api/chats` - List all chats (with character data)
- `POST /api/chats` - Create new chat
- `GET /api/chats/{id}` - Get specific chat
- `GET /api/chats/{id}/messages` - Get chat messages
- `POST /api/chats/{id}/messages` - Add message to chat
- `POST /api/chats/{id}/generate` - Generate AI response (requires 1 token)
- `DELETE /api/chats` - Clear all chat history

### Payment System
- `POST /api/payment/create-payment-intent` - Create Stripe payment intent
- `POST /api/payment/webhook` - Handle Stripe webhook events  
- `GET /api/payment/user/tokens` - Get user's token balance
- `GET /api/payment/pricing-tiers` - Get available token packages
- `GET /api/payment/user/transactions` - Get payment history

### Admin Panel
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/characters` - Get all characters (including private)
- `POST /api/admin/characters` - Create new character
- `PUT /api/admin/characters/{id}` - Update character
- `DELETE /api/admin/characters/{id}` - Delete character
- `GET /api/admin/users` - Get all users
- `GET /api/admin/stats` - Get admin statistics

## 🏗️ Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and settings
├── database.py          # Database setup and connection
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic schemas for API
├── gemini_service.py    # Gemini AI integration
├── admin/               # Admin panel routes and logic
│   └── routes.py        # Admin API endpoints
├── auth/                # Authentication system
│   ├── supabase_auth.py  # Supabase token verification helpers
│   └── routes.py        # Auth API endpoints
├── payment/             # Payment and token system
│   ├── stripe_service.py # Stripe payment integration
│   ├── token_service.py  # Token management
│   └── routes.py        # Payment API endpoints
├── routes/              # Main API routes (organized by feature)
│   ├── characters.py    # Character endpoints
│   └── chats.py         # Chat endpoints
├── services/            # Business logic layer
│   ├── character_service.py # Character operations
│   ├── chat_service.py     # Chat operations
│   ├── message_service.py  # Message operations
│   └── ai_service.py       # AI integration
├── prompts/             # Character prompts and templates
│   ├── characters/      # Character-specific prompts
│   ├── character_templates.py # Response templates
│   └── generic_few_shots.json # Generic conversation examples
├── utils/               # Utility functions
│   ├── character_utils.py # Character data transformation
│   └── character_prompt_enhancer.py # AI prompt enhancement
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

## 🔑 Environment Variables

### Required
- `GEMINI_API_KEY` - Your Google Gemini API key (required)
- `SECRET_KEY` - JWT secret key for authentication (required)
- `STRIPE_SECRET_KEY` - Stripe secret key for payment processing (required)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret for payment validation (required)

### Optional
- `DATABASE_URL` - Database connection string (defaults to SQLite)
- `SUPABASE_URL` - Supabase project URL for storage/auth
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for JWT verification)
- `SUPABASE_ANON_KEY` - Supabase public anon key (optional helper)
- `SUPABASE_JWT_SECRET` - Supabase JWT secret used for access token verification
- `SUPABASE_STORAGE_BUCKET` - Supabase storage bucket name for uploads
- `ADMIN_PASSWORD` - Admin panel password (defaults to "admin123")
- `DEBUG` - Enable debug mode (default: true)

## 🏛️ Architecture Overview

### Service Layer Pattern
The backend implements a clean service layer architecture:

- **Routes**: Handle HTTP requests/responses and authentication
- **Services**: Contain business logic and data validation
- **Models**: Define database schema using SQLAlchemy
- **Schemas**: Pydantic models for API request/response validation

### Key Services
- **CharacterService**: Character CRUD operations with validation
- **ChatService**: Chat creation, management, and AI response generation
- **MessageService**: Message handling and storage
- **AuthService**: User authentication and JWT token management
- **TokenService**: Payment token management and transaction tracking

## 🗄️ Database

The backend uses SQLite by default for easy setup. To use PostgreSQL:

1. Install PostgreSQL
2. Create a database
3. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost/dbname
   ```

### Key Tables
- `users` - User accounts and preferences
- `characters` - AI characters with personality traits
- `chats` - Chat sessions between users and characters
- `chat_messages` - Individual messages within chats
- `user_tokens` - Token balances for payment system
- `token_transactions` - Payment and usage history

## 🧪 Testing

The server includes a health check endpoint:
```bash
curl http://localhost:8000/health
```

To test the API:
```bash
# Get all characters  
curl http://localhost:8000/api/characters
```

## 🔄 Integration with Frontend

This backend is designed to work with your existing React frontend. Update your frontend's API base URL to point to `http://localhost:8000` instead of the Node.js server.

The API endpoints match your existing Node.js backend, so no frontend changes should be needed.
