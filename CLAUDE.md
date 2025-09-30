# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based AI role-playing chat application called "ProductInsightAI" (Chinese name). Users can select characters to engage in immersive AI conversations. The app uses Gemini AI for character responses and features a modern UI built with React, TypeScript, and Tailwind CSS.

## Development Commands

```bash
# Start development server (frontend only)
npm run dev

# Build for production
npm run build

# Build for CI (skips TypeScript checking)
npm run build:ci

# Preview production build
npm run preview

# TypeScript type checking
npm run check

# Backend specific commands
cd backend
pip install -r requirements.txt      # Install Python dependencies first
python main.py                       # Start backend server
python -m uvicorn main:app --reload  # Alternative backend start (with auto-reload)
```

## Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: React Context (RolePlayContext, AuthContext, LanguageContext, FavoritesContext, NavigationContext, AgeVerificationContext)
- **UI Components**: Radix UI + shadcn/ui components in `client/src/components/ui/`
- **Styling**: Tailwind CSS with custom animations
- **Data Fetching**: TanStack Query (@tanstack/react-query)
- **Payment Integration**: Stripe (@stripe/stripe-js, @stripe/react-stripe-js)
- **Error Monitoring**: Sentry (@sentry/react)

### Backend (backend/)
- **Runtime**: Python 3.8+ with FastAPI
- **API**: RESTful endpoints organized in `backend/routes/` directory
- **Authentication**: Email-based auth with Firebase OAuth integration (JWT tokens)
- **AI Services**: Multiple AI providers via service layer pattern
  - Gemini AI integration in `backend/services/gemini_service_new.py`
  - Grok AI support in `backend/services/grok_service.py`
  - AI Model Manager in `backend/services/ai_model_manager.py`
- **Database**: SQLAlchemy with SQLite (development) / PostgreSQL (production)
- **Rate Limiting**: slowapi with Redis support (optional)
- **Payment Processing**: Stripe integration in `backend/payment/`
- **File Upload**: Secure file validation and handling with anti-XSS headers

### Key Architecture Patterns
- **Context Providers**: Global state management for roleplay settings, language, and authentication
- **Schema Validation**: Pydantic schemas in `backend/schemas.py` for type-safe API communication
- **Service Layer Pattern**: Business logic separated from routes
  - `backend/services/` - Core business logic (character, chat, message, AI services)
  - `backend/routes/` - HTTP endpoint handlers
  - `backend/auth/` - Authentication services and routes
  - `backend/payment/` - Payment and token management services
- **Asset Management**: Static assets served from `attached_assets/` directory
  - Character images: `attached_assets/characters_img/`
  - User-uploaded images: `attached_assets/user_characters_img/`
  - Character galleries: `attached_assets/character_galleries/`
- **Authentication Flow**: Firebase frontend auth → JWT backend tokens → SQLAlchemy user management
- **Security Headers**: Anti-XSS headers for user-uploaded files in `/assets/user_characters_img/`
- **Rate Limiting**: slowapi integration with optional Redis backend

### Character Enhancement System
- **Hardcoded Characters**: Pre-built prompts from `backend/prompts/characters/艾莉丝.py` (260+ examples, uses Gemini cache)
- **User-Created Characters**: Dynamic prompts via `backend/utils/character_prompt_enhancer.py` (140 generic examples, direct API calls)
- **Few-Shot Examples**: `backend/prompts/generic_few_shots.json` provides 140 conversation examples for user characters
- **Cache Strategy**: Hardcoded characters use Gemini cache for performance; user characters fall back to direct API calls when cache creation fails
- **Template System**: `backend/prompts/character_templates.py` provides Chinese-language templates for natural character responses
- **Anti-Generic**: System prevents "How can I help?" responses through explicit instructions and personality-focused prompts

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password  
- `POST /api/auth/login/firebase` - Login with Firebase OAuth token
- `POST /api/auth/login/legacy` - Legacy username-based login (backward compatibility)
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/logout` - Logout (client-side token removal)


### Characters  
- `GET /api/characters` - List all characters
- `GET /api/characters/:id` - Get specific character

### Chats
- `GET /api/chats` - List all chats (enriched with character data)
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get specific chat
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Add message to chat
- `POST /api/chats/:id/generate` - Generate AI response (requires 1 token)
- `DELETE /api/chats` - Clear all chat history

### Payment System
- `POST /api/payment/create-payment-intent` - Create Stripe payment intent for token purchase
- `POST /api/payment/webhook` - Handle Stripe webhook events  
- `GET /api/payment/user/tokens` - Get user's current token balance
- `GET /api/payment/pricing-tiers` - Get available token packages
- `GET /api/payment/user/transactions` - Get user's payment history

**Token Economy:**
- Each AI message generation costs 1 token
- Pricing tiers: Starter (100 tokens/$5), Standard (500 tokens/$20), Premium (1500 tokens/$50)
- Tokens never expire and are tied to user accounts

## Environment Setup

### Frontend Environment (/.env)
```bash
# Firebase Configuration (required for authentication)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id

