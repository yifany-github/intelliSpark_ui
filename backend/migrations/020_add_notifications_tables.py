"""Migration 020: Add notifications tables and seed default templates.

Run with: python migrations/020_add_notifications_tables.py
"""

import os
import sys
from sqlalchemy import inspect, text

# Allow running the script directly via `python migrations/<file>.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import sync_engine


def _create_notifications_table(conn, dialect: str) -> None:
    """Create the notifications table if it does not exist."""
    if dialect == "sqlite":
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    priority VARCHAR(20) DEFAULT 'normal',
                    is_read BOOLEAN DEFAULT 0,
                    action_type VARCHAR(50),
                    action_data TEXT,
                    meta_data TEXT,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
                """
            )
        )
    else:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    priority VARCHAR(20) DEFAULT 'normal',
                    is_read BOOLEAN DEFAULT FALSE,
                    action_type VARCHAR(50),
                    action_data JSONB,
                    meta_data JSONB,
                    expires_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    read_at TIMESTAMPTZ
                )
                """
            )
        )

    # Useful indexes
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)"
        )
    )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)"
        )
    )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at)"
        )
    )


def _create_templates_table(conn, dialect: str) -> None:
    """Create the notification_templates table if it does not exist."""
    if dialect == "sqlite":
        conn.execute(
            text(
                """
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
                """
            )
        )
    else:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS notification_templates (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    title_template VARCHAR(255) NOT NULL,
                    content_template TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    priority VARCHAR(20) DEFAULT 'normal',
                    action_type VARCHAR(50),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )


def _seed_default_templates(conn) -> None:
    """Insert the default templates used throughout the notification service."""
    templates = [
        {
            "name": "welcome",
            "title_template": "Welcome to IntelliSpark, ${username}!",
            "content_template": (
                "We're thrilled to have you here, ${username}. "
                "Start a conversation with any character to begin your adventure. "
                "Joined on ${timestamp}."
            ),
            "type": "system",
            "priority": "normal",
            "action_type": None,
        },
        {
            "name": "payment_success",
            "title_template": "Payment confirmed: ${amount}",
            "content_template": (
                "Thanks for your purchase! We've added ${tokens} tokens to your balance "
                "on ${timestamp}."
            ),
            "type": "payment",
            "priority": "high",
            "action_type": None,
        },
        {
            "name": "token_low",
            "title_template": "Low token balance alert",
            "content_template": (
                "Your balance is down to ${balance} tokens as of ${timestamp}. "
                "Top up soon to avoid interruptions."
            ),
            "type": "system",
            "priority": "high",
            "action_type": None,
        },
        {
            "name": "system_maintenance",
            "title_template": "Scheduled maintenance notice",
            "content_template": (
                "We'll be undergoing maintenance starting ${start_time} for about ${duration}. "
                "Expect limited availability during this window."
            ),
            "type": "system",
            "priority": "high",
            "action_type": None,
        },
        {
            "name": "admin_message",
            "title_template": "${title}",
            "content_template": "${content}",
            "type": "admin",
            "priority": "normal",
            "action_type": None,
        },
    ]

    for template in templates:
        exists = conn.execute(
            text(
                "SELECT id FROM notification_templates WHERE name = :name LIMIT 1"
            ),
            {"name": template["name"]},
        ).first()

        if exists:
            print(f"Template '{template['name']}' already exists, skipping")
            continue

        conn.execute(
            text(
                """
                INSERT INTO notification_templates (
                    name,
                    title_template,
                    content_template,
                    type,
                    priority,
                    action_type,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    :name,
                    :title_template,
                    :content_template,
                    :type,
                    :priority,
                    :action_type,
                    :is_active,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """
            ),
            {
                **template,
                "is_active": True,
            },
        )
        print(f"Seeded notification template '{template['name']}'")


def run_migration() -> None:
    print("Starting migration 020: notifications tables and templates...")
    with sync_engine.begin() as conn:
        inspector = inspect(conn)
        dialect = conn.dialect.name

        if not inspector.has_table("notifications"):
            print("Creating notifications table...")
            _create_notifications_table(conn, dialect)
        else:
            print("notifications table already exists, skipping creation")

        if not inspector.has_table("notification_templates"):
            print("Creating notification_templates table...")
            _create_templates_table(conn, dialect)
        else:
            print("notification_templates table already exists, skipping creation")

        _seed_default_templates(conn)

    print("✅ Migration 020 completed successfully!")


if __name__ == "__main__":
    run_migration()
