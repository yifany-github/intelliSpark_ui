# Issue #16: MVP: Email-Based Authentication with Social Login

**Issue Link:** https://github.com/yifany-github/intelliSpark_ui/issues/16

## Current State Analysis

### Backend (FastAPI/Python)
- ✅ Username/password authentication with JWT tokens
- ✅ SQLAlchemy User model with username, password, preferences
- ✅ AuthService with bcrypt hashing and JWT creation
- ✅ API endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`

### Frontend (React/TypeScript)
- ✅ React Context API for auth state management
- ✅ JWT token storage in localStorage
- ✅ Both modal and page-based authentication
- ✅ Public browsing + protected routes
- ✅ Comprehensive error handling

## Implementation Plan

### Phase 1: Backend Changes (Minimal Impact)

#### 1.1 Update User Model (`backend/models.py`)
```python
# Add to User class:
email = Column(String(255), unique=True, nullable=True)  # nullable for existing users
provider = Column(String(50), default='email')  # 'email', 'google', 'apple'
firebase_uid = Column(String(255), unique=True, nullable=True)  # Firebase user ID
```

#### 1.2 Update Authentication Service (`backend/auth/auth_service.py`)
- Add `authenticate_user_by_email()` method
- Add `authenticate_user_by_firebase_token()` method
- Add `create_user_with_email()` method
- Keep existing username methods for backward compatibility

#### 1.3 Update API Schemas (`backend/schemas.py`)
```python
# Change UserLogin/UserRegister:
class UserLogin(BaseSchema):
    email: str  # change from username
    password: str

class UserRegister(BaseSchema):
    email: str  # change from username
    password: str

# Add new schemas:
class FirebaseAuthRequest(BaseSchema):
    firebase_token: str
```

#### 1.4 Update Routes (`backend/routes.py`)
- Add `/api/auth/firebase-login` endpoint
- Modify existing `/api/auth/login` to accept email
- Modify existing `/api/auth/register` to accept email
- Keep backward compatibility for username login

#### 1.5 Database Migration
```sql
-- Add new columns to users table
ALTER TABLE users ADD COLUMN email VARCHAR(255);
ALTER TABLE users ADD COLUMN provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255);

-- Add unique constraints
CREATE UNIQUE INDEX users_email_key ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_firebase_uid_key ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
```

### Phase 2: Frontend Changes (Major Changes)

#### 2.1 Install Firebase SDK
```bash
npm install firebase react-firebase-hooks
```

#### 2.2 Configure Firebase
- Create `client/src/firebase/config.ts`
- Set up Firebase Auth configuration
- Add environment variables for Firebase config

#### 2.3 Replace AuthContext (`client/src/contexts/AuthContext.tsx`)
- Replace custom JWT logic with Firebase Auth hooks
- Keep same interface for components (login, register, logout)
- Integrate Firebase user with backend user data
- Handle token exchange with backend

#### 2.4 Update Login Page (`client/src/pages/auth/login.tsx`)
- Change username input to email input
- Add Google OAuth login button
- Add Apple Sign-In button
- Keep existing form validation

#### 2.5 Update Register Page (`client/src/pages/auth/register.tsx`)
- Change username input to email input
- Add Google OAuth login button
- Add Apple Sign-In button
- Keep existing form validation

#### 2.6 Update AuthModal (`client/src/components/auth/AuthModal.tsx`)
- Change username input to email input
- Add Google OAuth login button
- Add Apple Sign-In button
- Keep existing form validation

#### 2.7 Environment Setup
```bash
# Add to .env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### Phase 3: Testing & Migration

#### 3.1 Test Authentication Flow
- [ ] Email/password registration works
- [ ] Email/password login works
- [ ] JWT token exchange works
- [ ] User data sync between Firebase and backend

#### 3.2 Test Social Login
- [ ] Google OAuth registration works
- [ ] Google OAuth login works
- [ ] Apple Sign-In registration works
- [ ] Apple Sign-In login works
- [ ] Social user data sync works

#### 3.3 Test Backward Compatibility
- [ ] Existing username users can still login
- [ ] Existing users can add email to their account
- [ ] Migration path for existing users

#### 3.4 Migration Strategy
- Existing users keep username login
- Add banner/prompt to encourage email addition
- Gradual migration over time
- No forced migration (backward compatible)

## Implementation Tasks Breakdown

### Backend Tasks
1. **Update User Model** - Add email, provider, firebase_uid columns
2. **Update AuthService** - Add Firebase token validation methods
3. **Update API Schemas** - Change login/register schemas to use email
4. **Update Routes** - Add Firebase login endpoint, modify existing endpoints
5. **Database Migration** - Execute SQL migration for new columns

### Frontend Tasks
1. **Install Firebase** - Add Firebase SDK dependencies
2. **Configure Firebase** - Set up Firebase project and config
3. **Update AuthContext** - Replace custom JWT logic with Firebase Auth
4. **Update Login Page** - Change to email input + add social buttons
5. **Update Register Page** - Change to email input + add social buttons
6. **Update AuthModal** - Change to email input + add social buttons
7. **Environment Setup** - Add Firebase environment variables

### Testing Tasks
1. **Test Email Auth** - Verify email registration/login works
2. **Test Social Login** - Verify Google/Apple login works
3. **Test Backend Integration** - Verify Firebase token exchange works
4. **Test Backward Compatibility** - Verify existing users still work
5. **Test UI/UX** - Verify all UI changes work correctly

## Success Criteria
- [ ] Users can register/login with email
- [ ] Google OAuth login works
- [ ] Apple Sign-In works
- [ ] Existing username users still work
- [ ] No breaking changes to chat functionality
- [ ] Firebase handles all auth state management
- [ ] All existing tests pass
- [ ] New tests added for email auth

## Risk Mitigation
- Keep username authentication as fallback
- Implement feature flags for gradual rollout
- Extensive testing before deployment
- Database backup before migration
- Rollback plan if issues arise

## Timeline Estimate
- Backend changes: 2-3 days
- Frontend changes: 3-4 days
- Testing & refinement: 1-2 days
- Total: 1-2 weeks

## Firebase Setup Requirements
1. Create Firebase project
2. Enable Authentication with Email/Password, Google, Apple
3. Get Firebase config keys
4. Set up OAuth credentials for Google/Apple
5. Configure authorized domains