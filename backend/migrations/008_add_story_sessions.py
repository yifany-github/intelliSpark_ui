"""Create story session tables for multi-role engine."""

from alembic import op
import sqlalchemy as sa

# Revision identifiers
revision = "008"
down_revision = "007_soft_delete_characters"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "story_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("story_id", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("user_role", sa.String(length=100), nullable=True),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_story_sessions_story_id", "story_sessions", ["story_id"])
    op.create_index("ix_story_sessions_user_id", "story_sessions", ["user_id"])

    op.create_table(
        "story_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), sa.ForeignKey("story_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_story_logs_session_id", "story_logs", ["session_id"])


def downgrade():
    op.drop_index("ix_story_logs_session_id", table_name="story_logs")
    op.drop_table("story_logs")

    op.drop_index("ix_story_sessions_user_id", table_name="story_sessions")
    op.drop_index("ix_story_sessions_story_id", table_name="story_sessions")
    op.drop_table("story_sessions")
