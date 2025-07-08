# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based AI role-playing chat application called "ProductInsightAI" (Chinese name). Users can select scenes and characters to engage in immersive AI conversations. The app uses OpenAI GPT-4/Gemini for AI responses and features a modern UI built with React, TypeScript, and Tailwind CSS.

## Development Commands

```bash
# Start development server (client + server)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# TypeScript type checking
npm run check

# Database migrations (if using database)
npm run db:push
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
- **Authentication**: Email-based auth with Firebase OAuth integration
- **AI Services**: Gemini AI integration in `backend/gemini_service.py`
- **Database**: SQLAlchemy with SQLite (development) / PostgreSQL (production)
- **Auth System**: JWT tokens with Firebase social login support

### Key Architecture Patterns
- **Context Providers**: Global state management for roleplay settings, language, and authentication
- **Schema Validation**: Pydantic schemas in `backend/schemas.py` for type-safe API communication
- **Service Layer**: AI providers and auth services in `backend/` directory
- **Asset Management**: Static assets served from `attached_assets/` directory
- **Authentication Flow**: Firebase frontend auth → JWT backend tokens → SQLAlchemy user management

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password  
- `POST /api/auth/login/firebase` - Login with Firebase OAuth token
- `POST /api/auth/login/legacy` - Legacy username-based login (backward compatibility)
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/logout` - Logout (client-side token removal)

### Scenes
- `GET /api/scenes` - List all scenes
- `GET /api/scenes/:id` - Get specific scene

### Characters  
- `GET /api/characters` - List all characters
- `GET /api/characters/:id` - Get specific character

### Chats
- `GET /api/chats` - List all chats (enriched with character/scene data)
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
- `firebase_uid` - Firebase user ID for OAuth users
- `nsfw_level`, `temperature`, etc. - User preferences

### Other Tables
- `scenes` - Roleplay scenarios with images and metadata
- `characters` - AI characters with personality traits and backstories  
- `chats` - Chat sessions linking users, scenes, and characters
- `chat_messages` - Individual messages within chats
- `user_tokens` - User token balances for payment system
- `token_transactions` - Payment and usage transaction history

Schema is defined in `backend/models.py`. For schema changes, delete `roleplay_chat.db` and restart the backend to recreate with new schema.

## Key Components

### Context Management
- `AuthContext` - Manages user authentication state, login/logout, Firebase integration
- `RolePlayContext` - Manages active scene/character selection, user preferences (NSFW level, temperature, etc.)
- `LanguageContext` - Handles internationalization

### Authentication System
- **Frontend**: Firebase Auth for Google OAuth, custom email/password forms
- **Backend**: FastAPI with JWT tokens, Firebase token verification
- **Database**: SQLAlchemy user management with email-based identification
- **Legacy Support**: Backward compatible username-based login endpoint

### Page Structure
- App uses tab-based navigation with routes for scenes, characters, chats, profile, and payment
- Email-based authentication with social login options
- AuthModal popup for login during chat interactions
- Mobile-responsive design with bottom tab navigation
- Token-based payment system with Stripe integration

### AI Integration
- Uses Gemini AI for character conversations
- Character personalities and scene context are injected into AI prompts
- Conversation history maintained for context continuity
- Token-based usage: 1 token deducted per AI message generation

## Development Notes

- **Frontend**: Vite dev server with HMR, TypeScript strict mode
- **Backend**: FastAPI with auto-reload, SQLAlchemy ORM
- **Static Assets**: Served from `/assets` endpoint  
- **Database**: SQLite for development (auto-created), PostgreSQL for production
- **Authentication**: Email-based with Firebase OAuth integration
- **Environment**: Separate .env files for frontend (Vite) and backend (FastAPI)
- **Schema Changes**: Delete `backend/roleplay_chat.db` to reset database schema
