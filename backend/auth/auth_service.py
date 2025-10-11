from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import secrets
import hashlib
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from models import User, RefreshToken
from config import settings

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 14
REFRESH_TOKEN_BYTE_LENGTH = 48

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:

    @staticmethod
    def generate_refresh_token() -> str:
        return secrets.token_urlsafe(REFRESH_TOKEN_BYTE_LENGTH)

    @staticmethod
    def hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def create_refresh_token_record(
        db: Session,
        user: User,
        refresh_token: str,
        user_agent: Optional[str] = None,
    ) -> RefreshToken:
        now = datetime.now(timezone.utc)
        record = RefreshToken(
            user_id=user.id,
            token_hash=AuthService.hash_refresh_token(refresh_token),
            user_agent=user_agent[:255] if user_agent else None,
            created_at=now,
            last_used_at=now,
            expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def verify_refresh_token(db: Session, refresh_token: str) -> RefreshToken:
        hashed = AuthService.hash_refresh_token(refresh_token)
        now = datetime.now(timezone.utc)
        record = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == hashed,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            .first()
        )
        if not record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        record.last_used_at = now
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def rotate_refresh_token(
        db: Session,
        record: RefreshToken,
        new_token: str,
        user_agent: Optional[str] = None,
    ) -> RefreshToken:
        record.token_hash = AuthService.hash_refresh_token(new_token)
        record.expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        record.last_used_at = datetime.now(timezone.utc)
        if user_agent:
            record.user_agent = user_agent[:255]
        record.revoked_at = None
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def revoke_refresh_token(db: Session, refresh_token: str) -> None:
        hashed = AuthService.hash_refresh_token(refresh_token)
        record = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hashed, RefreshToken.revoked_at.is_(None))
            .first()
        )
        if record:
            record.revoked_at = datetime.now(timezone.utc)
            db.add(record)
            db.commit()

    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """Authenticate user credentials by username (legacy)"""
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if not AuthService.verify_password(password, user.password):
            return None
        return user
    
    @staticmethod
    def authenticate_user_by_email(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticate user credentials by email"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not AuthService.verify_password(password, user.password):
            return None
        return user

    @staticmethod
    def ensure_user_is_active(user: User):
        """Raise if user account is suspended."""
        if not user:
            return
        if getattr(user, "is_suspended", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended. Please contact support."
            )

    @staticmethod
    def record_successful_login(db: Session, user: User, client_ip: Optional[str] = None) -> None:
        """Record login metadata for auditing."""
        if not user:
            return

        user.last_login_at = datetime.now(timezone.utc)
        if client_ip:
            user.last_login_ip = client_ip

        db.add(user)
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
    
    @staticmethod
    def create_user(db: Session, username: str, password: str) -> User:
        """Create a new user with hashed password (legacy)"""
        hashed_password = AuthService.get_password_hash(password)
        user = User(username=username, password=hashed_password)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def create_user_with_email(db: Session, email: str, password: str, username: str = None) -> User:
        """Create a new user with email and hashed password"""
        hashed_password = AuthService.get_password_hash(password)
        # Generate username if not provided
        if not username:
            username = email.split('@')[0]
            # Make username unique if it already exists
            counter = 1
            base_username = username
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1
        
        user = User(username=username, email=email, password=hashed_password, provider='email')
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Give new users 10 free tokens to start
        try:
            from payment.token_service import TokenService
            token_service = TokenService(db)
            token_service.add_tokens(user.id, 10, "Welcome bonus - 10 free tokens")
        except Exception as e:
            # Don't fail user creation if token assignment fails
            import logging
            logging.warning(f"Failed to assign welcome tokens to user {user.id}: {e}")
        
        return user
    
    @staticmethod
    def authenticate_user_by_firebase_token(db: Session, firebase_token: str) -> Optional[User]:
        """Authenticate user by Firebase token and create user if doesn't exist"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Use Firebase REST API for token verification (simpler than Admin SDK)
            import requests
            from config import settings
            
            if not settings.firebase_api_key:
                logger.error("Firebase API key not configured")
                return None
            
            if not firebase_token or len(firebase_token.strip()) == 0:
                logger.error("Firebase token is empty or None")
                return None
            
            logger.debug(f"🔐 Attempting Firebase token verification, token length: {len(firebase_token)}")
            
            # Verify the ID token using Firebase Auth REST API
            verify_url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={settings.firebase_api_key}"
            response = requests.post(verify_url, json={"idToken": firebase_token}, timeout=10)
            
            logger.debug(f"🔍 Firebase verification response status: {response.status_code}")
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    logger.error(f"❌ Firebase token verification failed: status {response.status_code}")
                    logger.debug(f"Firebase error details: {error_data}")
                except:
                    logger.error(f"❌ Firebase token verification failed: status {response.status_code}")
                    logger.debug(f"Firebase response: {response.text}")
                return None
                
            data = response.json()
            logger.debug(f"🔍 Firebase response data keys: {list(data.keys())}")
            
            if 'users' not in data or len(data['users']) == 0:
                logger.error("❌ No users found in Firebase response")
                return None
                
            firebase_user = data['users'][0]
            email = firebase_user.get('email')
            firebase_uid = firebase_user.get('localId')
            
            logger.debug(f"📧 Firebase user email: {email}")
            logger.debug(f"🆔 Firebase user localId: {firebase_uid}")
            
            if not email:
                logger.error("❌ No email found in Firebase user data")
                return None
            
            # Check if user exists by firebase_uid first, then by email
            logger.info(f"🔍 Checking for existing user with firebase_uid: {firebase_uid}")
            user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
            if not user:
                logger.info(f"🔍 No user found with firebase_uid, checking email: {email}")
                user = db.query(User).filter(User.email == email).first()
            
            if not user:
                logger.info("👤 Creating new user from Firebase data")
                # Create new user from Firebase data
                username = email.split('@')[0]
                counter = 1
                base_username = username
                while db.query(User).filter(User.username == username).first():
                    username = f"{base_username}_{counter}"
                    counter += 1
                
                user = User(
                    username=username,
                    email=email,
                    password="",  # No password for OAuth users
                    provider='google',
                    firebase_uid=firebase_uid
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"✅ New user created with ID: {user.id}")
                
                # Give new users 10 free tokens to start
                try:
                    from payment.token_service import TokenService
                    token_service = TokenService(db)
                    token_service.add_tokens(user.id, 10, "Welcome bonus - 10 free tokens")
                    logger.info(f"🎁 Welcome tokens assigned to user {user.id}")
                except Exception as e:
                    # Don't fail user creation if token assignment fails
                    logger.warning(f"Failed to assign welcome tokens to user {user.id}: {e}")
            else:
                logger.info(f"👤 Existing user found with ID: {user.id}")
                # Update firebase_uid if user exists but doesn't have it
                if not user.firebase_uid:
                    logger.info("🔄 Updating existing user with firebase_uid")
                    user.firebase_uid = firebase_uid
                    db.commit()
            
            logger.info(f"✅ Firebase authentication successful for user: {user.email}")
            return user
            
        except Exception as e:
            logger.error(f"❌ Exception in Firebase authentication: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return None
    
    @staticmethod
    def create_user_from_firebase(db: Session, firebase_uid: str, email: str, provider: str = 'google') -> User:
        """Create a new user from Firebase social login"""
        # Generate username from email
        username = email.split('@')[0]
        # Make username unique if it already exists
        counter = 1
        base_username = username
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}_{counter}"
            counter += 1
        
        # No password needed for social login
        user = User(
            username=username,
            email=email,
            password='',  # Empty password for social login
            provider=provider,
            firebase_uid=firebase_uid
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_current_user(db: Session, token: str) -> User:
        """Get current user from JWT token"""
        payload = AuthService.verify_token(token)
        identifier: str = payload.get("sub")
        if identifier is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Try to find user by email first (new tokens), then by username (legacy tokens)
        user = db.query(User).filter(User.email == identifier).first()
        if user is None:
            user = db.query(User).filter(User.username == identifier).first()
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
