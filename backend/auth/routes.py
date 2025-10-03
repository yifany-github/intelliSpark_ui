from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging
import os
import shutil
from typing import Optional

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

@router.get("/check-username")
async def check_username(username: str, db: Session = Depends(get_db)):
    """Check if username is available"""
    try:
        # Check if username exists
        existing_user = db.query(User).filter(User.username == username).first()
        return {"available": existing_user is None}
    except Exception as e:
        logger.error(f"Error checking username: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check username availability"
        )

@router.put("/profile", response_model=UserSchema)
async def update_profile(
    username: str = Form(...),
    email: str = Form(...),
    age: Optional[int] = Form(None),
    preset_avatar_id: Optional[int] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    try:
        # Check if username is being changed and if it's taken
        if username != current_user.username:
            existing_user = db.query(User).filter(User.username == username).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )

        # Check if email is being changed and if it's taken
        if email != current_user.email:
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )

        # Validate age if provided
        if age is not None and (age < 13 or age > 120):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Age must be between 13 and 120"
            )

        # Update basic fields
        current_user.username = username
        current_user.email = email
        current_user.age = age

        # Handle avatar update
        if preset_avatar_id is not None:
            # Use preset avatar
            api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
            current_user.avatar_url = f"{api_base_url}/assets/user_avatar_img/avatar_{preset_avatar_id}.png"
        elif avatar is not None:
            # Handle custom avatar upload
            # Validate file type
            allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
            file_ext = os.path.splitext(avatar.filename)[1].lower()
            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid file type. Only JPG, PNG, and GIF are allowed"
                )

            # Validate file size (5MB limit)
            avatar.file.seek(0, 2)  # Seek to end
            file_size = avatar.file.tell()
            avatar.file.seek(0)  # Reset to beginning

            if file_size > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size exceeds 5MB limit"
                )

            # Create avatars directory if it doesn't exist
            avatars_dir = os.path.join("attached_assets", "avatars")
            os.makedirs(avatars_dir, exist_ok=True)

            # Save file with unique name
            file_name = f"user_{current_user.id}_{avatar.filename}"
            file_path = os.path.join(avatars_dir, file_name)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(avatar.file, buffer)

            # Update avatar URL
            api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
            current_user.avatar_url = f"{api_base_url}/assets/avatars/{file_name}"

        # Commit changes
        db.commit()
        db.refresh(current_user)

        logger.info(f"Profile updated for user: {current_user.email}")
        return current_user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
