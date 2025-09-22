from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from models import Base, User, Character, Chat, ChatMessage

# Create database engine (simplified to sync-only for now)
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_user_admin_columns():
    """Ensure newer admin-related columns exist on users table for legacy databases."""
    inspector = inspect(engine)
    try:
        existing_columns = {column['name'] for column in inspector.get_columns('users')}
    except Exception:
        existing_columns = set()

    if not existing_columns:
        # Table may not exist yet; nothing to do
        return

    dialect = engine.dialect.name
    boolean_type = "INTEGER" if dialect == "sqlite" else "BOOLEAN"
    bool_default_false = "0" if dialect == "sqlite" else "FALSE"
    datetime_type = "TIMESTAMP"
    text_type = "TEXT"
    string_type = "VARCHAR(100)" if dialect != "sqlite" else "TEXT"

    migrations = {
        "email_verified": f"ALTER TABLE users ADD COLUMN email_verified {boolean_type} DEFAULT {bool_default_false}",
        "last_login_at": f"ALTER TABLE users ADD COLUMN last_login_at {datetime_type}",
        "last_login_ip": f"ALTER TABLE users ADD COLUMN last_login_ip {string_type}",
        "is_suspended": f"ALTER TABLE users ADD COLUMN is_suspended {boolean_type} DEFAULT {bool_default_false}",
        "suspended_at": f"ALTER TABLE users ADD COLUMN suspended_at {datetime_type}",
        "suspension_reason": f"ALTER TABLE users ADD COLUMN suspension_reason {text_type}"
    }

    with engine.begin() as conn:
        for column_name, ddl in migrations.items():
            if column_name not in existing_columns:
                conn.execute(text(ddl))


ensure_user_admin_columns()


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
    ensure_user_admin_columns()

    # Create initial data
    db = SessionLocal()
    try:
        create_initial_data(db)
    finally:
        db.close()

def create_initial_data(db: Session):
    """Create initial characters if they don't exist"""
    
    # Check if data already exists
    existing_chars = db.query(Character).first()
    
    if not existing_chars:
        # Create sample characters
        characters = [
            Character(
                name="艾莉丝",
                avatar_url="/assets/characters_img/Elara.jpeg",
                backstory="Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.",
                voice_style="Mystical, refined feminine voice",
                traits=["Mage", "Wise", "Ancient", "Mysterious"],
                gender="female",
                personality_traits={
                    "Warmth": 40,
                    "Humor": 20,
                    "Intelligence": 95,
                    "Patience": 75
                }
            ),
            Character(
                name="Kravus",
                avatar_url="/assets/characters_img/Elara.jpeg",
                backstory="A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing presence and scarred visage tell of countless battles survived through sheer strength and determination.",
                voice_style="Deep, commanding masculine voice",
                traits=["Warrior", "Brash", "Honorable", "Strong"],
                gender="male",
                personality_traits={
                    "Warmth": 30,
                    "Humor": 45,
                    "Intelligence": 65,
                    "Patience": 25
                }
            ),
            Character(
                name="Lyra",
                avatar_url="/assets/characters_img/Elara.jpeg",
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
                avatar_url="/assets/characters_img/Elara.jpeg",
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
