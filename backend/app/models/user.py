"""
Onyx Streaming - User Models
User accounts and profiles for multi-user support
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class User(Base):
    """User account - one per real person"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    """User profile - multiple per user (Netflix-style)"""
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(50), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    pin_hash = Column(String(255), nullable=True)  # Optional PIN protection
    theme = Column(String(20), default="dark")
    eq_preset = Column(String(50), nullable=True)
    crossfade_ms = Column(Integer, default=0)
    auto_cache_enabled = Column(Boolean, default=True)  # User preference for auto-caching
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="profiles")
    playlists = relationship("app.models.library.Playlist", back_populates="owner", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="profile", cascade="all, delete-orphan")
    history = relationship("ListeningHistory", back_populates="profile", cascade="all, delete-orphan")
    queue = relationship("ProfileQueue", back_populates="profile", uselist=False, cascade="all, delete-orphan")


class ProfileQueue(Base):
    """Persisted playback queue for a profile"""
    __tablename__ = "profile_queues"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Queue state as JSON (array of track objects)
    tracks_json = Column(Text, nullable=False, default="[]")
    
    # Current position in queue
    current_index = Column(Integer, default=-1)
    
    # Playback position within current track (for resume)
    current_time_sec = Column(Float, default=0.0)
    
    # Settings state
    repeat_mode = Column(String(10), default="none")  # "none" | "one" | "all"
    is_shuffle = Column(Boolean, default=False)
    
    # Timestamps
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    profile = relationship("Profile", back_populates="queue")


class Favorite(Base):
    """Favorited track for a profile"""
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    track_id = Column(Integer, ForeignKey("library_tracks.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="favorites")
    track = relationship("LibraryTrack")


class ListeningHistory(Base):
    """Track listening history for recommendations"""
    __tablename__ = "listening_history"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    track_id = Column(Integer, ForeignKey("library_tracks.id"), nullable=False)
    played_at = Column(DateTime, default=datetime.utcnow)
    duration_listened = Column(Integer, default=0)  # seconds
    completed = Column(Boolean, default=False)
    
    # Relationships
    profile = relationship("Profile", back_populates="history")
    track = relationship("LibraryTrack")
