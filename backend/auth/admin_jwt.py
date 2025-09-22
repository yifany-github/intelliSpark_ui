"""
Admin JWT Authentication Module

This module provides JWT token generation and verification for admin users.
Implements access tokens (short-lived) and refresh tokens (long-lived) with rotation.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from jwt import InvalidTokenError
from fastapi import HTTPException, status
from pydantic import BaseModel

from config import settings

# JWT Configuration
if not settings.admin_jwt_secret:
    raise RuntimeError("ADMIN_JWT_SECRET is required for admin authentication")

ADMIN_JWT_SECRET = settings.admin_jwt_secret
ADMIN_JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None
    token_type: Optional[str] = None
    admin: bool = False

def create_access_token(admin_user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a new JWT access token for admin user
    
    Args:
        admin_user_id: Admin user identifier
        expires_delta: Custom expiration time (optional)
    
    Returns:
        JWT access token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": admin_user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "token_type": "access",
        "admin": True
    }
    
    encoded_jwt = jwt.encode(to_encode, ADMIN_JWT_SECRET, algorithm=ADMIN_JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(admin_user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a new JWT refresh token for admin user
    
    Args:
        admin_user_id: Admin user identifier
        expires_delta: Custom expiration time (optional)
    
    Returns:
        JWT refresh token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": admin_user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "token_type": "refresh",
        "admin": True
    }
    
    encoded_jwt = jwt.encode(to_encode, ADMIN_JWT_SECRET, algorithm=ADMIN_JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str, expected_type: str = "access") -> TokenPayload:
    """
    Verify and decode JWT token
    
    Args:
        token: JWT token string
        expected_type: Expected token type ("access" or "refresh")
    
    Returns:
        TokenPayload with decoded data
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[ADMIN_JWT_ALGORITHM])
        
        # Validate token type
        if payload.get("token_type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {expected_type}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Validate admin claim
        if not payload.get("admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        
        return TokenPayload(**payload)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def create_token_pair(admin_user_id: str) -> TokenData:
    """
    Create both access and refresh tokens for admin user
    
    Args:
        admin_user_id: Admin user identifier
    
    Returns:
        TokenData with both tokens
    """
    access_token = create_access_token(admin_user_id)
    refresh_token = create_refresh_token(admin_user_id)
    
    return TokenData(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

def refresh_token_pair(refresh_token: str) -> TokenData:
    """
    Generate new token pair using refresh token (with rotation)
    
    Args:
        refresh_token: Current refresh token
    
    Returns:
        TokenData with new access and refresh tokens
    
    Raises:
        HTTPException: If refresh token is invalid
    """
    # Verify refresh token
    token_payload = verify_token(refresh_token, expected_type="refresh")
    
    if not token_payload.sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Create new token pair (refresh token rotation)
    return create_token_pair(token_payload.sub)
