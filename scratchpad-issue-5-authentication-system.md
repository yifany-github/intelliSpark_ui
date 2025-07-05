# Implementation Plan: Issue #5 - User Authentication System

**GitHub Issue**: [#5 - Implement Basic User Authentication System](https://github.com/yifany-github/intelliSpark_ui/issues/5)

## Problem Analysis

Currently, the application uses hardcoded `user_id = 1` throughout the system (specifically in `backend/routes.py:201`). This needs to be replaced with a proper authentication system that includes:

- User registration and login
- JWT token-based authentication
- Password hashing and verification
- Authentication middleware for protected routes
- Frontend authentication state management

## Current State

### Backend Status
- ✅ **User Model**: Exists in `models.py` with required fields (username, password)
- ✅ **Database Schema**: PostgreSQL with proper relationships
- ✅ **FastAPI Framework**: Ready for auth implementation
- ❌ **Authentication Libraries**: Missing `python-jose[cryptography]`, `passlib[bcrypt]`
- ❌ **Password Security**: Currently stored as plain text
- ❌ **JWT Implementation**: No token generation/validation
- ❌ **Auth Middleware**: No protection for routes
- ❌ **Auth Endpoints**: No register/login endpoints

### Frontend Status
- ✅ **React Framework**: Ready for auth implementation
- ✅ **Existing Contexts**: RolePlayContext, LanguageContext as examples
- ✅ **UI Components**: shadcn/ui components available for forms
- ❌ **AuthContext**: No authentication state management
- ❌ **Auth Pages**: No login/register pages
- ❌ **Auth Integration**: No token handling in API calls

## Implementation Plan

### Phase 1: Backend Authentication Foundation

#### 1.1 Add Dependencies
- Add `python-jose[cryptography]==3.3.0` to requirements.txt
- Add `passlib[bcrypt]==1.7.4` to requirements.txt

#### 1.2 Create Authentication Service (`backend/auth/auth_service.py`)
```python
# JWT token utilities
# Password hashing/verification
# User authentication logic
```

#### 1.3 Create Authentication Routes (`backend/auth/routes.py`)
```python
# POST /api/auth/register - User registration
# POST /api/auth/login - User login
# GET /api/auth/me - Get current user
# POST /api/auth/logout - Logout (optional)
```

#### 1.4 Add Authentication Middleware
```python
# JWT token validation
# Protected route decorator
# User context injection
```

### Phase 2: Backend Integration

#### 2.1 Update User Model
- Ensure password hashing on user creation
- Add password verification method

#### 2.2 Update Existing Routes
- Replace hardcoded `user_id = 1` with authenticated user
- Add auth middleware to protected routes:
  - `/api/chats` (all endpoints)
  - `/api/chats/{chat_id}/messages` (all endpoints)

#### 2.3 Mount Auth Routes
- Update `backend/main.py` to include auth router

### Phase 3: Frontend Authentication

#### 3.1 Create AuthContext (`client/src/contexts/AuthContext.tsx`)
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

#### 3.2 Create Authentication Pages
- `client/src/pages/auth/login.tsx` - Login form
- `client/src/pages/auth/register.tsx` - Registration form
- Use shadcn/ui components for consistent styling

#### 3.3 Update API Integration
- Add JWT token to API calls
- Handle authentication errors (401/403)
- Implement token refresh logic

### Phase 4: Navigation and UX

#### 4.1 Update App Structure
- Add auth pages to routing
- Add AuthProvider to app root
- Implement route protection

#### 4.2 Update Navigation
- Add login/logout buttons
- Conditional rendering based on auth state
- Redirect unauthenticated users to login

### Phase 5: Testing and Validation

#### 5.1 Backend Tests
- Test user registration endpoint
- Test user login endpoint
- Test protected routes with/without auth
- Test password hashing and verification

#### 5.2 Frontend Tests
- Test login/register forms
- Test authentication state management
- Test protected route navigation

#### 5.3 Integration Tests
- Test complete authentication flow
- Test token persistence across page refreshes
- Test error handling for invalid credentials

## Implementation Steps

### Step 1: Backend Foundation
1. Add authentication dependencies
2. Create auth service with JWT utilities
3. Create auth routes for register/login
4. Add authentication middleware

### Step 2: Backend Integration
1. Update user model for password hashing
2. Replace hardcoded user_id in routes
3. Add auth middleware to protected routes
4. Mount auth routes in main app

### Step 3: Frontend Foundation
1. Create AuthContext for state management
2. Create login and register pages
3. Update API calls to include auth headers
4. Add auth pages to routing

### Step 4: Testing and Refinement
1. Test authentication flow end-to-end
2. Test error handling and edge cases
3. Implement token refresh if needed
4. Add proper loading states

## Security Considerations

1. **Password Security**: Use bcrypt for password hashing
2. **JWT Security**: Use proper secret key, set appropriate expiration
3. **Token Storage**: Use httpOnly cookies or secure localStorage
4. **CORS**: Ensure proper CORS configuration for auth endpoints
5. **Error Handling**: Don't leak sensitive information in error messages

## Files to Create/Modify

### Backend
- `backend/requirements.txt` - Add auth dependencies
- `backend/auth/` - New directory
- `backend/auth/__init__.py` - Package initialization
- `backend/auth/auth_service.py` - JWT and password utilities
- `backend/auth/routes.py` - Authentication endpoints
- `backend/routes.py` - Update to use authenticated user
- `backend/main.py` - Mount auth routes

### Frontend
- `client/src/contexts/AuthContext.tsx` - Authentication state
- `client/src/pages/auth/` - New directory
- `client/src/pages/auth/login.tsx` - Login page
- `client/src/pages/auth/register.tsx` - Registration page
- `client/src/lib/api.ts` - API utilities with auth headers
- `client/src/App.tsx` - Add AuthProvider and routing

## Expected Outcomes

After implementation:
1. ✅ Users can register with username/password
2. ✅ Users can login and receive JWT token
3. ✅ Protected routes require authentication
4. ✅ Frontend maintains authentication state
5. ✅ API calls include authentication headers
6. ✅ Passwords are securely hashed
7. ✅ No more hardcoded user_id = 1

## Estimated Time: 3 days

- **Day 1**: Backend authentication foundation and routes
- **Day 2**: Frontend authentication context and pages
- **Day 3**: Integration, testing, and refinement