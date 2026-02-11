"""
Onyx Streaming - Database Configuration
SQLAlchemy async setup with SQLite (upgradeable to PostgreSQL)
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pathlib import Path
import os

# Database path
DB_DIR = Path(__file__).parent.parent / "data"
DB_DIR.mkdir(exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_DIR}/onyx_streaming.db")

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set True for SQL debugging
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
class Base(DeclarativeBase):
    pass

async def init_db():
    """Initialize database tables"""
    from app.models import user, library  # Import all models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Dependency for route handlers"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
