"""
Scheduled Tasks - Automated background jobs

This module manages recurring tasks like:
- Token expiration cleanup (runs daily)
- Future: Token expiration warnings, analytics, etc.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from payment.token_service import TokenService
from database import SessionLocal
import logging

logger = logging.getLogger(__name__)

# Create scheduler instance
scheduler = BackgroundScheduler()


def cleanup_expired_tokens_job():
    """
    Daily job to remove expired subscription tokens.
    Runs at midnight UTC every day.
    """
    db = SessionLocal()
    try:
        token_service = TokenService(db)
        result = token_service.cleanup_expired_tokens()

        logger.info(
            f"✅ Token cleanup completed: "
            f"{result.get('expired_transactions', 0)} expired, "
            f"{result.get('users_affected', 0)} users affected, "
            f"{result.get('tokens_removed', 0)} tokens removed"
        )

        # Log errors if any
        if result.get('error'):
            logger.error(f"❌ Token cleanup error: {result.get('error')}")

    except Exception as e:
        logger.error(f"❌ Token cleanup job failed: {str(e)}")
    finally:
        db.close()


def start_scheduler():
    """
    Initialize and start the background scheduler.
    Call this from main.py on startup.
    """
    try:
        # Schedule token cleanup - runs daily at midnight UTC
        scheduler.add_job(
            cleanup_expired_tokens_job,
            trigger=CronTrigger(hour=0, minute=0),  # Daily at 00:00 UTC
            id='cleanup_expired_tokens',
            name='Clean up expired subscription tokens',
            replace_existing=True,
        )

        scheduler.start()
        logger.info("✅ Background scheduler started successfully")
        logger.info("📅 Scheduled jobs:")
        for job in scheduler.get_jobs():
            logger.info(f"  - {job.name} (ID: {job.id}) - Next run: {job.next_run_time}")

    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {str(e)}")
        raise


def stop_scheduler():
    """
    Stop the background scheduler gracefully.
    Call this on application shutdown.
    """
    try:
        if scheduler.running:
            scheduler.shutdown(wait=True)
            logger.info("✅ Background scheduler stopped")
    except Exception as e:
        logger.error(f"❌ Error stopping scheduler: {str(e)}")
