#!/usr/bin/env python3
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, UserToken
from config import settings

def add_tokens_to_user(user_id=None, tokens=10000):
    try:
        engine = create_engine(settings.database_url)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()

        # Get user
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        else:
            user = db.query(User).first()
            
        if not user:
            print('No users found in database')
            return False
        
        print(f'Found user: {user.username} (ID: {user.id})')
        
        # Check if user already has a token record
        user_token = db.query(UserToken).filter(UserToken.user_id == user.id).first()
        
        if user_token:
            # Update existing token balance
            old_balance = user_token.balance
            user_token.balance += tokens
            print(f'Updated token balance from {old_balance} to {user_token.balance}')
        else:
            # Create new token record
            user_token = UserToken(
                user_id=user.id,
                balance=tokens
            )
            db.add(user_token)
            print(f'Created new token record with {tokens} tokens')
        
        db.commit()
        print(f'✅ Successfully added {tokens} tokens!')
        return True
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    success = add_tokens_to_user(tokens=10000)
    if success:
        print("\n🎉 Token addition successful! You can now test the chat.")
    else:
        print("\n💥 Token addition failed!")