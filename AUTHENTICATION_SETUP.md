# Firebase Authentication Setup Guide

This document provides detailed instructions for setting up Firebase authentication for the ProductInsightAI application.

## Overview

The application now supports email-based authentication with Google OAuth social login using Firebase Auth. This replaces the previous username-based system while maintaining backward compatibility.

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "intelli-ui" or "productinsight-ai")
4. Choose whether to enable Google Analytics
5. Click "Create project"

### 2. Enable Authentication

1. In your Firebase project dashboard, click **Authentication** in the left sidebar
2. Click **Get started**
3. Go to the **Sign-in method** tab
4. Enable the following providers:

#### Email/Password
1. Click on **Email/Password**
2. Toggle **Enable** to ON
3. Click **Save**

#### Google OAuth
1. Click on **Google**
2. Toggle **Enable** to ON
3. Enter your support email address
4. Click **Save**

### 3. Get Firebase Configuration

1. Go to **Project Settings** (gear icon in sidebar)
2. Scroll down to "Your apps" section
3. Click the **Web app icon** (`</>`)
4. Register your app with a name (e.g., "ProductInsightAI Web")
5. Copy the Firebase configuration object

### 4. Configure Environment Variables

#### Frontend Configuration (/.env)
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

#### Backend Configuration (/backend/.env)
```bash
FIREBASE_API_KEY=AIzaSy...
SECRET_KEY=your-jwt-secret-key
GEMINI_API_KEY=your-gemini-api-key
DATABASE_URL=sqlite:///./roleplay_chat.db
```

## Authentication Flow

### Email/Password Authentication
1. User enters email and password
2. Frontend validates with Firebase Auth
3. Firebase returns ID token
4. Frontend sends token to backend `/api/auth/login/firebase`
5. Backend verifies token with Firebase REST API
6. Backend creates/retrieves user and returns JWT token
7. Frontend stores JWT for API requests

### Google OAuth Authentication
1. User clicks "Continue with Google"
2. Firebase opens Google OAuth popup
3. User authenticates with Google
4. Firebase returns ID token with user info
5. Same flow as email auth from step 4

### Legacy Username Support
- Existing users can still login with username via `/api/auth/login/legacy`
- Maintains backward compatibility

## Database Schema

The User model now includes:
```python
class User(Base):
    id = Column(Integer, primary_key=True)
    username = Column(String(255), unique=True, nullable=False)  # Legacy
    email = Column(String(255), unique=True, nullable=True)      # New primary identifier
    password = Column(String(255), nullable=False)              # Hashed (empty for OAuth)
    provider = Column(String(50), default='email')              # 'email', 'google', 'apple'
    firebase_uid = Column(String(255), unique=True, nullable=True)  # Firebase user ID
    # ... other user preferences
```

## API Endpoints

### Authentication Endpoints
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/login/firebase` - Login with Firebase OAuth token
- `POST /api/auth/login/legacy` - Legacy username login (backward compatibility)
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout (client-side)

## Security Considerations

### Firebase API Keys Are Public
- Firebase API keys are designed to be public identifiers
- Security comes from Firebase Security Rules, not hiding keys
- Frontend Firebase config can be safely committed to git

### Backend Security
- Firebase tokens are verified using Firebase REST API
- JWT tokens are generated for backend API authentication
- Database queries use SQLAlchemy ORM to prevent injection

## Troubleshooting

### Common Issues

#### "Firebase not configured" Error
- Check that all `VITE_FIREBASE_*` variables are in root `.env` file
- Verify Vite `envDir` configuration points to project root
- Restart frontend dev server after changing `.env`

#### "Invalid API key" Error
- Verify Firebase API key is correct
- Check that Authentication is enabled in Firebase Console
- Ensure Email/Password and Google providers are enabled

#### Database Schema Errors
- Delete `backend/roleplay_chat.db` to reset database
- Restart backend server to recreate with new schema

## Migration from Username-Based Auth

### For Existing Users
- Legacy `/api/auth/login/legacy` endpoint maintains compatibility
- Users can continue using username/password
- Optional: Provide migration flow to link email to existing accounts

### For New Development
- All new registrations use email-based authentication
- Username is auto-generated from email (e.g., user@example.com → user)
- Firebase OAuth integration for social login