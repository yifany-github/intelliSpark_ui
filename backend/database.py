from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from models import Base, User, Scene, Character, Chat, ChatMessage

# Create database engine (simplified to sync-only for now)
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
async def init_db():
    """Initialize database and create tables"""
    Base.metadata.create_all(bind=engine)
    
    # Create initial data
    db = SessionLocal()
    try:
        create_initial_data(db)
    finally:
        db.close()

def create_initial_data(db: Session):
    """Create initial scenes and characters if they don't exist"""
    
    # Check if data already exists
    existing_scenes = db.query(Scene).first()
    existing_chars = db.query(Character).first()
    
    if not existing_scenes:
        # Create sample scenes
        scenes = [
            Scene(
                name="Royal Court",
                description="Medieval castle intrigue",
                image_url="/assets/scenes_img/royal_court.jpeg",
                location="Castle",
                mood="Intrigue",
                rating="PG"
            ),
            Scene(
                name="Star Voyager",
                description="Deep space exploration",
                image_url="https://via.placeholder.com/800x600.png?text=Star+Voyager",
                location="Space",
                mood="Adventure",
                rating="PG-13"
            ),
            Scene(
                name="Neo Tokyo",
                description="Futuristic urban adventure",
                image_url="https://via.placeholder.com/800x600.png?text=Neo+Tokyo",
                location="City",
                mood="Dark",
                rating="M"
            ),
            Scene(
                name="Tropical Getaway",
                description="Paradise island resort",
                image_url="https://via.placeholder.com/800x600.png?text=Tropical+Getaway",
                location="Beach",
                mood="Relaxed",
                rating="PG"
            ),
            Scene(
                name="Enchanted Woods",
                description="Magical forest adventure",
                image_url="https://via.placeholder.com/800x600.png?text=Enchanted+Woods",
                location="Forest",
                mood="Magical",
                rating="G"
            ),
            Scene(
                name="Wasteland",
                description="Survival in the ruins",
                image_url="https://via.placeholder.com/800x600.png?text=Wasteland",
                location="Ruins",
                mood="Gritty",
                rating="M"
            )
        ]
        
        for scene in scenes:
            db.add(scene)
    
    if not existing_chars:
        # Create sample characters
        characters = [
            Character(
                name="艾莉丝",
                avatar_url="/assets/characters_img/Elara.jpeg",
                backstory="Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.",
                voice_style="Mystical, refined feminine voice",
                traits=["Mage", "Wise", "Ancient", "Mysterious"],
                personality_traits={
                    "Warmth": 40,
                    "Humor": 20,
                    "Intelligence": 95,
                    "Patience": 75
                }
            ),
            Character(
                name="Kravus",
                avatar_url="https://via.placeholder.com/150x150.png?text=Kravus",
                backstory="A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing presence and scarred visage tell of countless battles survived through sheer strength and determination.",
                voice_style="Deep, commanding masculine voice",
                traits=["Warrior", "Brash", "Honorable", "Strong"],
                personality_traits={
                    "Warmth": 30,
                    "Humor": 45,
                    "Intelligence": 65,
                    "Patience": 25
                }
            ),
            Character(
                name="Lyra",
                avatar_url="https://via.placeholder.com/150x150.png?text=Lyra",
                backstory="A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive in a world that has never shown her kindness. Despite her tough exterior, she harbors a soft spot for those who have been wronged.",
                voice_style="Sly, confident feminine voice",
                traits=["Rogue", "Tsundere", "Quick-witted", "Secretive"],
                personality_traits={
                    "Warmth": 50,
                    "Humor": 75,
                    "Intelligence": 85,
                    "Patience": 40
                }
            ),
            Character(
                name="XN-7",
                avatar_url="https://via.placeholder.com/150x150.png?text=XN-7",
                backstory="An advanced android with a curiosity about human emotions. XN-7 was designed to assist with complex calculations and data analysis, but has developed beyond its original programming and now seeks to understand what it means to be alive.",
                voice_style="Synthetic, precise voice with subtle emotional undertones",
                traits=["Android", "Logical", "Curious", "Evolving"],
                personality_traits={
                    "Warmth": 25,
                    "Humor": 10,
                    "Intelligence": 99,
                    "Patience": 90
                }
            )
        ]
        
        for character in characters:
            db.add(character)
    
    # Commit the changes
    db.commit()