"""
Migration: Add message content limit to prevent DoS attacks

This migration changes the ChatMessage.content column from unlimited Text 
to String(10000) to prevent DoS attacks via large messages.

Created: 2025-08-26
Issue: #128 - Production Security Fixes
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# Revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Add 10KB limit to message content"""
    
    # For SQLite, we need to recreate the table since it doesn't support ALTER COLUMN
    # This script assumes SQLite (development) - for PostgreSQL production, use ALTER COLUMN
    
    connection = op.get_bind()
    
    # Check if we're using SQLite or PostgreSQL
    dialect_name = connection.dialect.name
    
    if dialect_name == 'sqlite':
        # SQLite approach: rename table, create new table, copy data
        print("Applying SQLite migration...")
        
        # 1. Rename existing table
        op.rename_table('chat_messages', 'chat_messages_old')
        
        # 2. Create new table with content limit
        op.create_table('chat_messages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('chat_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(length=50), nullable=False),
            sa.Column('content', sa.String(length=10000), nullable=False),  # 10KB limit
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_chat_messages_id'), 'chat_messages', ['id'], unique=False)
        
        # 3. Copy data, truncating content if necessary
        connection.execute(text("""
            INSERT INTO chat_messages (id, chat_id, role, content, timestamp)
            SELECT id, chat_id, role, 
                   CASE 
                       WHEN LENGTH(content) > 10000 THEN SUBSTR(content, 1, 10000)
                       ELSE content 
                   END as content,
                   timestamp
            FROM chat_messages_old
        """))
        
        # 4. Drop old table
        op.drop_table('chat_messages_old')
        
        print("SQLite migration completed successfully")
        
    elif dialect_name == 'postgresql':
        # PostgreSQL approach: use ALTER COLUMN
        print("Applying PostgreSQL migration...")
        
        # First, truncate any existing content that exceeds 10KB
        connection.execute(text("""
            UPDATE chat_messages 
            SET content = LEFT(content, 10000) 
            WHERE CHAR_LENGTH(content) > 10000
        """))
        
        # Then alter the column type
        op.alter_column('chat_messages', 'content',
                       existing_type=sa.TEXT(),
                       type_=sa.String(length=10000),
                       existing_nullable=False)
                       
        print("PostgreSQL migration completed successfully")
    
    else:
        raise Exception(f"Unsupported database dialect: {dialect_name}")

def downgrade():
    """Remove message content limit (revert to unlimited Text)"""
    
    connection = op.get_bind()
    dialect_name = connection.dialect.name
    
    if dialect_name == 'sqlite':
        print("Reverting SQLite migration...")
        
        # SQLite: recreate table with Text column
        op.rename_table('chat_messages', 'chat_messages_limited')
        
        op.create_table('chat_messages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('chat_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(length=50), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),  # Back to unlimited Text
            sa.Column('timestamp', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['chat_id'], ['chats.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_chat_messages_id'), 'chat_messages', ['id'], unique=False)
        
        # Copy data back
        connection.execute(text("""
            INSERT INTO chat_messages (id, chat_id, role, content, timestamp)
            SELECT id, chat_id, role, content, timestamp
            FROM chat_messages_limited
        """))
        
        op.drop_table('chat_messages_limited')
        print("SQLite migration reverted successfully")
        
    elif dialect_name == 'postgresql':
        print("Reverting PostgreSQL migration...")
        
        # PostgreSQL: change back to TEXT
        op.alter_column('chat_messages', 'content',
                       existing_type=sa.String(length=10000),
                       type_=sa.TEXT(),
                       existing_nullable=False)
                       
        print("PostgreSQL migration reverted successfully")
    
    else:
        raise Exception(f"Unsupported database dialect: {dialect_name}")

if __name__ == "__main__":
    print("Migration script for message content limits")
    print("This script should be run via Alembic migration system")
    print("Usage: alembic upgrade head")