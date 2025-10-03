from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

from database import get_db
from models import User
from schemas import UserLogin, UserLoginLegacy, UserRegister, FirebaseAuthRequest, Token, User as UserSchema
from auth.auth_service import AuthService

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Security scheme
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    return AuthService.get_current_user(db, token)

@router.post("/register", response_model=UserSchema)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user with email"""
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user with email
        user = AuthService.create_user_with_email(db, user_data.email, user_data.password, user_data.username)
        logger.info(f"New user registered: {user.email}")
        return user
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user"
        )

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Login user with email and return access token"""
    try:
        # Authenticate user by email
        user = AuthService.authenticate_user_by_email(db, user_data.email, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        AuthService.ensure_user_is_active(user)

        # Create access token (using email as subject)
        access_token = AuthService.create_access_token(data={"sub": user.email})
        logger.info(f"User logged in: {user.email}")

        client_ip = request.client.host if request.client else None
        try:
            AuthService.record_successful_login(db, user, client_ip)
        except Exception as e:
            logger.warning(f"Failed to record login metadata for user {user.email}: {e}")

        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@router.post("/login/legacy", response_model=Token)
async def login_legacy(user_data: UserLoginLegacy, request: Request, db: Session = Depends(get_db)):
    """Login user with username (legacy support)"""
    try:
        # Authenticate user by username
        user = AuthService.authenticate_user(db, user_data.username, user_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        AuthService.ensure_user_is_active(user)

        # Create access token (using username as subject for legacy compatibility)
        access_token = AuthService.create_access_token(data={"sub": user.username})
        logger.info(f"User logged in (legacy): {user.username}")

        client_ip = request.client.host if request.client else None
        try:
            AuthService.record_successful_login(db, user, client_ip)
        except Exception as e:
            logger.warning(f"Failed to record login metadata for user {user.username}: {e}")

        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during legacy login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/login/firebase", response_model=Token)
async def login_firebase(auth_data: FirebaseAuthRequest, request: Request, db: Session = Depends(get_db)):
    """Login user with Firebase token"""
    try:
        # Authenticate user by Firebase token
        user = AuthService.authenticate_user_by_firebase_token(db, auth_data.firebase_token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Firebase token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        AuthService.ensure_user_is_active(user)

        # Create access token (using email as subject)
        access_token = AuthService.create_access_token(data={"sub": user.email})
        logger.info(f"User logged in via Firebase: {user.email}")

        client_ip = request.client.host if request.client else None
        try:
            AuthService.record_successful_login(db, user, client_ip)
        except Exception as e:
            logger.warning(f"Failed to record login metadata for user {user.email}: {e}")

        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during Firebase login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase login failed"
        )

@router.post("/logout")
async def logout():
    """Logout endpoint (client-side token removal)"""
    return {"message": "Successfully logged out"}

@router.get("/me/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's statistics"""
    try:
        from models import Chat, ChatMessage, Character
        from sqlalchemy import func, distinct

        # Get total chats count
        total_chats = db.query(Chat).filter(Chat.user_id == current_user.id).count()

        # Get total messages count (explicitly specify join condition)
        total_messages = db.query(ChatMessage).join(
            Chat, ChatMessage.chat_id == Chat.id
        ).filter(
            Chat.user_id == current_user.id
        ).count()

        # Get unique characters chatted with
        unique_characters = db.query(distinct(Chat.character_id)).filter(
            Chat.user_id == current_user.id
        ).count()

        # Get user's created characters count
        created_characters = db.query(Character).filter(
            Character.created_by == current_user.id,
            Character.is_deleted == False
        ).count()

        # Get recent activity (last 5 chat sessions)
        recent_chats = db.query(Chat).filter(
            Chat.user_id == current_user.id
        ).order_by(Chat.created_at.desc()).limit(5).all()

        recent_activity = []
        for chat in recent_chats:
            character = db.query(Character).filter(Character.id == chat.character_id).first()
            if character:
                recent_activity.append({
                    "type": "chat",
                    "character_name": character.name,
                    "character_avatar": character.avatar_url,
                    "created_at": chat.created_at.isoformat() if chat.created_at else None,
                    "updated_at": chat.updated_at.isoformat() if chat.updated_at else None
                })

        return {
            "total_chats": total_chats,
            "total_messages": total_messages,
            "unique_characters": unique_characters,
            "created_characters": created_characters,
            "recent_activity": recent_activity,
            "member_since": current_user.created_at.isoformat() if current_user.created_at else None
        }

    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user statistics"
        )
