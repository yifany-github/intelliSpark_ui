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

### Backend (server/)
- **Runtime**: Node.js with Express
- **API**: RESTful endpoints in `server/routes.ts`
- **AI Services**: OpenAI/Gemini integration in `server/services/`
- **Database**: PostgreSQL with Drizzle ORM (optional, has in-memory fallback)
- **Storage**: File-based storage system in `server/storage.ts`

### Key Architecture Patterns
- **Context Providers**: Global state management for roleplay settings, language, and active selections
- **Schema Validation**: Zod schemas in `shared/schema.ts` for type-safe API communication
- **Service Layer**: AI providers abstracted in `server/services/` directory
- **Asset Management**: Static assets served from `attached_assets/` directory

## API Endpoints

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
- `POST /api/chats/:id/generate` - Generate AI response
- `DELETE /api/chats` - Clear all chat history

## Environment Setup

Required environment variables:
```bash
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=your_postgresql_connection_string  # Optional
```

## Database Schema

The app uses Drizzle ORM with PostgreSQL. Key tables:
- `users` - User accounts and preferences
- `scenes` - Roleplay scenarios with images and metadata
- `characters` - AI characters with personality traits and backstories  
- `chats` - Chat sessions linking users, scenes, and characters
- `chat_messages` - Individual messages within chats

Schema is defined in `shared/schema.ts` and migrations managed via `drizzle.config.ts`.

## Key Components

### Context Management
- `RolePlayContext` - Manages active scene/character selection, user preferences (NSFW level, temperature, etc.)
- `LanguageContext` - Handles internationalization

### Page Structure
- App uses tab-based navigation with routes for scenes, characters, chats, and profile
- Onboarding flow for first-time users
- Mobile-responsive design with bottom tab navigation

### AI Integration
- Supports both OpenAI and Gemini (currently using Gemini as per routes.ts:7)
- Character personalities and scene context are injected into AI prompts
- Conversation history maintained for context continuity

## Development Notes

- Static assets (character images, scene images) are served from `/assets` endpoint
- Development server runs on port 5000 for both API and client
- TypeScript strict mode enabled
- Uses ESM modules throughout (type: "module" in package.json)
- Vite for fast development builds and HMR