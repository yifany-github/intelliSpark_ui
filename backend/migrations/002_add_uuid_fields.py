"""
Migration: Add UUID fields to Chat and ChatMessage models

This is Phase 1 of UUID migration - adds UUID fields alongside existing integer IDs
to enable gradual migration without breaking existing functionality.

Phase 1: Add UUID columns (this migration)
Phase 2: Populate UUIDs for existing records  
Phase 3: Update API endpoints to support both integer and UUID access
Phase 4: Switch frontend to use UUIDs
Phase 5: Remove integer ID columns (final migration)

Created: 2025-08-26
Issue: #128 - Production Security Fixes - UUID Migration
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text
import uuid

# Revision identifiers
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None

def upgrade():
    """Add UUID fields to Chat and ChatMessage tables"""
    
    connection = op.get_bind()
    dialect_name = connection.dialect.name
    
    print(f"Adding UUID fields for {dialect_name}...")
    
    if dialect_name == 'sqlite':
        # SQLite doesn't have native UUID type, use String(36)
        print("Adding UUID fields for SQLite...")
        
        # Add UUID column to chats table
        op.add_column('chats', sa.Column('uuid', sa.String(36), nullable=True, unique=True))
        op.create_index('ix_chats_uuid', 'chats', ['uuid'], unique=True)
        
        # Add UUID columns to chat_messages table
        op.add_column('chat_messages', sa.Column('uuid', sa.String(36), nullable=True, unique=True))
        op.add_column('chat_messages', sa.Column('chat_uuid', sa.String(36), nullable=True))
        
        op.create_index('ix_chat_messages_uuid', 'chat_messages', ['uuid'], unique=True)
        op.create_index('ix_chat_messages_chat_uuid', 'chat_messages', ['chat_uuid'])
        
        # Create foreign key constraint for chat_uuid
        op.create_foreign_key('fk_chat_messages_chat_uuid', 'chat_messages', 'chats', ['chat_uuid'], ['uuid'])
        
    elif dialect_name == 'postgresql':
        # PostgreSQL with native UUID support
        print("Adding UUID fields for PostgreSQL...")
        
        # Enable uuid-ossp extension if not already enabled
        connection.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        
        # Add UUID column to chats table
        op.add_column('chats', sa.Column('uuid', UUID(as_uuid=True), nullable=True, unique=True))
        op.create_index('ix_chats_uuid', 'chats', ['uuid'], unique=True)
        
        # Add UUID columns to chat_messages table  
        op.add_column('chat_messages', sa.Column('uuid', UUID(as_uuid=True), nullable=True, unique=True))
        op.add_column('chat_messages', sa.Column('chat_uuid', UUID(as_uuid=True), nullable=True))
        
        op.create_index('ix_chat_messages_uuid', 'chat_messages', ['uuid'], unique=True)
        op.create_index('ix_chat_messages_chat_uuid', 'chat_messages', ['chat_uuid'])
        
        # Create foreign key constraint for chat_uuid
        op.create_foreign_key('fk_chat_messages_chat_uuid', 'chat_messages', 'chats', ['chat_uuid'], ['uuid'])
        
    else:
        raise Exception(f"Unsupported database dialect: {dialect_name}")
    
    print("UUID fields added successfully")
    print("Next step: Run 003_populate_uuid_fields.py to populate UUIDs for existing records")

def downgrade():
    """Remove UUID fields from Chat and ChatMessage tables"""
    
    connection = op.get_bind()
    dialect_name = connection.dialect.name
    
    print(f"Removing UUID fields for {dialect_name}...")
    
    # Drop foreign key constraint first
    op.drop_constraint('fk_chat_messages_chat_uuid', 'chat_messages', type_='foreignkey')
    
    # Drop indexes
    op.drop_index('ix_chat_messages_chat_uuid', 'chat_messages')
    op.drop_index('ix_chat_messages_uuid', 'chat_messages')
    op.drop_index('ix_chats_uuid', 'chats')
    
    # Drop columns
    op.drop_column('chat_messages', 'chat_uuid')
    op.drop_column('chat_messages', 'uuid') 
    op.drop_column('chats', 'uuid')
    
    print("UUID fields removed successfully")

if __name__ == "__main__":
    print("Migration script for adding UUID fields")
    print("This script should be run via Alembic migration system")
    print("Usage: alembic upgrade head")