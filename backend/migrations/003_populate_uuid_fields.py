"""
Migration: Populate UUID fields for existing Chat and ChatMessage records

This is Phase 2 of UUID migration - generates UUIDs for all existing records
and establishes the UUID relationships between chats and messages.

This migration must be run after 002_add_uuid_fields.py

Created: 2025-08-26
Issue: #128 - Production Security Fixes - UUID Migration
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid

# Revision identifiers  
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None

def upgrade():
    """Populate UUID fields for existing records"""
    
    connection = op.get_bind()
    dialect_name = connection.dialect.name
    
    print("Populating UUID fields for existing records...")
    
    if dialect_name == 'sqlite':
        print("Populating UUIDs for SQLite...")
        
        # Generate UUIDs for existing chats
        connection.execute(text("""
            UPDATE chats 
            SET uuid = lower(hex(randomblob(4))) || '-' || 
                      lower(hex(randomblob(2))) || '-' || 
                      '4' || substr(lower(hex(randomblob(2))), 2) || '-' || 
                      substr('ab89', abs(random()) % 4 + 1, 1) || 
                      substr(lower(hex(randomblob(2))), 2) || '-' || 
                      lower(hex(randomblob(6)))
            WHERE uuid IS NULL
        """))
        
        # Generate UUIDs for existing chat messages
        connection.execute(text("""
            UPDATE chat_messages 
            SET uuid = lower(hex(randomblob(4))) || '-' || 
                      lower(hex(randomblob(2))) || '-' || 
                      '4' || substr(lower(hex(randomblob(2))), 2) || '-' || 
                      substr('ab89', abs(random()) % 4 + 1, 1) || 
                      substr(lower(hex(randomblob(2))), 2) || '-' || 
                      lower(hex(randomblob(6)))
            WHERE uuid IS NULL
        """))
        
        # Link chat messages to chat UUIDs
        connection.execute(text("""
            UPDATE chat_messages 
            SET chat_uuid = (SELECT chats.uuid FROM chats WHERE chats.id = chat_messages.chat_id)
            WHERE chat_uuid IS NULL
        """))
        
    elif dialect_name == 'postgresql':
        print("Populating UUIDs for PostgreSQL...")
        
        # Generate UUIDs for existing chats using uuid_generate_v4()
        connection.execute(text("""
            UPDATE chats 
            SET uuid = uuid_generate_v4()
            WHERE uuid IS NULL
        """))
        
        # Generate UUIDs for existing chat messages
        connection.execute(text("""
            UPDATE chat_messages 
            SET uuid = uuid_generate_v4()
            WHERE uuid IS NULL
        """))
        
        # Link chat messages to chat UUIDs
        connection.execute(text("""
            UPDATE chat_messages 
            SET chat_uuid = (SELECT chats.uuid FROM chats WHERE chats.id = chat_messages.chat_id)
            WHERE chat_uuid IS NULL
        """))
        
    else:
        raise Exception(f"Unsupported database dialect: {dialect_name}")
    
    # Verify the population worked
    chat_count = connection.execute(text("SELECT COUNT(*) FROM chats WHERE uuid IS NULL")).scalar()
    message_count = connection.execute(text("SELECT COUNT(*) FROM chat_messages WHERE uuid IS NULL")).scalar()
    orphan_count = connection.execute(text("SELECT COUNT(*) FROM chat_messages WHERE chat_uuid IS NULL")).scalar()
    
    if chat_count > 0:
        raise Exception(f"Failed to populate UUIDs for {chat_count} chats")
    if message_count > 0:
        raise Exception(f"Failed to populate UUIDs for {message_count} messages")
    if orphan_count > 0:
        raise Exception(f"Found {orphan_count} orphaned messages without chat_uuid")
    
    print("UUID population completed successfully")
    print("All existing records now have UUIDs")
    print("Next step: Update API endpoints to accept both integer and UUID identifiers")

def downgrade():
    """Clear UUID fields (set them back to NULL)"""
    
    connection = op.get_bind()
    
    print("Clearing UUID fields...")
    
    # Clear UUID fields - this doesn't lose data since integer IDs remain
    connection.execute(text("UPDATE chat_messages SET chat_uuid = NULL, uuid = NULL"))
    connection.execute(text("UPDATE chats SET uuid = NULL"))
    
    print("UUID fields cleared successfully")

if __name__ == "__main__":
    print("Migration script for populating UUID fields")
    print("This script should be run via Alembic migration system")
    print("Usage: alembic upgrade head")