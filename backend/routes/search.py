"""
Search-related API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
import logging

from database import get_db
from models import Character
from pydantic import BaseModel

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/search", tags=["search"])


class TrendingCharacter(BaseModel):
    """Trending character response model"""
    id: int
    name: str
    trending_score: float


@router.get("/trending", response_model=List[TrendingCharacter])
async def get_trending_searches(limit: int = 10, db: Session = Depends(get_db)):
    """
    Get trending character names based on real analytics data.

    Returns the top characters by trending_score, which is calculated from:
    - view_count (30% weight)
    - chat_count (50% weight)
    - like_count (20% weight)

    Args:
        limit: Maximum number of trending characters to return (default 10)
        db: Database session

    Returns:
        List of trending characters with id, name, and trending_score
    """
    try:
        # Query top characters by trending score
        trending_characters = db.query(Character).filter(
            Character.is_deleted == False,
            Character.is_public == True
        ).order_by(
            desc(Character.trending_score)
        ).limit(limit).all()

        # If no characters have trending scores, fallback to most viewed
        if not trending_characters or all(char.trending_score == 0 for char in trending_characters):
            logger.info("No characters with trending scores, falling back to view_count")
            trending_characters = db.query(Character).filter(
                Character.is_deleted == False,
                Character.is_public == True
            ).order_by(
                desc(Character.view_count)
            ).limit(limit).all()

        result = [
            TrendingCharacter(
                id=char.id,
                name=char.name,
                trending_score=float(char.trending_score) if char.trending_score else 0.0
            )
            for char in trending_characters
        ]

        logger.info(f"Returned {len(result)} trending characters")
        return result

    except Exception as e:
        logger.error(f"Error fetching trending searches: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch trending searches"
        )
