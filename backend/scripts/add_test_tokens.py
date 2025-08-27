#!/usr/bin/env python3
"""
Script to add test tokens to a user account
Usage: python add_test_tokens.py [user_id] [amount]
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from models import User, UserToken, TokenTransaction
from config import settings
from payment.token_service import TokenService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_test_tokens(user_id: int = None, amount: int = 100000):
    """Add test tokens to user account"""
    
    # Create database connection
    database_url = settings.database_url
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as db:
        # If no user_id provided, try to find the first user or create a test user
        if user_id is None:
            user = db.query(User).first()
            if not user:
                print("No users found in database. Please create a user first or provide a user_id.")
                return False
            user_id = user.id
            print(f"Using user ID: {user_id} (username: {user.username})")
        else:
            # Verify user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print(f"User with ID {user_id} not found.")
                return False
            print(f"Found user: {user.username} (ID: {user_id})")
        
        # Initialize token service
        token_service = TokenService(db)
        
        # Get current balance
        current_balance = token_service.get_user_balance(user_id)
        print(f"Current token balance: {current_balance}")
        
        # Add tokens
        success = token_service.add_tokens(
            user_id=user_id, 
            amount=amount, 
            description=f"Test tokens added via script - {amount} tokens"
        )
        
        if success:
            new_balance = token_service.get_user_balance(user_id)
            print(f"✅ Successfully added {amount} tokens!")
            print(f"New token balance: {new_balance}")
            return True
        else:
            print("❌ Failed to add tokens")
            return False

def list_users():
    """List all users in the database"""
    database_url = settings.database_url
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as db:
        users = db.query(User).all()
        if not users:
            print("No users found in database.")
            return
        
        print("Available users:")
        for user in users:
            # Get token balance
            user_token = db.query(UserToken).filter(UserToken.user_id == user.id).first()
            balance = user_token.balance if user_token else 0
            print(f"  ID: {user.id} | Username: {user.username} | Email: {user.email or 'N/A'} | Tokens: {balance}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--list-users":
        list_users()
        sys.exit(0)
    
    user_id = None
    amount = 100000
    
    if len(sys.argv) > 1:
        try:
            user_id = int(sys.argv[1])
        except ValueError:
            print("Invalid user_id. Must be an integer.")
            sys.exit(1)
    
    if len(sys.argv) > 2:
        try:
            amount = int(sys.argv[2])
        except ValueError:
            print("Invalid amount. Must be an integer.")
            sys.exit(1)
    
    print(f"Adding {amount} test tokens...")
    success = add_test_tokens(user_id, amount)
    sys.exit(0 if success else 1)