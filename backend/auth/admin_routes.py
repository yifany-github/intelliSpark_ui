"""
Admin JWT Authentication Routes

This module provides JWT-based authentication endpoints for admin users.
Replaces the static bearer token system with proper access/refresh tokens.
"""

import os
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from database import get_db
from models import User
from .admin_jwt import (
    create_token_pair, 
    refresh_token_pair, 
    verify_token,
    TokenData,
    TokenPayload
)

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/admin", tags=["admin-auth"])

# Security
security = HTTPBearer()

# Rate limiting for login attempts
limiter = Limiter(key_func=get_remote_address)

# Admin credentials from environment
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    admin_user: dict

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/login-jwt", response_model=AdminLoginResponse)
@limiter.limit("5/minute")  # Rate limit login attempts
async def admin_login_jwt(
    request: Request,
    login_data: AdminLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Admin JWT login endpoint
    
    Authenticates admin user and returns access + refresh tokens
    Rate limited to 5 attempts per minute per IP
    """
    try:
        # Validate admin credentials
        if login_data.username != ADMIN_USERNAME or login_data.password != ADMIN_PASSWORD:
            logger.warning(f"Failed admin login attempt from {get_remote_address(request)} - Invalid credentials")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create JWT token pair
        admin_user_id = f"admin:{login_data.username}"
        token_data = create_token_pair(admin_user_id)
        
        # Log successful login
        logger.info(f"Successful admin login from {get_remote_address(request)} - User: {login_data.username}")
        
        return AdminLoginResponse(
            access_token=token_data.access_token,
            refresh_token=token_data.refresh_token,
            token_type=token_data.token_type,
            expires_in=token_data.expires_in,
            admin_user={
                "username": login_data.username,
                "role": "admin",
                "login_time": datetime.utcnow().isoformat()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during admin login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )

@router.post("/refresh", response_model=TokenData)
@limiter.limit("10/minute")  # Rate limit refresh attempts
async def refresh_admin_token(
    request: Request,
    refresh_data: RefreshTokenRequest
):
    """
    Refresh admin JWT tokens
    
    Uses refresh token to generate new access + refresh token pair
    Implements refresh token rotation for security
    """
    try:
        # Generate new token pair using refresh token
        new_tokens = refresh_token_pair(refresh_data.refresh_token)
        
        logger.info(f"Admin token refreshed from {get_remote_address(request)}")
        
        return new_tokens
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during token refresh: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh"
        )

def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenPayload:
    """
    Dependency to verify admin JWT token and extract admin user info
    
    This replaces the old verify_admin_token function
    """
    try:
        # Verify access token
        token_payload = verify_token(credentials.credentials, expected_type="access")
        
        # Additional validation for admin access
        if not token_payload.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        return token_payload
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying admin token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate admin credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/verify")
async def verify_admin_token(
    admin_user: TokenPayload = Depends(get_current_admin)
):
    """
    Verify admin token endpoint
    
    Used by frontend to check if token is still valid
    """
    return {
        "valid": True,
        "admin_user_id": admin_user.sub,
        "token_type": admin_user.token_type,
        "expires": admin_user.exp
    }