# Stripe Configuration (required for payment processing)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

### Backend Environment (/backend/.env)
```bash
# Database
DATABASE_URL=sqlite:///./roleplay_chat.db  # SQLite for development
# DATABASE_URL=postgresql://user:pass@localhost/dbname  # PostgreSQL for production

# Authentication
SECRET_KEY=your-jwt-secret-key
FIREBASE_API_KEY=your-firebase-api-key  # For token verification

# AI Services
GEMINI_API_KEY=your-gemini-api-key
GROK_API_KEY=your-grok-api-key  # Optional, for Grok AI model support

# Payment Processing (REQUIRED)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional Configuration
REDIS_URL=redis://localhost:6379  # Optional, for rate limiting with Redis
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000  # CORS origins (comma-separated)
ALLOWED_ORIGIN_REGEX=  # Optional regex pattern for allowed origins
ENABLE_STARTUP_CHARACTER_SYNC=false  # Auto-sync character files on startup (default: false)
DEBUG=true  # Enable debug mode
```

## Database Schema

The app uses SQLAlchemy ORM with SQLite (development) or PostgreSQL (production). Key tables:

### Users Table
- `id` - Primary key
- `username` - Unique username (legacy support)
- `email` - Email address (primary identifier for new auth)
- `password` - Hashed password (empty for OAuth users)
- `provider` - Authentication provider ('email', 'google', 'apple')
- `firebase_uid` - Firebase user ID for OAuth users
- `nsfw_level`, `temperature`, etc. - User preferences

### Other Tables
- `characters` - AI characters with personality traits and backstories
  - Includes gallery support (`gallery_enabled`, `gallery_primary_image`, `gallery_images_count`)
  - Analytics fields (`view_count`, `like_count`, `chat_count`, `trending_score`)
  - Soft delete support (`is_deleted`, `deleted_at`, `deleted_by`, `delete_reason`)
  - Age and NSFW level constraints (age: 1-200, nsfw_level: 0-3)
- `chats` - Chat sessions linking users and characters
  - Uses UUID for privacy-preserving URLs
- `chat_messages` - Individual messages within chats
  - 10KB content limit for DoS protection
  - Uses both integer ID and UUID
- `user_tokens` - User token balances for payment system
- `token_transactions` - Payment and usage transaction history
- `notifications` - User notifications system
- `notification_templates` - Reusable notification templates
- `character_gallery_images` - Multi-image gallery system for characters

Schema is defined in `backend/models.py`. For schema changes, delete `roleplay_chat.db` and restart the backend to recreate with new schema.

## Key Components

### Context Management
- `AuthContext` (`client/src/contexts/AuthContext.tsx`) - Manages user authentication state, login/logout, Firebase integration, JWT token management
- `RolePlayContext` (`client/src/contexts/RolePlayContext.tsx`) - Manages active character selection, chat state, auth modal for guest users
- `LanguageContext` - Handles internationalization
- `FavoritesContext` - Manages user's favorite characters
- `NavigationContext` - Handles navigation state
- `AgeVerificationContext` - Age gate for adult content

### Authentication System
- **Frontend**: Firebase Auth for Google OAuth, custom email/password forms
- **Backend**: FastAPI with JWT tokens, Firebase token verification
- **Database**: SQLAlchemy user management with email-based identification
- **Legacy Support**: Backward compatible username-based login endpoint

### Page Structure
- App uses tab-based navigation with routes for characters, chats, profile, and payment
- Email-based authentication with social login options
- AuthModal popup for login during chat interactions
- Mobile-responsive design with bottom tab navigation
- Token-based payment system with Stripe integration

### AI Integration
- Uses Gemini AI for character conversations
- **Character Prompt Enhancement**: User-created characters get enhanced prompts with personality traits, backstory, and few-shot examples
- **Dual Cache Strategy**: Hardcoded characters (like 艾莉丝) use Gemini cache; user characters use direct API calls for flexibility
- **Response Quality**: System achieves ~80% quality parity between hardcoded and user-created characters
- Conversation history maintained for context continuity
- Token-based usage: 1 token deducted per AI message generation

## Error Handling Patterns

### Frontend Error Handling
- **Error Boundaries**: React Error Boundaries in `client/src/components/error/ErrorBoundary.tsx`
- **Query Error Handling**: TanStack Query error states with consistent UI patterns
- **Toast Notifications**: Global error notifications using Radix UI toast system
- **Loading States**: Skeleton loading components and loading indicators
- **Form Validation**: Client-side validation with proper error feedback

