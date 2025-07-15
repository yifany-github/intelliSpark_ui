#!/usr/bin/env python3
"""
Database migration script to add notification tables
"""

import sqlite3
from datetime import datetime

def migrate_notifications():
    """Add notification tables to the database"""
    conn = sqlite3.connect('roleplay_chat.db')
    cursor = conn.cursor()
    
    try:
        # Create notifications table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                priority VARCHAR(20) DEFAULT 'normal',
                is_read BOOLEAN DEFAULT 0,
                action_type VARCHAR(50),
                action_data TEXT,  -- JSON data
                meta_data TEXT,     -- JSON data
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Create notification_templates table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notification_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL UNIQUE,
                title_template VARCHAR(255) NOT NULL,
                content_template TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                priority VARCHAR(20) DEFAULT 'normal',
                action_type VARCHAR(50),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at)')
        
        # Insert default notification templates
        templates = [
            {
                'name': 'welcome',
                'title_template': 'Welcome to ProductInsightAI!',
                'content_template': 'Hi $username! Welcome to ProductInsightAI. Start exploring amazing AI characters and create unforgettable conversations.',
                'type': 'system',
                'priority': 'normal',
                'action_type': 'redirect',
            },
            {
                'name': 'payment_success',
                'title_template': 'Payment Successful!',
                'content_template': 'Your payment of $$amount has been processed successfully. You have received $tokens tokens. Happy chatting!',
                'type': 'payment',
                'priority': 'normal',
                'action_type': 'dismiss',
            },
            {
                'name': 'token_low',
                'title_template': 'Low Token Balance',
                'content_template': 'Your token balance is running low (only $balance tokens left). Consider purchasing more tokens to continue enjoying conversations.',
                'type': 'system',
                'priority': 'high',
                'action_type': 'redirect',
            },
            {
                'name': 'system_maintenance',
                'title_template': 'System Maintenance Notice',
                'content_template': 'We will be performing system maintenance starting at $start_time. Expected duration: $duration. We apologize for any inconvenience.',
                'type': 'system',
                'priority': 'high',
                'action_type': 'acknowledge',
            },
            {
                'name': 'new_feature',
                'title_template': 'New Feature Available!',
                'content_template': 'Check out our latest feature: $feature_name. $description',
                'type': 'system',
                'priority': 'normal',
                'action_type': 'redirect',
            },
            {
                'name': 'admin_message',
                'title_template': '$title',
                'content_template': '$content',
                'type': 'admin',
                'priority': 'normal',
                'action_type': 'dismiss',
            },
            {
                'name': 'token_refund',
                'title_template': 'Token Refund Processed',
                'content_template': 'Your refund of $tokens tokens has been processed and added to your account. The refund amount was $$amount.',
                'type': 'payment',
                'priority': 'normal',
                'action_type': 'dismiss',
            },
            {
                'name': 'account_security',
                'title_template': 'Account Security Notice',
                'content_template': 'We detected unusual activity on your account. Please review your recent activities and change your password if necessary.',
                'type': 'system',
                'priority': 'urgent',
                'action_type': 'acknowledge',
            },
            {
                'name': 'character_approved',
                'title_template': 'Character Approved!',
                'content_template': 'Great news! Your character "$character_name" has been approved and is now available for other users to chat with.',
                'type': 'system',
                'priority': 'normal',
                'action_type': 'redirect',
            },
            {
                'name': 'character_rejected',
                'title_template': 'Character Needs Revision',
                'content_template': 'Your character "$character_name" needs some revisions before approval. Reason: $reason. Please edit and resubmit.',
                'type': 'system',
                'priority': 'normal',
                'action_type': 'redirect',
            },
            {
                'name': 'daily_reminder',
                'title_template': 'Daily Chat Reminder',
                'content_template': 'Hello! You haven\'t chatted with any AI characters today. Come back and continue your amazing conversations!',
                'type': 'system',
                'priority': 'low',
                'action_type': 'redirect',
            }
        ]
        
        # Insert templates
        for template in templates:
            cursor.execute('''
                INSERT OR IGNORE INTO notification_templates 
                (name, title_template, content_template, type, priority, action_type, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ''', (
                template['name'],
                template['title_template'],
                template['content_template'],
                template['type'],
                template['priority'],
                template['action_type']
            ))
        
        conn.commit()
        print("✅ Notification tables created successfully!")
        print(f"✅ Inserted {len(templates)} default notification templates")
        
        # Show created tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%notification%'")
        tables = cursor.fetchall()
        print(f"✅ Created tables: {[table[0] for table in tables]}")
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        conn.rollback()
    
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_notifications()