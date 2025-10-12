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
python main.py                       # Start backend server
python -m uvicorn main:app --reload  # Alternative backend start (with auto-reload)
```

## Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: React Context (RolePlayContext, LanguageContext)
- **UI Components**: Radix UI + shadcn/ui components in `client/src/components/ui/`
- **Styling**: Tailwind CSS with custom animations
- **Data Fetching**: TanStack Query (@tanstack/react-query)

### Backend (backend/)
- **Runtime**: Python with FastAPI
- **API**: RESTful endpoints in `backend/routes.py`
- **Authentication**: Supabase Auth verification for email/password and OAuth providers
- **AI Services**: Gemini AI integration in `backend/gemini_service.py`
- **Database**: SQLAlchemy with SQLite (development) / PostgreSQL (production)
- **Auth System**: Supabase-issued JWT access tokens validated server-side

### Key Architecture Patterns
- **Context Providers**: Global state management for roleplay settings, language, and authentication
- **Schema Validation**: Pydantic schemas in `backend/schemas.py` for type-safe API communication
- **Service Layer**: AI providers and Supabase auth helpers in `backend/` directory
- **Asset Management**: Static assets served from `attached_assets/` directory
- **Authentication Flow**: Supabase client auth → Supabase JWT verification → SQLAlchemy user management

### Character Enhancement System
- **Hardcoded Characters**: Pre-built prompts from `backend/prompts/characters/艾莉丝.py` (260+ examples, uses Gemini cache)
- **User-Created Characters**: Dynamic prompts via `backend/utils/character_prompt_enhancer.py` (140 generic examples, direct API calls)
- **Few-Shot Examples**: `backend/prompts/generic_few_shots.json` provides 140 conversation examples for user characters
- **Cache Strategy**: Hardcoded characters use Gemini cache for performance; user characters fall back to direct API calls when cache creation fails
- **Template System**: `backend/prompts/character_templates.py` provides Chinese-language templates for natural character responses
- **Anti-Generic**: System prevents "How can I help?" responses through explicit instructions and personality-focused prompts

## API Endpoints

### Authentication
- `GET /api/auth/me` - Return the authenticated user's profile (Supabase JWT required)
- `GET /api/auth/me/stats` - Usage statistics for the signed-in user
- `GET /api/auth/check-username` - Validate username availability
- `PUT /api/auth/profile` - Update profile details and avatar
- `POST /api/auth/logout` - Placeholder endpoint (Supabase manages session logout client-side)


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
# Supabase configuration (required for authentication)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
# Optional OAuth redirect override (defaults to current origin)
# VITE_SUPABASE_REDIRECT_URL=http://localhost:5173/auth/callback

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
ADMIN_JWT_SECRET=your-admin-jwt-secret

# Supabase server credentials
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_STORAGE_BUCKET=attachments

# AI Services
GEMINI_API_KEY=your-gemini-api-key

# Payment Processing (REQUIRED)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Database Schema

The app uses SQLAlchemy ORM with SQLite (development) or PostgreSQL (production). Key tables:

### Users Table
- `id` - Primary key
- `username` - Unique username (legacy support)
- `email` - Email address (primary identifier for new auth)
- `password` - Hashed password (empty for OAuth users)
- `provider` - Authentication provider ('email', 'google', 'apple')
- `auth_user_id` - External auth provider user ID (Supabase UID)
- `nsfw_level`, `temperature`, etc. - User preferences

### Other Tables
- `characters` - AI characters with personality traits and backstories  
- `chats` - Chat sessions linking users and characters
- `chat_messages` - Individual messages within chats
- `user_tokens` - User token balances for payment system
- `token_transactions` - Payment and usage transaction history

Schema is defined in `backend/models.py`. For schema changes, delete `roleplay_chat.db` and restart the backend to recreate with new schema.

## Key Components

### Context Management
- `AuthContext` - Manages user authentication state, login/logout, Supabase integration
- `RolePlayContext` - Manages active character selection, user preferences (NSFW level, temperature, etc.)
- `LanguageContext` - Handles internationalization

### Authentication System
- **Frontend**: Supabase Auth handles email/password, Google OAuth, session refresh, and multi-tab sync
- **Backend**: FastAPI verifies Supabase JWT access tokens and syncs user records on demand
- **Database**: SQLAlchemy user management linked to Supabase user IDs and enriched profile data
- **Legacy Support**: Username/password endpoints have been deprecated in favour of Supabase-managed flows

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
- **Authentication Errors**: Supabase JWT validation and session expiry error handling
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
- **Authentication**: Supabase-managed email/password and OAuth integration
- **Environment**: Separate .env files for frontend (Vite) and backend (FastAPI)
- **Schema Changes**: Delete `backend/roleplay_chat.db` to reset database schema
- **Character Development**: User-created characters automatically get enhanced prompts via `CharacterPromptEnhancer`
- **Few-Shot Examples**: Generic conversation examples in `backend/prompts/generic_few_shots.json` can be customized
- **Cache Debugging**: Check logs for "Cache creation" messages to debug Gemini cache issues
- **Error Handling**: Comprehensive error boundaries and user-friendly error messages

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

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