### Backend Error Handling
- **HTTP Status Codes**: Proper REST API error responses (400, 401, 403, 404, 500)
- **Pydantic Validation**: Request/response validation with detailed error messages
- **Database Errors**: SQLAlchemy error handling with user-friendly messages
- **Authentication Errors**: JWT and Firebase token validation error handling
- **AI Service Errors**: Gemini API error handling with fallback responses

### Error Handling Components
- `ErrorBoundary.tsx` - Catches React component errors
- `ErrorFallback.tsx` - Fallback UI for error states
- `toast.tsx` - Global error notifications
- `alert.tsx` - Local error messages
- `queryClient.ts` - Centralized API error handling

## Development Notes

- **Frontend**: Vite dev server with HMR, TypeScript strict mode
- **Backend**: FastAPI with auto-reload, SQLAlchemy ORM
- **Static Assets**: Served from `/assets` endpoint
- **Database**: SQLite for development (auto-created), PostgreSQL for production
- **Authentication**: Email-based with Firebase OAuth integration
- **Environment**: Separate .env files for frontend (Vite) and backend (FastAPI)
- **Schema Changes**: Delete `backend/roleplay_chat.db` to reset database schema
- **Character Development**: User-created characters automatically get enhanced prompts via `CharacterPromptEnhancer`
- **Few-Shot Examples**: Generic conversation examples in `backend/prompts/generic_few_shots.json` can be customized
- **Cache Debugging**: Check logs for "Cache creation" messages to debug Gemini cache issues
- **Error Handling**: Comprehensive error boundaries and user-friendly error messages
- **Security**:
  - Anti-XSS headers for user-uploaded files
  - JWT token expiration validation on frontend and backend
  - CORS configuration with wildcard pattern support
  - Rate limiting with slowapi (optional Redis backend)
  - 10KB message content limit for DoS protection
  - UUID-based chat URLs for privacy

## Database Migrations

The project uses custom migration scripts in `backend/migrations/` directory:

```bash
# Database migration files (run in sequence):
001_add_message_content_limit.py    # Adds content length limits
002_add_uuid_fields.py              # Adds UUID fields to tables
003_populate_uuid_fields.py         # Populates existing UUID fields
004_add_character_gallery.py        # Adds character gallery features
005_add_character_analytics.py      # Adds analytics tracking
006_add_age_nsfw_level.py          # Adds age restrictions and NSFW levels
007_soft_delete_characters.py      # Implements soft delete for characters
```

When schema changes occur, check if a migration exists in the `backend/migrations/` directory before manually deleting the database.

## Important Routes and Pages

### Frontend Routes (client/src/App.tsx)
- `/` - Home page (redirects to characters)
- `/characters` - Browse all characters
- `/favorites` - User's favorited characters
- `/discover` - Discover new characters
- `/create-character` - Create custom character (auth required)
- `/my-characters` - User's created characters (auth required)
- `/character/:id/edit` - Edit character (auth required)
- `/chat-preview` - Preview chat without auth
- `/chats` - List of user's chats (auth required)
- `/chats/:id` or `/chat/:id` - Active chat page (auth required)
- `/profile` - User profile (auth required)
- `/settings` - User settings (auth required)
- `/payment` - Token purchase page (auth required)
- `/notifications` - User notifications (auth required)
- `/admin` - Admin panel
- `/login`, `/register` - Authentication pages
- `/faq`, `/about` - Info pages

### Backend API Routes (backend/main.py)
- **Characters**: `backend/routes/characters.py`
- **Chats**: `backend/routes/chats.py`
- **Auth**: `backend/auth/routes.py`
- **Payment**: `backend/payment/routes.py`
- **Admin**: `backend/routes/admin.py` and `backend/admin/routes.py`
- **User Preferences**: `backend/routes/user_preferences.py`
- **Notifications**: `backend/notifications_routes.py`

## Python Dependencies (backend/requirements.txt)

Key dependencies:
- `fastapi==0.116.1` - Web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `sqlalchemy==2.0.23` - ORM
- `psycopg2-binary==2.9.9` - PostgreSQL adapter
- `google-genai>=1.26.0` - Gemini AI SDK
- `openai>=1.0.0` - OpenAI/Grok API client
- `python-jose[cryptography]==3.3.0` - JWT tokens
- `passlib[bcrypt]==1.7.4` - Password hashing
- `firebase-admin==6.4.0` - Firebase authentication
- `stripe==7.10.0` - Payment processing
- `slowapi==0.1.9` - Rate limiting
- `Pillow==10.0.0` - Image processing
- `python-magic==0.4.27` - File type detection
- `bleach==6.1.0` - HTML sanitization

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
